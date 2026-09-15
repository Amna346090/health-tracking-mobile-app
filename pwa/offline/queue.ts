import { deleteMany, deleteOne, getAll, getAllFromIndex, getOne, putOne, STORE_QUEUE } from './db';
import type { QueueItem } from './types';

let seqCounter = 0;
let seqInitialized = false;

async function nextSeq(): Promise<number> {
  if (!seqInitialized) {
    const all = await getAll<QueueItem>(STORE_QUEUE);
    seqCounter = all.reduce((max, item) => Math.max(max, item.seq), 0);
    seqInitialized = true;
  }
  seqCounter += 1;
  return seqCounter;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onQueueChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export async function enqueueItem(input: Omit<QueueItem, 'id' | 'status' | 'attempts' | 'seq'>): Promise<QueueItem> {
  const item: QueueItem = {
    ...input,
    id: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    attempts: 0,
    seq: await nextSeq(),
  };
  await putOne(STORE_QUEUE, item);
  notify();
  return item;
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  const items = await getAll<QueueItem>(STORE_QUEUE);
  return items.sort((a, b) => a.seq - b.seq);
}

export async function getPendingQueueItems(): Promise<QueueItem[]> {
  const items = await getAllFromIndex<QueueItem>(STORE_QUEUE, 'byStatus', 'pending');
  return items.sort((a, b) => a.seq - b.seq);
}

export async function getFailedQueueItems(): Promise<QueueItem[]> {
  const items = await getAllFromIndex<QueueItem>(STORE_QUEUE, 'byStatus', 'failed');
  return items.sort((a, b) => a.seq - b.seq);
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  return getOne<QueueItem>(STORE_QUEUE, id);
}

export async function putQueueItem(item: QueueItem): Promise<void> {
  await putOne(STORE_QUEUE, item);
  notify();
}

export async function removeQueueItem(id: string): Promise<void> {
  await deleteOne(STORE_QUEUE, id);
  notify();
}

export async function removeQueueItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await deleteMany(STORE_QUEUE, ids);
  notify();
}

export async function markQueueItemFailed(id: string, error: string): Promise<void> {
  const item = await getQueueItem(id);
  if (!item) return;
  item.status = 'failed';
  item.error = error;
  item.attempts += 1;
  await putQueueItem(item);
}

export async function markQueueItemPending(id: string): Promise<void> {
  const item = await getQueueItem(id);
  if (!item) return;
  item.status = 'pending';
  item.error = undefined;
  await putQueueItem(item);
}

/** Finds a still-pending 'create' item whose new record is `targetId` — used to detect
 * "edit/delete something that was itself created offline and hasn't synced yet". */
export async function findPendingCreate(entity: string, targetId: string): Promise<QueueItem | undefined> {
  const items = await getAllQueueItems();
  return items.find(
    (i) => i.entity === entity && i.op === 'create' && i.status === 'pending' && i.createdTempId === targetId,
  );
}

/** All queue items that reference `tempId` — either as their own target or as a parent ref. */
export async function findItemsReferencingTempId(tempId: string): Promise<QueueItem[]> {
  const items = await getAllQueueItems();
  return items.filter(
    (i) =>
      i.createdTempId === tempId ||
      i.targetId === tempId ||
      Object.values(i.refs).includes(tempId) ||
      bodyReferencesTempId(i.body, tempId),
  );
}

function bodyReferencesTempId(body: unknown, tempId: string): boolean {
  if (body == null || typeof body !== 'object') return false;
  if ('$tempRef' in (body as Record<string, unknown>)) {
    return (body as Record<string, unknown>).$tempRef === tempId;
  }
  if (Array.isArray(body)) return body.some((v) => bodyReferencesTempId(v, tempId));
  return Object.values(body as Record<string, unknown>).some((v) => bodyReferencesTempId(v, tempId));
}
