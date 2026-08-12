import { api } from './client';
import type { Gender } from './auth';

export interface PatientRow {
  id: number;
  userId: number;
  dateOfBirth: string | null;
  gender: Gender | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  lastContactAt: string | null;
  touchBaseThresholdDays: number | null;
  touchBaseRemindersPaused: boolean;
  providerId: number | null;
  createdAt: string;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string | null };
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
  providerId?: number | null;
  touchBaseThresholdDays?: number | null;
  touchBaseRemindersPaused?: boolean;
}

export function updatePatient(id: number, data: UpdatePatientInput): Promise<PatientRow> {
  return api.patch<PatientRow>(`/patients/${id}`, data);
}
