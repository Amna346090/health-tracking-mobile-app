import { cache } from '../cache';
import { localCreate, localDelete, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import { tempRef } from '../types';
import type { MedicationAssignment, MedicationOrder } from '../../api/assignments';
import { getMedicationCached } from './medications';

export type { MedicationAssignment, MedicationOrder };
export { isTempId };

export interface OfflineAssignment extends Omit<MedicationAssignment, 'id' | 'patientId' | 'medicationId'> {
  id: IdLike;
  patientId: IdLike;
  medicationId: IdLike;
  pendingSync?: boolean;
}

export interface OfflineOrder extends Omit<MedicationOrder, 'id' | 'assignmentId'> {
  id: IdLike;
  assignmentId: IdLike;
  pendingSync?: boolean;
}

function patientPath(patientId: IdLike, suffix: string): { pathTemplate: string; refs?: Record<string, string> } {
  if (isTempId(patientId)) {
    return { pathTemplate: `/patients/\${patientId}${suffix}`, refs: { patientId: String(patientId) } };
  }
  return { pathTemplate: `/patients/${patientId}${suffix}` };
}

// ─── Assignments (peptide protocols) ───────────────────────────────────────────

export async function listAssignmentsCached(patientId: IdLike): Promise<OfflineAssignment[]> {
  const all = await cache.list<OfflineAssignment>('assignments');
  return all.filter((a) => String(a.patientId) === String(patientId));
}

export async function mergeAssignmentsFromServer(patientId: IdLike, serverList: MedicationAssignment[]): Promise<OfflineAssignment[]> {
  const mine = await listAssignmentsCached(patientId);
  const pendingIds = new Set(mine.filter((a) => a.pendingSync).map((a) => String(a.id)));
  const others = (await cache.list<OfflineAssignment>('assignments')).filter((a) => String(a.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineAssignment>('assignments', serverList as OfflineAssignment[], pendingIds);
  // replaceFromServer only removed/kept rows for `patientId`'s own set implicitly wrong (it operates on the whole
  // entity table) — restore other patients' rows that replaceFromServer would otherwise have dropped.
  await cache.putMany('assignments', others);
  return merged;
}

export interface CreateAssignmentInput {
  medicationId: IdLike;
  frequency: string;
  timesPerDay?: number;
  timesOfDay: string[];
  startDate: string;
  endDate?: string | null;
}

export async function createAssignmentOffline(patientId: IdLike, input: CreateAssignmentInput): Promise<OfflineAssignment> {
  const tempId = newTempId('assignment');
  const medication = await getMedicationCached(input.medicationId);
  const record: OfflineAssignment = {
    id: tempId,
    patientId,
    medicationId: input.medicationId,
    frequency: input.frequency,
    timesPerDay: input.timesPerDay ?? null,
    timesOfDay: input.timesOfDay,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    refillsAllowed: null,
    refillsUsed: 0,
    active: true,
    createdAt: new Date().toISOString(),
    medication: {
      id: (medication?.id ?? input.medicationId) as unknown as number,
      name: medication?.name ?? '…',
      dosage: medication?.dosage ?? null,
      doseAmount: null,
      doseUnit: null,
      form: medication?.form ?? null,
      quantityPerDose: medication?.quantityPerDose ?? null,
      foodInstruction: medication?.foodInstruction ?? null,
      instructions: medication?.instructions ?? null,
      prescribingNotes: medication?.prescribingNotes ?? null,
    },
    pendingSync: true,
  };
  const { pathTemplate, refs } = patientPath(patientId, '/assignments');
  const bodyRefs: Record<string, string> = { ...(refs ?? {}) };
  const body: Record<string, unknown> = { ...input };
  if (isTempId(input.medicationId)) body.medicationId = tempRef(String(input.medicationId));
  return localCreate('assignments', record, { method: 'POST', pathTemplate, refs: bodyRefs, body });
}

export interface UpdateAssignmentInput {
  frequency?: string;
  timesPerDay?: number;
  timesOfDay?: string[];
  startDate?: string;
  endDate?: string | null;
  refillsAllowed?: number | null;
}

export async function updateAssignmentOffline(
  patientId: IdLike,
  assignmentId: IdLike,
  patch: UpdateAssignmentInput,
): Promise<OfflineAssignment> {
  const { pathTemplate, refs } = assignmentSubPath(patientId, assignmentId, '');
  return localUpdate<OfflineAssignment>('assignments', assignmentId, patch as Partial<OfflineAssignment>, {
    method: 'PATCH',
    pathTemplate,
    refs,
    body: patch,
  });
}

export async function deactivateAssignmentOffline(patientId: IdLike, assignmentId: IdLike): Promise<void> {
  const { pathTemplate, refs } = assignmentSubPath(patientId, assignmentId, '');
  await localDelete('assignments', assignmentId, { method: 'DELETE', pathTemplate, refs });
}

// ─── Dose-order history ─────────────────────────────────────────────────────────

export async function listOrdersCached(assignmentId: IdLike): Promise<OfflineOrder[]> {
  const all = await cache.list<OfflineOrder>('medicationOrders');
  return all.filter((o) => String(o.assignmentId) === String(assignmentId));
}

export async function mergeOrdersFromServer(assignmentId: IdLike, serverList: MedicationOrder[]): Promise<OfflineOrder[]> {
  const mine = await listOrdersCached(assignmentId);
  const pendingIds = new Set(mine.filter((o) => o.pendingSync).map((o) => String(o.id)));
  const others = (await cache.list<OfflineOrder>('medicationOrders')).filter((o) => String(o.assignmentId) !== String(assignmentId));
  const merged = await cache.replaceFromServer<OfflineOrder>('medicationOrders', serverList as OfflineOrder[], pendingIds);
  await cache.putMany('medicationOrders', others);
  return merged;
}

function assignmentSubPath(patientId: IdLike, assignmentId: IdLike, suffix: string): { pathTemplate: string; refs: Record<string, string> } {
  const refs: Record<string, string> = {};
  let path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/assignments/${isTempId(assignmentId) ? '${assignmentId}' : assignmentId}${suffix}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(assignmentId)) refs.assignmentId = String(assignmentId);
  return { pathTemplate: path, refs };
}

export async function createOrderOffline(
  patientId: IdLike,
  assignmentId: IdLike,
  input: { date: string; dose: string; note?: string },
): Promise<OfflineOrder> {
  const tempId = newTempId('order');
  const record: OfflineOrder = {
    id: tempId,
    assignmentId,
    date: input.date,
    dose: input.dose,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
    createdBy: { id: 0, firstName: '', lastName: '', role: '' },
    pendingSync: true,
  };
  const { pathTemplate, refs } = assignmentSubPath(patientId, assignmentId, '/orders');
  return localCreate('medicationOrders', record, { method: 'POST', pathTemplate, refs, body: input });
}

export async function deleteOrderOffline(patientId: IdLike, assignmentId: IdLike, orderId: IdLike): Promise<void> {
  const { pathTemplate, refs } = assignmentSubPath(patientId, assignmentId, `/orders/${isTempId(orderId) ? '${orderId}' : orderId}`);
  if (isTempId(orderId)) refs.orderId = String(orderId);
  await localDelete('medicationOrders', orderId, { method: 'DELETE', pathTemplate, refs });
}
