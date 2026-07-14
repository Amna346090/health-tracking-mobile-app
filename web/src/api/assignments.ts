import { api } from './client';
import type { MedicationForm, FoodInstruction } from './medications';

export interface MedicationAssignment {
  id: number;
  patientId: number;
  medicationId: number;
  frequency: string;
  timesOfDay: string[];
  startDate: string;
  endDate: string | null;
  active: boolean;
  createdAt: string;
  medication: {
    id: number;
    name: string;
    dosage: string;
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
  frequency: string;
  timesOfDay: string[];
  startDate: string;
  endDate?: string | null;
}

export const createAssignment = (patientId: number, data: CreateAssignmentInput) =>
  api.post<MedicationAssignment>(`/patients/${patientId}/assignments`, data);
