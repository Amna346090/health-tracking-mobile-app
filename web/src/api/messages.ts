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

export const getMessages = (patientId: number) =>
  api.get<Message[]>(`/patients/${patientId}/messages`);

export const sendMessage = (patientId: number, body: string) =>
  api.post<Message>(`/patients/${patientId}/messages`, { body });
