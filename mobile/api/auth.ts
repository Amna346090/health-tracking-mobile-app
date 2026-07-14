// Public auth endpoints — use plain fetch so the 401-retry loop never fires.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface PatientProfile {
  id: number;
  userId: number;
  dateOfBirth: string;
  gender: Gender | null;
  healthIssue: string | null;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: 'PATIENT' | 'STAFF' | 'ADMIN';
  firstName: string;
  lastName: string;
  notifPush:  boolean;
  notifEmail: boolean;
  createdAt: string;
  updatedAt: string;
  patientProfile: PatientProfile | null;
}

interface ApiOk<T> {
  status: 'ok';
  data: T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return (json as ApiOk<T>).data;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  healthIssue?: string;
  phone?: string;
  role?: 'PATIENT' | 'STAFF' | 'ADMIN';
}

export const loginApi = (email: string, password: string) =>
  post<LoginResult>('/auth/login', { email, password });

export const registerApi = (data: RegisterInput) =>
  post<AuthUser>('/auth/register', data);

export const refreshApi = (refreshToken: string) =>
  post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });

export const logoutApi = (refreshToken: string) =>
  post<unknown>('/auth/logout', { refreshToken });
