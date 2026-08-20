import { api } from './client';

export type FeelingStatus = 'GREAT' | 'GOOD' | 'OKAY' | 'POOR' | 'TERRIBLE';

export interface HealthLog {
  id: number;
  patientId: number;
  date: string;
  weight: number | null;
  height: number | null;
  feeling: FeelingStatus | null;
  notes: string | null;
  createdById: number;
  createdAt: string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface WeightDataPoint {
  date: string;
  weight: number;
}

interface ListOptions {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export function getHealthLogs(patientId: number, opts?: ListOptions): Promise<HealthLog[]> {
  const p = new URLSearchParams();
  if (opts?.from)   p.set('from',   opts.from);
  if (opts?.to)     p.set('to',     opts.to);
  if (opts?.limit)  p.set('limit',  String(opts.limit));
  if (opts?.offset) p.set('offset', String(opts.offset));
  const qs = p.toString();
  return api.get<HealthLog[]>(`/patients/${patientId}/health-logs${qs ? `?${qs}` : ''}`);
}

export function getWeightTrend(patientId: number, days = 30): Promise<WeightDataPoint[]> {
  return api.get<WeightDataPoint[]>(`/patients/${patientId}/health-logs/trend?days=${days}`);
}

export function createHealthLog(
  patientId: number,
  data: {
    date: string;
    weight?: number | null;
    height?: number | null;
    feeling?: FeelingStatus | null;
    notes?: string | null;
  },
): Promise<HealthLog> {
  return api.post<HealthLog>(`/patients/${patientId}/health-logs`, data);
}

export function updateHealthLog(
  patientId: number,
  logId: number,
  data: Partial<{
    date: string;
    weight: number | null;
    height: number | null;
    feeling: FeelingStatus | null;
    notes: string | null;
  }>,
): Promise<HealthLog> {
  return api.patch<HealthLog>(`/patients/${patientId}/health-logs/${logId}`, data);
}

export function deleteHealthLog(patientId: number, logId: number): Promise<unknown> {
  return api.delete(`/patients/${patientId}/health-logs/${logId}`);
}
