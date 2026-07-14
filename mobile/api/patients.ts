import { api } from './client';
import type { Gender } from './auth';

export interface PatientRow {
  id: number;
  userId: number;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email: string };
}

export function getPatientById(id: number): Promise<PatientRow> {
  return api.get<PatientRow>(`/patients/${id}`);
}

export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender | null;
  healthIssue?: string | null;
  phone?: string | null;
  address?: string | null;
}

export function updatePatient(id: number, data: UpdatePatientInput): Promise<PatientRow> {
  return api.patch<PatientRow>(`/patients/${id}`, data);
}
