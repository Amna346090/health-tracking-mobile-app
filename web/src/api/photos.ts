import { api } from './client';

export interface Photo {
  id: number;
  patientId: number;
  healthLogId: number | null;
  url: string;
  key: string | null;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: { id: number; firstName: string; lastName: string; role: string };
}

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export const getPhotos = (patientId: number) => api.get<Photo[]>(`/patients/${patientId}/photos`);

async function uploadFileToS3(patientId: number, file: File): Promise<{ url: string; key: string }> {
  const presign = await api.post<PresignResult>(`/patients/${patientId}/photos/presign`, {
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

export async function createPhoto(patientId: number, file: File, caption: string | null): Promise<Photo> {
  const { url, key } = await uploadFileToS3(patientId, file);
  return api.post<Photo>(`/patients/${patientId}/photos`, { url, key, caption });
}

export async function updatePhoto(
  patientId: number,
  id: number,
  data: { file?: File | null; caption?: string | null },
): Promise<Photo> {
  const fileFields = data.file ? await uploadFileToS3(patientId, data.file) : {};
  return api.patch<Photo>(`/photos/${id}`, {
    ...fileFields,
    ...(data.caption !== undefined && { caption: data.caption }),
  });
}

export const deletePhoto = (id: number) => api.delete<void>(`/photos/${id}`);
