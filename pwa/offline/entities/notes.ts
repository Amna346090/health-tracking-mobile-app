import { cache } from '../cache';
import { localCreate, localDelete, localUpdate, newTempId } from '../mutate';
import { isTempId } from '../tempId';
import type { IdLike } from '../types';
import type { Note } from '../../api/notes';

export type { Note };
export { isTempId };

export interface OfflineNote extends Omit<Note, 'id' | 'patientId'> {
  id: IdLike;
  patientId: IdLike;
  pendingSync?: boolean;
}

function notePath(patientId: IdLike, suffix: string): { pathTemplate: string; refs: Record<string, string> } {
  const refs: Record<string, string> = {};
  const path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/notes${suffix}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  return { pathTemplate: path, refs };
}

export async function listNotesCached(patientId: IdLike): Promise<OfflineNote[]> {
  const all = await cache.list<OfflineNote>('notes');
  return all.filter((n) => String(n.patientId) === String(patientId));
}

export async function mergeNotesFromServer(patientId: IdLike, serverList: Note[]): Promise<OfflineNote[]> {
  const mine = await listNotesCached(patientId);
  const pendingIds = new Set(mine.filter((n) => n.pendingSync).map((n) => String(n.id)));
  const others = (await cache.list<OfflineNote>('notes')).filter((n) => String(n.patientId) !== String(patientId));
  const merged = await cache.replaceFromServer<OfflineNote>('notes', serverList as OfflineNote[], pendingIds);
  await cache.putMany('notes', others);
  return merged;
}

export async function createNoteOffline(patientId: IdLike, body: string, authorId: number, authorName: { firstName: string; lastName: string; role: string }): Promise<OfflineNote> {
  const tempId = newTempId('note');
  const now = new Date().toISOString();
  const record: OfflineNote = {
    id: tempId,
    patientId,
    body,
    authorId,
    createdAt: now,
    updatedAt: now,
    author: { id: authorId, ...authorName },
    pendingSync: true,
  };
  const { pathTemplate, refs } = notePath(patientId, '');
  return localCreate('notes', record, { method: 'POST', pathTemplate, refs, body: { body } });
}

export async function updateNoteOffline(patientId: IdLike, noteId: IdLike, body: string): Promise<OfflineNote> {
  const refs: Record<string, string> = {};
  let path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/notes/${isTempId(noteId) ? '${noteId}' : noteId}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(noteId)) refs.noteId = String(noteId);
  return localUpdate<OfflineNote>('notes', noteId, { body, updatedAt: new Date().toISOString() } as Partial<OfflineNote>, {
    method: 'PATCH',
    pathTemplate: path,
    refs,
    body: { body },
  });
}

export async function deleteNoteOffline(patientId: IdLike, noteId: IdLike): Promise<void> {
  const refs: Record<string, string> = {};
  let path = `/patients/${isTempId(patientId) ? '${patientId}' : patientId}/notes/${isTempId(noteId) ? '${noteId}' : noteId}`;
  if (isTempId(patientId)) refs.patientId = String(patientId);
  if (isTempId(noteId)) refs.noteId = String(noteId);
  await localDelete('notes', noteId, { method: 'DELETE', pathTemplate: path, refs });
}
