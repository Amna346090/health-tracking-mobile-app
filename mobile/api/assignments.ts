import { api } from './client';

export type DoseStatus = 'TAKEN' | 'MISSED' | 'SKIPPED';

export interface MedicationLog {
  id: number;
  assignmentId: number;
  userId: number;
  status: DoseStatus;
  takenAt: string;
  notes: string | null;
  user: { id: number; firstName: string; lastName: string; role: string };
}

export interface MedicationAssignment {
  id: number;
  patientId: number;
  medicationId: number;
  frequency: string | null;
  timesPerDay: number | null;
  timesOfDay: string[];
  startDate: string;
  endDate: string | null;
  refillsAllowed: number | null;
  refillsUsed: number;
  active: boolean;
  createdAt: string;
  medication: {
    id: number;
    name: string;
    dosage: string | null;
    doseAmount: number | null;
    doseUnit: string | null;
    form: string | null;
    quantityPerDose: number | null;
    foodInstruction: string | null;
    instructions: string | null;
    prescribingNotes: string | null;
  };
}

export interface TodayScheduleItem extends MedicationAssignment {
  todayLog: MedicationLog | null;
}

export function getAssignments(patientId: number, activeOnly = true): Promise<MedicationAssignment[]> {
  return api.get<MedicationAssignment[]>(
    `/patients/${patientId}/assignments?active=${activeOnly}`,
  );
}

export function getTodaySchedule(patientId: number): Promise<TodayScheduleItem[]> {
  return api.get<TodayScheduleItem[]>(`/patients/${patientId}/assignments/today`);
}

export function createAssignment(
  patientId: number,
  data: {
    medicationId: number;
    frequency: string;
    timesOfDay: string[];
    startDate: string;
    endDate?: string | null;
  },
): Promise<MedicationAssignment> {
  return api.post<MedicationAssignment>(`/patients/${patientId}/assignments`, data);
}

export function prescriptionPdfPath(patientId: number, id: number): string {
  return `/patients/${patientId}/assignments/${id}/prescription.pdf`;
}

export function getLogsForAssignment(
  assignmentId: number,
  limit = 30,
  offset = 0,
): Promise<MedicationLog[]> {
  return api.get<MedicationLog[]>(
    `/assignments/${assignmentId}/logs?limit=${limit}&offset=${offset}`,
  );
}

export function logDose(
  assignmentId: number,
  data: { status: DoseStatus; notes?: string },
): Promise<MedicationLog> {
  return api.post<MedicationLog>(`/assignments/${assignmentId}/logs`, data);
}
