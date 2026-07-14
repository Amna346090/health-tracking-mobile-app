import { api } from './client';

export interface Photo {
  id: number;
  patientId: number;
  healthLogId: number | null;
  url: string;
  caption: string | null;
  uploadedAt: string;
  uploadedBy: { id: number; firstName: string; lastName: string; role: string };
}

export const getPhotos = (patientId: number) => api.get<Photo[]>(`/patients/${patientId}/photos`);
