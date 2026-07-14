import { api } from './client';
import type { WeightPoint } from '../components/WeightChart';

export const getWeightTrend = (patientId: number, days = 30) =>
  api.get<WeightPoint[]>(`/patients/${patientId}/health-logs/trend?days=${days}`);
