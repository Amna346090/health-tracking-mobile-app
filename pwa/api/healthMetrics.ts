import { api } from './client';

export type HealthMetricType =
  | 'CHOLESTEROL_TOTAL'
  | 'CHOLESTEROL_LDL'
  | 'CHOLESTEROL_HDL'
  | 'TRIGLYCERIDES'
  | 'BLOOD_GLUCOSE'
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'OTHER';

export const HEALTH_METRIC_TYPE_LABEL: Record<HealthMetricType, string> = {
  CHOLESTEROL_TOTAL: 'Total Cholesterol',
  CHOLESTEROL_LDL: 'LDL Cholesterol',
  CHOLESTEROL_HDL: 'HDL Cholesterol',
  TRIGLYCERIDES: 'Triglycerides',
  BLOOD_GLUCOSE: 'Blood Glucose',
  BLOOD_PRESSURE_SYSTOLIC: 'Blood Pressure (Systolic)',
  BLOOD_PRESSURE_DIASTOLIC: 'Blood Pressure (Diastolic)',
  OTHER: 'Other',
};

export const HEALTH_METRIC_TYPES: HealthMetricType[] = [
  'CHOLESTEROL_TOTAL', 'CHOLESTEROL_LDL', 'CHOLESTEROL_HDL', 'TRIGLYCERIDES',
  'BLOOD_GLUCOSE', 'BLOOD_PRESSURE_SYSTOLIC', 'BLOOD_PRESSURE_DIASTOLIC', 'OTHER',
];

export interface HealthMetric {
  id: number;
  patientId: number;
  type: HealthMetricType;
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

export function getMetrics(patientId: number, type?: HealthMetricType): Promise<HealthMetric[]> {
  return api.get<HealthMetric[]>(`/patients/${patientId}/health-metrics${type ? `?type=${type}` : ''}`);
}

export function getMetricTrend(patientId: number, type: HealthMetricType, limit = 30): Promise<MetricTrendPoint[]> {
  return api.get<MetricTrendPoint[]>(`/patients/${patientId}/health-metrics/trend?type=${type}&limit=${limit}`);
}

export interface CreateHealthMetricInput {
  type: HealthMetricType;
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
