import { api } from './client';
import type { MedicationForm, FoodInstruction } from './medications';

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
  prescribedById: number | null;
  active: boolean;
  createdAt: string;
  medication: {
    id: number;
    name: string;
    dosage: string | null;
    doseAmount: number | null;
    doseUnit: string | null;
    form: MedicationForm | null;
    quantityPerDose: number | null;
    foodInstruction: FoodInstruction | null;
    instructions: string | null;
  };
}

export const getAssignments = (patientId: number, activeOnly = true) =>
  api.get<MedicationAssignment[]>(`/patients/${patientId}/assignments?active=${activeOnly}`);

export interface CreateAssignmentInput {
  medicationId: number;
  frequency?: string;
  timesPerDay?: number;
  timesOfDay?: string[];
  startDate: string;
  endDate?: string | null;
  refillsAllowed?: number;
}

export const createAssignment = (patientId: number, data: CreateAssignmentInput) =>
  api.post<MedicationAssignment>(`/patients/${patientId}/assignments`, data);

export const recordRefill = (patientId: number, id: number) =>
  api.post<MedicationAssignment>(`/patients/${patientId}/assignments/${id}/refill`);

export const prescriptionPdfPath = (patientId: number, id: number) =>
  `/patients/${patientId}/assignments/${id}/prescription.pdf`;
