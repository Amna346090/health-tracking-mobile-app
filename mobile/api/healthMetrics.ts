import { api } from './client';

export interface HealthMetric {
  id: number;
  patientId: number;
  type: string;
  label: string | null;
  value: number;
  unit: string | null;
  recordedAt: string;
  documentId: number | null;
  createdById: number;
  createdAt: string;
}

export interface MetricTrendPoint {
  date: string;
  value: number;
}

/** Category names this client has at least one entry for — drives the picker chips. */
export function getMetricTypes(patientId: number): Promise<string[]> {
  return api.get<string[]>(`/patients/${patientId}/health-metrics/types`);
}

export function getMetrics(patientId: number, type?: string): Promise<HealthMetric[]> {
  return api.get<HealthMetric[]>(
    `/patients/${patientId}/health-metrics${type ? `?type=${encodeURIComponent(type)}` : ''}`,
  );
}

export function getMetricTrend(patientId: number, type: string, limit = 30): Promise<MetricTrendPoint[]> {
  return api.get<MetricTrendPoint[]>(
    `/patients/${patientId}/health-metrics/trend?type=${encodeURIComponent(type)}&limit=${limit}`,
  );
}

export interface CreateHealthMetricInput {
  type: string;
  label?: string | null;
  value: number;
  unit?: string | null;
  recordedAt: string;
  documentId?: number | null;
}

export function createMetric(patientId: number, data: CreateHealthMetricInput): Promise<HealthMetric> {
  return api.post<HealthMetric>(`/patients/${patientId}/health-metrics`, data);
}

export function deleteMetric(patientId: number, id: number): Promise<unknown> {
  return api.delete(`/patients/${patientId}/health-metrics/${id}`);
}
