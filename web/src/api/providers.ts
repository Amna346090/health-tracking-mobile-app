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

export const getAllProviders = () => api.get<Provider[]>('/providers');

export interface UpdateProviderInput {
  npi?: string | null;
  credentials?: string | null;
  specialty?: string | null;
}

export const updateProvider = (id: number, data: UpdateProviderInput) =>
  api.patch<Provider>(`/providers/${id}`, data);
