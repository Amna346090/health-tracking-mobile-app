import { cache } from '../cache';
import { localCreate, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { TestRequest, TestRequestStatus } from '../../api/testRequests';

export type { TestRequest };
export { isTempId };

export interface OfflineTestRequest extends Omit<TestRequest, 'id' | 'patientId'> {
  id: IdLike;
  patientId: IdLike;
  pendingSync?: boolean;
}

export async function listTestRequestsCached(patientId?: IdLike): Promise<OfflineTestRequest[]> {
  const all = await cache.list<OfflineTestRequest>('testRequests');
  return patientId === undefined ? all : all.filter((r) => String(r.patientId) === String(patientId));
}

export async function mergeTestRequestsFromServer(patientId: IdLike, serverList: TestRequest[]): Promise<OfflineTestRequest[]> {
  const mine = await listTestRequestsCached(patientId);
  const pendingIds = new Set(mine.filter((r) => r.pendingSync).map((r) => String(r.id)));
  const others = (await cache.list<OfflineTestRequest>('testRequests')).filter((r) => String(r.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineTestRequest>('testRequests', serverList as OfflineTestRequest[], pendingIds);
  await cache.putMany('testRequests', others);
  return merged;
}

export interface CreateTestRequestInput {
  name: string;
  instructions?: string | null;
  dueDate: string;
}

export async function createTestRequestOffline(
  patientId: IdLike,
  input: CreateTestRequestInput,
  requestedById: number,
): Promise<OfflineTestRequest> {
  const tempId = newTempId('testrequest');
  const now = new Date().toISOString();
  const record: OfflineTestRequest = {
    id: tempId,
    patientId,
    name: input.name,
    instructions: input.instructions ?? null,
    dueDate: input.dueDate,
    status: 'PENDING',
    documentId: null,
    requestedById,
    createdAt: now,
    updatedAt: now,
    pendingSync: true,
  };
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/test-requests`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  return localCreate('testRequests', record, { method: 'POST', pathTemplate: path, refs, body: input });
}

export interface UpdateTestRequestInput {
  name?: string;
  instructions?: string | null;
  dueDate?: string;
  status?: TestRequestStatus;
}

export async function updateTestRequestOffline(
  patientId: IdLike,
  id: IdLike,
  patch: UpdateTestRequestInput,
): Promise<OfflineTestRequest> {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/test-requests/${isTempId(id) ? '${testRequestId}' : id}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(id)) refs.testRequestId = String(id);
  return localUpdate<OfflineTestRequest>('testRequests', id, { ...patch, updatedAt: new Date().toISOString() } as Partial<OfflineTestRequest>, {
    method: 'PATCH', pathTemplate: path, refs, body: patch,
  });
}
