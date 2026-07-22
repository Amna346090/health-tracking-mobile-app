import { api } from './client';
import type { PatientRow } from './patients';

export interface TouchBaseQueueItem {
  id: number;
  lastContactAt: string | null;
  thresholdDays: number;
  dueAt: string;
  overdue: boolean;
  user: { firstName: string; lastName: string; email: string };
}

export interface TouchBaseSettings {
  id: number;
  defaultThresholdDays: number;
  updatedAt: string;
}

export const getTouchBaseQueue = (providerId?: number) =>
  api.get<TouchBaseQueueItem[]>(`/touch-base/queue${providerId !== undefined ? `?providerId=${providerId}` : ''}`);

export const getTouchBaseSettings = () => api.get<TouchBaseSettings>('/touch-base/settings');

export const updateTouchBaseSettings = (defaultThresholdDays: number) =>
  api.patch<TouchBaseSettings>('/touch-base/settings', { defaultThresholdDays });

export const markContacted = (patientId: number) =>
  api.post<PatientRow>(`/patients/${patientId}/contact`);
