import { api } from './client';

export type MedicationForm = 'TABLET' | 'CAPSULE' | 'LIQUID' | 'INJECTION' | 'TOPICAL' | 'OTHER';
export type FoodInstruction = 'WITH_FOOD' | 'WITHOUT_FOOD' | 'EITHER';

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  form: MedicationForm | null;
  quantityPerDose: number | null;
  foodInstruction: FoodInstruction | null;
  instructions: string | null;
  prescribingNotes: string | null;
  _count: { assignments: number };
}

export function getAllMedications(search?: string): Promise<Medication[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get<Medication[]>(`/medications${qs}`);
}

export function getMedicationById(id: number): Promise<Medication> {
  return api.get<Medication>(`/medications/${id}`);
}

export interface MedicationInput {
  name: string;
  dosage: string;
  form?: MedicationForm;
  quantityPerDose?: number;
  foodInstruction?: FoodInstruction;
  instructions?: string;
  prescribingNotes?: string;
}

export function createMedication(data: MedicationInput): Promise<Medication> {
  return api.post<Medication>('/medications', data);
}

export function updateMedication(id: number, data: Partial<MedicationInput>): Promise<Medication> {
  return api.patch<Medication>(`/medications/${id}`, data);
}
