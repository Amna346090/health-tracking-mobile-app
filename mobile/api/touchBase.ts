import { api } from './client';

export interface TouchBaseQueueItem {
  id: number;
  lastContactAt: string | null;
  thresholdDays: number;
  dueAt: string;
  overdue: boolean;
  user: { firstName: string; lastName: string; email: string };
}

export function getTouchBaseQueue(): Promise<TouchBaseQueueItem[]> {
  return api.get<TouchBaseQueueItem[]>('/touch-base/queue');
}

export function markContacted(patientId: number): Promise<{ lastContactAt: string }> {
  return api.post<{ lastContactAt: string }>(`/patients/${patientId}/contact`);
}
