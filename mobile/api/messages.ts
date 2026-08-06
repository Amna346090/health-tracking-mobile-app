import { api } from './client';

export interface Message {
  id: number;
  patientId: number;
  senderId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: number; firstName: string; lastName: string; role: string };
}

export function getMessages(patientId: number): Promise<Message[]> {
  return api.get<Message[]>(`/patients/${patientId}/messages`);
}

export function markMessageRead(patientId: number, id: number): Promise<Message> {
  return api.patch<Message>(`/patients/${patientId}/messages/${id}/read`);
}

export function sendMessage(patientId: number, body: string): Promise<Message> {
  return api.post<Message>(`/patients/${patientId}/messages`, { body });
}
