import { api } from './client';

export interface PatientUser {
  id: number;
  email: string | null;
  username: string | null;
  role: string;
  firstName: string;
  lastName: string;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

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
  providerId: number | null;
  createdAt: string;
  user: PatientUser;
}

export const getAllPatients = (providerId?: number) =>
  api.get<PatientRow[]>(`/patients${providerId !== undefined ? `?providerId=${providerId}` : ''}`);

export const getPatientById = (id: number) => api.get<PatientRow>(`/patients/${id}`);

export interface CreatePatientInput {
  firstName: string;
  phone: string;
  lastName?: string;
  email?: string;
  password?: string;
  dateOfBirth?: string;
  gender?: Gender;
  healthIssue?: string;
  address?: string;
}

export interface GeneratedCredentials {
  identifier: string;
  password?: string;
}

export interface CreatePatientResult {
  id: number;
  email: string | null;
  username: string | null;
  firstName: string;
  lastName: string;
  patientProfile: { id: number } | null;
  generatedCredentials?: GeneratedCredentials;
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
