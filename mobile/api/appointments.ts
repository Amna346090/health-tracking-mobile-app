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

export function getAppointments(patientId: number): Promise<Appointment[]> {
  return api.get<Appointment[]>(`/patients/${patientId}/appointments`);
}

export interface AppointmentWithPatient extends Appointment {
  patient: { id: number; user: { firstName: string; lastName: string; email: string } };
}

export function getAllAppointments(): Promise<AppointmentWithPatient[]> {
  return api.get<AppointmentWithPatient[]>('/appointments');
}

export function createAppointment(
  patientId: number,
  data: { scheduledFor: string; reason?: string | null; notes?: string | null },
): Promise<Appointment> {
  return api.post<Appointment>(`/patients/${patientId}/appointments`, data);
}

export function updateAppointment(
  patientId: number,
  id: number,
  data: Partial<{ scheduledFor: string; reason: string | null; status: AppointmentStatus }>,
): Promise<Appointment> {
  return api.patch<Appointment>(`/patients/${patientId}/appointments/${id}`, data);
}
