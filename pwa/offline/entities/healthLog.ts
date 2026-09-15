import { cache } from '../cache';
import { localCreate, localDelete, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { FeelingStatus, HealthLog } from '../../api/healthLog';

export type { HealthLog };
export { isTempId };

export interface OfflineHealthLog extends Omit<HealthLog, 'id' | 'patientId'> {
  id: IdLike;
  patientId: IdLike;
  pendingSync?: boolean;
}

function logPath(patientId: IdLike, suffix: string): { pathTemplate: string; refs: Record<string, string> } {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/health-logs${suffix}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  return { pathTemplate: path, refs };
}

export async function listHealthLogsCached(patientId: IdLike): Promise<OfflineHealthLog[]> {
  const all = await cache.list<OfflineHealthLog>('healthLogs');
  return all.filter((l) => String(l.patientId) === String(patientId));
}

export async function mergeHealthLogsFromServer(patientId: IdLike, serverList: HealthLog[]): Promise<OfflineHealthLog[]> {
  const mine = await listHealthLogsCached(patientId);
  const pendingIds = new Set(mine.filter((l) => l.pendingSync).map((l) => String(l.id)));
  const others = (await cache.list<OfflineHealthLog>('healthLogs')).filter((l) => String(l.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineHealthLog>('healthLogs', serverList as OfflineHealthLog[], pendingIds);
  await cache.putMany('healthLogs', others);
  return merged;
}

export interface CreateHealthLogInput {
  date: string;
  weight?: number | null;
  height?: number | null;
  feeling?: FeelingStatus | null;
  notes?: string | null;
}

export async function createHealthLogOffline(
  patientId: IdLike,
  input: CreateHealthLogInput,
  createdBy: { id: number; firstName: string; lastName: string; role: string },
): Promise<OfflineHealthLog> {
  const tempId = newTempId('healthlog');
  const record: OfflineHealthLog = {
    id: tempId,
    patientId,
    date: input.date,
    weight: input.weight ?? null,
    height: input.height ?? null,
    feeling: input.feeling ?? null,
    notes: input.notes ?? null,
    createdById: createdBy.id,
    createdAt: new Date().toISOString(),
    createdBy,
    pendingSync: true,
  };
  const { pathTemplate, refs } = logPath(patientId, '');
  return localCreate('healthLogs', record, { method: 'POST', pathTemplate, refs, body: input });
}

export async function updateHealthLogOffline(
  patientId: IdLike,
  logId: IdLike,
  patch: Partial<CreateHealthLogInput>,
): Promise<OfflineHealthLog> {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/health-logs/${isTempId(logId) ? '${logId}' : logId}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(logId)) refs.logId = String(logId);
  return localUpdate<OfflineHealthLog>('healthLogs', logId, patch as Partial<OfflineHealthLog>, {
    method: 'PATCH', pathTemplate: path, refs, body: patch,
  });
}

export async function deleteHealthLogOffline(patientId: IdLike, logId: IdLike): Promise<void> {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/health-logs/${isTempId(logId) ? '${logId}' : logId}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(logId)) refs.logId = String(logId);
  await localDelete('healthLogs', logId, { method: 'DELETE', pathTemplate: path, refs });
}
