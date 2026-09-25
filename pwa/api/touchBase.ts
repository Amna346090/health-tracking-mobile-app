import { api } from './client';

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

export function getTouchBaseSettingsApi(): Promise<TouchBaseSettings> {
  return api.get<TouchBaseSettings>('/touch-base/settings');
}
