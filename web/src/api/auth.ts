const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export interface PatientProfile {
  id: number;
  userId: number;
  dateOfBirth: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string | null;
  username: string | null;
  role: 'PATIENT' | 'STAFF' | 'ADMIN';
  firstName: string;
  lastName: string;
  notifPush: boolean;
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

export const loginApi = (identifier: string, password: string) =>
  post<LoginResult>('/auth/login', { identifier, password });

export const refreshApi = (refreshToken: string) =>
  post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });

export const logoutApi = (refreshToken: string) => post<unknown>('/auth/logout', { refreshToken });
