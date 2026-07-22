import { api } from './client';

export interface Document {
  id: number;
  patientId: number;
  appointmentId: number | null;
  fileType: string;
  tag: string | null;
  url: string;
  key: string | null;
  uploadedById: number;
  uploadedAt: string;
  uploadedBy: { id: number; firstName: string; lastName: string; role: string };
}

export function getDocuments(patientId: number): Promise<Document[]> {
  return api.get<Document[]>(`/patients/${patientId}/documents`);
}

export function updateDocument(
  id: number,
  data: Partial<{ tag: string | null; appointmentId: number | null }>,
): Promise<Document> {
  return api.patch<Document>(`/documents/${id}`, data);
}
