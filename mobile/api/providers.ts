import { api } from './client';

export interface Provider {
  id: number;
  userId: number;
  npi: string | null;
  credentials: string | null;
  specialty: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; firstName: string; lastName: string; email: string };
}

export function getAllProviders(): Promise<Provider[]> {
  return api.get<Provider[]>('/providers');
}
