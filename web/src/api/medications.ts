import { api } from './client';

export type MedicationForm = 'TABLET' | 'CAPSULE' | 'LIQUID' | 'INJECTION' | 'TOPICAL' | 'OTHER';
export type FoodInstruction = 'WITH_FOOD' | 'WITHOUT_FOOD' | 'EITHER';

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  doseAmount: number | null;
  doseUnit: string | null;
  form: MedicationForm | null;
  quantityPerDose: number | null;
  foodInstruction: FoodInstruction | null;
  instructions: string | null;
  prescribingNotes: string | null;
  _count: { assignments: number };
}

export const getAllMedications = () => api.get<Medication[]>('/medications');

export interface CreateMedicationInput {
  name: string;
  dosage: string;
  doseAmount?: number;
  doseUnit?: string;
  form?: MedicationForm;
  quantityPerDose?: number;
  foodInstruction?: FoodInstruction;
  instructions?: string;
  prescribingNotes?: string;
}

export const createMedication = (data: CreateMedicationInput) =>
  api.post<Medication>('/medications', data);
