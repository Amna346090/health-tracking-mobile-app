import { api } from './client';

export interface Note {
  id: number;
  patientId: number;
  body: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  author: { id: number; firstName: string; lastName: string; role: string };
}

export const getNotes = (patientId: number) =>
  api.get<Note[]>(`/patients/${patientId}/notes`);

export const createNote = (patientId: number, body: string) =>
  api.post<Note>(`/patients/${patientId}/notes`, { body });

export const updateNote = (patientId: number, id: number, body: string) =>
  api.patch<Note>(`/patients/${patientId}/notes/${id}`, { body });

export const deleteNote = (patientId: number, id: number) =>
  api.delete<void>(`/patients/${patientId}/notes/${id}`);
