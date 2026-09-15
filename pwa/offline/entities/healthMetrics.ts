import { cache } from '../cache';
import { localCreate, localDelete, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { CreateHealthMetricInput, HealthMetric } from '../../api/healthMetrics';

export type { HealthMetric };
export { isTempId };

export interface OfflineHealthMetric extends Omit<HealthMetric, 'id' | 'patientId'> {
  id: IdLike;
  patientId: IdLike;
  pendingSync?: boolean;
}

export async function listHealthMetricsCached(patientId: IdLike): Promise<OfflineHealthMetric[]> {
  const all = await cache.list<OfflineHealthMetric>('healthMetrics');
  return all.filter((m) => String(m.patientId) === String(patientId));
}

export async function mergeHealthMetricsFromServer(patientId: IdLike, serverList: HealthMetric[]): Promise<OfflineHealthMetric[]> {
  const mine = await listHealthMetricsCached(patientId);
  const pendingIds = new Set(mine.filter((m) => m.pendingSync).map((m) => String(m.id)));
  const others = (await cache.list<OfflineHealthMetric>('healthMetrics')).filter((m) => String(m.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineHealthMetric>('healthMetrics', serverList as OfflineHealthMetric[], pendingIds);
  await cache.putMany('healthMetrics', others);
  return merged;
}

export async function createHealthMetricOffline(
  patientId: IdLike,
  input: CreateHealthMetricInput,
  createdById: number,
): Promise<OfflineHealthMetric> {
  const tempId = newTempId('metric');
  const record: OfflineHealthMetric = {
    id: tempId,
    patientId,
    type: input.type,
    label: input.label ?? null,
    value: input.value,
    unit: input.unit ?? null,
    recordedAt: input.recordedAt,
    documentId: input.documentId ?? null,
    createdById,
    createdAt: new Date().toISOString(),
    pendingSync: true,
  };
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/health-metrics`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  return localCreate('healthMetrics', record, { method: 'POST', pathTemplate: path, refs, body: input });
}

export async function deleteHealthMetricOffline(patientId: IdLike, id: IdLike): Promise<void> {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/health-metrics/${isTempId(id) ? '${metricId}' : id}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(id)) refs.metricId = String(id);
  await localDelete('healthMetrics', id, { method: 'DELETE', pathTemplate: path, refs });
}
