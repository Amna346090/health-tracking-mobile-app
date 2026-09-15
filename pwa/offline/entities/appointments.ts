import { cache } from '../cache';
import { localCreate, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { Appointment, AppointmentStatus } from '../../api/appointments';

export type { Appointment };
export { isTempId };

export interface OfflineAppointment extends Omit<Appointment, 'id' | 'patientId'> {
  id: IdLike;
  patientId: IdLike;
  pendingSync?: boolean;
}

export async function listAppointmentsCached(patientId?: IdLike): Promise<OfflineAppointment[]> {
  const all = await cache.list<OfflineAppointment>('appointments');
  return patientId === undefined ? all : all.filter((a) => String(a.patientId) === String(patientId));
}

export async function mergeAppointmentsFromServer(patientId: IdLike, serverList: Appointment[]): Promise<OfflineAppointment[]> {
  const mine = await listAppointmentsCached(patientId);
  const pendingIds = new Set(mine.filter((a) => a.pendingSync).map((a) => String(a.id)));
  const others = (await cache.list<OfflineAppointment>('appointments')).filter((a) => String(a.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineAppointment>('appointments', serverList as OfflineAppointment[], pendingIds);
  await cache.putMany('appointments', others);
  return merged;
}

export interface CreateAppointmentInput {
  scheduledFor: string;
  reason?: string | null;
  notes?: string | null;
  durationMinutes?: number | null;
}

export async function createAppointmentOffline(
  patientId: IdLike,
  input: CreateAppointmentInput,
  createdById: number,
): Promise<OfflineAppointment> {
  const tempId = newTempId('appointment');
  const now = new Date().toISOString();
  const record: OfflineAppointment = {
    id: tempId,
    patientId,
    scheduledFor: input.scheduledFor,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    status: 'SCHEDULED',
    durationMinutes: input.durationMinutes ?? null,
    createdById,
    createdAt: now,
    updatedAt: now,
    pendingSync: true,
  };
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/appointments`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  return localCreate('appointments', record, { method: 'POST', pathTemplate: path, refs, body: input });
}

export interface UpdateAppointmentInput {
  scheduledFor?: string;
  reason?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
  durationMinutes?: number | null;
}

export async function updateAppointmentOffline(
  patientId: IdLike,
  id: IdLike,
  patch: UpdateAppointmentInput,
): Promise<OfflineAppointment> {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/appointments/${isTempId(id) ? '${appointmentId}' : id}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(id)) refs.appointmentId = String(id);
  return localUpdate<OfflineAppointment>('appointments', id, { ...patch, updatedAt: new Date().toISOString() } as Partial<OfflineAppointment>, {
    method: 'PATCH', pathTemplate: path, refs, body: patch,
  });
}
