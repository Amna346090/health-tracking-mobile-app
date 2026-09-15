// Shared types for the offline local-first cache + sync queue.
// See pwa/offline/db.ts, cache.ts, queue.ts, sync.ts, mutate.ts.

export type EntityName =
  | 'patients'
  | 'medications'
  | 'assignments'
  | 'medicationLogs'
  | 'medicationOrders'
  | 'healthLogs'
  | 'healthMetrics'
  | 'notes'
  | 'appointments'
  | 'testRequests'
  | 'notifications'
  | 'messages'
  | 'users';

export type IdLike = string | number;

export type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueueOp = 'create' | 'update' | 'delete';

/**
 * A value that stands in for an id we don't have yet because its record was created
 * offline and hasn't synced. Resolved to the real id at send-time via the temp-id map.
 */
export interface TempRef {
  $tempRef: string;
}

export function tempRef(tempId: string): TempRef {
  return { $tempRef: tempId };
}

export interface QueueItem {
  id: string;
  entity: EntityName;
  op: QueueOp;
  /** The cache-level id (temp or real, string form) this mutation ultimately concerns. */
  targetId: string;
  /** Set only when op === 'create': the temp id assigned to the new record. */
  createdTempId?: string;
  method: HttpMethod;
  /** e.g. "/patients/${patientId}/assignments" — tokens resolved via `refs` at send-time. */
  pathTemplate: string;
  /** token name -> tempId, only for path tokens that are still unresolved (temp) ids. */
  refs: Record<string, string>;
  /** JSON-serializable request body; may contain TempRef markers anywhere, nested. */
  body: unknown;
  /** When the action actually happened on-device, not when it happens to sync. */
  clientTimestamp: string;
  status: 'pending' | 'failed';
  error?: string;
  attempts: number;
  /** Monotonic insertion order, for stable FIFO processing. */
  seq: number;
}

export interface CachedRecord<T = unknown> {
  key: string;
  entity: EntityName;
  id: string;
  data: T;
}
