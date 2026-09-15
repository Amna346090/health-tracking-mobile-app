import { cache } from '../cache';
import { localCreate, localDelete, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { Medication, MedicationInput } from '../../api/medications';

export type { Medication };
export { isTempId };

export interface OfflineMedication extends Omit<Medication, 'id'> {
  id: IdLike;
  pendingSync?: boolean;
}

export async function listMedicationsCached(): Promise<OfflineMedication[]> {
  return cache.list<OfflineMedication>('medications');
}

export async function getMedicationCached(id: IdLike): Promise<OfflineMedication | undefined> {
  return cache.get<OfflineMedication>('medications', id);
}

export async function mergeMedicationsFromServer(serverList: Medication[]): Promise<OfflineMedication[]> {
  const pendingIds = new Set((await listMedicationsCached()).filter((m) => m.pendingSync).map((m) => String(m.id)));
  return cache.replaceFromServer<OfflineMedication>('medications', serverList, pendingIds);
}

export async function createMedicationOffline(input: MedicationInput): Promise<OfflineMedication> {
  const tempId = newTempId('medication');
  const record: OfflineMedication = {
    id: tempId,
    name: input.name,
    dosage: input.dosage ?? null,
    form: input.form ?? null,
    quantityPerDose: input.quantityPerDose ?? null,
    foodInstruction: input.foodInstruction ?? null,
    instructions: input.instructions ?? null,
    prescribingNotes: input.prescribingNotes ?? null,
    _count: { assignments: 0 },
    pendingSync: true,
  };
  return localCreate('medications', record, {
    method: 'POST',
    pathTemplate: '/medications',
    body: input,
  });
}

export async function updateMedicationOffline(id: IdLike, patch: Partial<MedicationInput>): Promise<OfflineMedication> {
  return localUpdate<OfflineMedication>('medications', id, patch as Partial<OfflineMedication>, {
    method: 'PATCH',
    pathTemplate: isTempId(id) ? '/medications/${medicationId}' : `/medications/${id}`,
    refs: isTempId(id) ? { medicationId: String(id) } : undefined,
    body: patch,
  });
}

export async function deleteMedicationOffline(id: IdLike): Promise<void> {
  await localDelete('medications', id, {
    method: 'DELETE',
    pathTemplate: isTempId(id) ? '/medications/${medicationId}' : `/medications/${id}`,
    refs: isTempId(id) ? { medicationId: String(id) } : undefined,
  });
}
