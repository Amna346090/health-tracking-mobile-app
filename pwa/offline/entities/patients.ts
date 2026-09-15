import { cache } from '../cache';
import { localCreate, localDelete, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { Gender } from '../../api/auth';
import type { PatientRow, UpdatePatientInput } from '../../api/patients';

export type { PatientRow };
export { isTempId };

export interface OfflinePatientRow extends Omit<PatientRow, 'id' | 'userId'> {
  id: IdLike;
  userId: IdLike;
  pendingSync?: boolean;
}

export async function listPatientsCached(): Promise<OfflinePatientRow[]> {
  return cache.list<OfflinePatientRow>('patients');
}

export async function getPatientCached(id: IdLike): Promise<OfflinePatientRow | undefined> {
  return cache.get<OfflinePatientRow>('patients', id);
}

export function getPatientCachedSync(id: IdLike): OfflinePatientRow | undefined {
  return cache.getSync<OfflinePatientRow>('patients', id);
}

/** Merges a fresh server list into the cache without wiping out any patients still awaiting sync. */
export async function mergePatientsFromServer(serverList: PatientRow[]): Promise<OfflinePatientRow[]> {
  const pendingIds = new Set((await listPatientsCached()).filter((p) => p.pendingSync).map((p) => String(p.id)));
  return cache.replaceFromServer<OfflinePatientRow>('patients', serverList, pendingIds);
}

export async function mergePatientFromServer(record: PatientRow): Promise<void> {
  await cache.put<OfflinePatientRow>('patients', record);
}

export interface CreatePatientInput {
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  healthIssue?: string;
  phone: string;
}

export async function createPatientOffline(input: CreatePatientInput): Promise<OfflinePatientRow> {
  const tempId = newTempId('patient');
  const now = new Date().toISOString();
  const record: OfflinePatientRow = {
    id: tempId,
    userId: tempId,
    dateOfBirth: input.dateOfBirth ?? null,
    gender: input.gender ?? null,
    healthIssue: input.healthIssue ?? null,
    avatarUrl: null,
    phone: input.phone,
    address: null,
    lastContactAt: null,
    touchBaseThresholdDays: null,
    touchBaseRemindersPaused: false,
    providerId: null,
    createdAt: now,
    user: { id: tempId as unknown as number, firstName: input.firstName, lastName: input.lastName ?? '', email: null, username: null },
    pendingSync: true,
  };
  return localCreate('patients', record, {
    method: 'POST',
    pathTemplate: '/auth/register',
    body: { ...input, role: 'PATIENT' },
  });
}

export async function updatePatientOffline(id: IdLike, patch: UpdatePatientInput): Promise<OfflinePatientRow> {
  return localUpdate<OfflinePatientRow>('patients', id, patch as Partial<OfflinePatientRow>, {
    method: 'PATCH',
    pathTemplate: isTempId(id) ? '/patients/${patientId}' : `/patients/${id}`,
    refs: isTempId(id) ? { patientId: String(id) } : undefined,
    body: patch,
  });
}

/** "Mark as contacted" — records the time this actually happened, not whenever it syncs. */
export async function markContactedOffline(patientId: IdLike): Promise<OfflinePatientRow> {
  const clientTimestamp = new Date().toISOString();
  return localUpdate<OfflinePatientRow>('patients', patientId, { lastContactAt: clientTimestamp } as Partial<OfflinePatientRow>, {
    method: 'POST',
    pathTemplate: isTempId(patientId) ? '/patients/${patientId}/contact' : `/patients/${patientId}/contact`,
    refs: isTempId(patientId) ? { patientId: String(patientId) } : undefined,
    body: { clientTimestamp },
    clientTimestamp,
  });
}

/** Deletes the patient's account — a hard, cascading delete server-side. */
export async function deletePatientOffline(patientId: IdLike, userId: IdLike): Promise<void> {
  await localDelete('patients', patientId, {
    method: 'DELETE',
    pathTemplate: isTempId(userId) ? '/users/${userId}' : `/users/${userId}`,
    refs: isTempId(userId) ? { userId: String(userId) } : undefined,
  });
  // This same account may also be cached separately under 'users' (the Manage Users list) —
  // clear it there too so that screen doesn't keep showing a now-deleted account until it
  // happens to refetch on its own.
  await cache.remove('users', userId);
}
