import { api } from './client';

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface Appointment {
  id: number;
  patientId: number;
  scheduledFor: string;
  reason: string | null;
  notes: string | null;
  status: AppointmentStatus;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentWithPatient extends Appointment {
  patient: {
    id: number;
    user: { firstName: string; lastName: string; email: string };
  };
}

export const getAppointments = (patientId: number) =>
  api.get<Appointment[]>(`/patients/${patientId}/appointments`);

export const getAllAppointments = (params?: { status?: AppointmentStatus; from?: string; to?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return api.get<AppointmentWithPatient[]>(`/appointments${qs ? `?${qs}` : ''}`);
};

export interface CreateAppointmentInput {
  scheduledFor: string;
  reason?: string | null;
  notes?: string | null;
}

export const createAppointment = (patientId: number, data: CreateAppointmentInput) =>
  api.post<Appointment>(`/patients/${patientId}/appointments`, data);

export interface UpdateAppointmentInput {
  scheduledFor?: string;
  reason?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
}

export const updateAppointment = (patientId: number, id: number, data: UpdateAppointmentInput) =>
  api.patch<Appointment>(`/patients/${patientId}/appointments/${id}`, data);
