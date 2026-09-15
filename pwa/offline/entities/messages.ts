// Messages: read-cache only. Sending a message (and marking one read) still requires being
// online by design — queuing a "sent" message that isn't actually delivered yet would be
// actively misleading, so those stay as they were. Viewing a thread already loaded works offline.
import { cache } from '../cache';
import type { Message } from '../../api/messages';

export type { Message };

export async function listMessagesCached(patientId: number): Promise<Message[]> {
  const all = await cache.list<Message>('messages');
  return all.filter((m) => m.patientId === patientId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function mergeMessagesFromServer(patientId: number, serverList: Message[]): Promise<Message[]> {
  const others = (await cache.list<Message>('messages')).filter((m) => m.patientId !== patientId);
  const merged = await cache.replaceFromServer<Message>('messages', serverList, new Set());
  await cache.putMany('messages', others);
  return merged;
}
