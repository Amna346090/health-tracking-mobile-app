import { api } from './client';

export function markContacted(patientId: number): Promise<{ lastContactAt: string }> {
  return api.post<{ lastContactAt: string }>(`/patients/${patientId}/contact`);
}
