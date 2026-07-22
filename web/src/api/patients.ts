import { api } from './client';

export interface PatientUser {
  id: number;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface PatientRow {
  id: number;
  userId: number;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  lastContactAt: string | null;
  touchBaseThresholdDays: number | null;
  providerId: number | null;
  createdAt: string;
  user: PatientUser;
}

export const getAllPatients = (providerId?: number) =>
  api.get<PatientRow[]>(`/patients${providerId !== undefined ? `?providerId=${providerId}` : ''}`);

export const getPatientById = (id: number) => api.get<PatientRow>(`/patients/${id}`);

export interface CreatePatientInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: Gender;
  healthIssue?: string;
  phone?: string;
  address?: string;
}

interface CreatePatientResult {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  patientProfile: { id: number } | null;
}

export const createPatient = (data: CreatePatientInput) =>
  api.post<CreatePatientResult>('/auth/register', { ...data, role: 'PATIENT' });

export interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender | null;
  healthIssue?: string | null;
  phone?: string | null;
  address?: string | null;
  touchBaseThresholdDays?: number | null;
  providerId?: number | null;
}

export const updatePatient = (id: number, data: UpdatePatientInput) =>
  api.patch<PatientRow>(`/patients/${id}`, data);
