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

export const getMetrics = (patientId: number, type?: HealthMetricType) =>
  api.get<HealthMetric[]>(`/patients/${patientId}/health-metrics${type ? `?type=${type}` : ''}`);

export const getMetricTrend = (patientId: number, type: HealthMetricType, limit = 30) =>
  api.get<MetricTrendPoint[]>(`/patients/${patientId}/health-metrics/trend?type=${type}&limit=${limit}`);

export interface CreateHealthMetricInput {
  type: HealthMetricType;
  label?: string | null;
  value: number;
  unit?: string | null;
  recordedAt: string;
  documentId?: number | null;
}

export const createMetric = (patientId: number, data: CreateHealthMetricInput) =>
  api.post<HealthMetric>(`/patients/${patientId}/health-metrics`, data);

export const deleteMetric = (patientId: number, id: number) =>
  api.delete(`/patients/${patientId}/health-metrics/${id}`);
