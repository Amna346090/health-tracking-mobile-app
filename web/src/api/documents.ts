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

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export function getDocuments(patientId: number): Promise<Document[]> {
  return api.get<Document[]>(`/patients/${patientId}/documents`);
}

async function uploadFileToS3(patientId: number, file: File): Promise<{ url: string; key: string }> {
  const presign = await api.post<PresignResult>(`/patients/${patientId}/documents/presign`, {
    filename: file.name,
    contentType: file.type,
  });
  const res = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
  return { url: presign.publicUrl, key: presign.key };
}

export async function createDocument(
  patientId: number,
  file: File,
  data: { tag?: string | null; appointmentId?: number | null },
): Promise<Document> {
  const { url, key } = await uploadFileToS3(patientId, file);
  return api.post<Document>(`/patients/${patientId}/documents`, {
    url,
    key,
    fileType: file.type,
    tag: data.tag ?? null,
    appointmentId: data.appointmentId ?? null,
  });
}

export async function updateDocument(
  patientId: number,
  id: number,
  data: { file?: File | null; tag?: string | null; appointmentId?: number | null },
): Promise<Document> {
  const fileFields = data.file
    ? { ...(await uploadFileToS3(patientId, data.file)), fileType: data.file.type }
    : {};
  return api.patch<Document>(`/documents/${id}`, {
    ...fileFields,
    ...(data.tag !== undefined && { tag: data.tag }),
    ...(data.appointmentId !== undefined && { appointmentId: data.appointmentId }),
  });
}

export const deleteDocument = (id: number) => api.delete<void>(`/documents/${id}`);
