import { api } from './client';

export type MedLogEvent = {
  type: 'MEDICATION_LOG';
  id: number;
  timestamp: string;
  status: 'TAKEN' | 'MISSED' | 'SKIPPED';
  notes: string | null;
  medication: { name: string; dosage: string };
  loggedBy: { id: number; firstName: string; lastName: string; role: string };
};

export type HealthLogEvent = {
  type: 'HEALTH_LOG';
  id: number;
  timestamp: string;
  date: string;
  weight: number | null;
  height: number | null;
  feeling: string | null;
  notes: string | null;
  createdBy: { id: number; firstName: string; lastName: string; role: string };
};

export type PhotoEvent = {
  type: 'PHOTO';
  id: number;
  timestamp: string;
  url: string;
  caption: string | null;
  uploadedBy: { id: number; firstName: string; lastName: string; role: string };
};

export type TimelineEvent = MedLogEvent | HealthLogEvent | PhotoEvent;

export interface AdherenceStat {
  taken: number;
  total: number;
  rate: number | null;
}

export interface PatientSummary {
  adherence: {
    last7d: AdherenceStat;
    last30d: AdherenceStat;
  };
  weight: {
    latest: number | null;
    date: string | null;
    trend: 'UP' | 'DOWN' | 'STABLE' | null;
  };
  daysSinceLastLog: number | null;
  totalPhotos: number;
}

export async function getTimeline(
  patientId: number,
  opts: { limit?: number; before?: string } = {},
): Promise<TimelineEvent[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', opts.before);
  const qs = params.toString();
  return api.get<TimelineEvent[]>(`/patients/${patientId}/timeline${qs ? `?${qs}` : ''}`);
}

export async function getSummary(patientId: number): Promise<PatientSummary> {
  return api.get<PatientSummary>(`/patients/${patientId}/summary`);
}
