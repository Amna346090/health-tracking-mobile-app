import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { MedicationForm, FoodInstruction } from '@prisma/client';

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

export async function getAllMedications(search?: string) {
  return prisma.medication.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { dosage: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: { _count: { select: { assignments: { where: { active: true } } } } },
    orderBy: { name: 'asc' },
  });
}

export async function getMedicationById(id: number) {
  const med = await prisma.medication.findUnique({
    where: { id },
    include: { _count: { select: { assignments: { where: { active: true } } } } },
  });
  if (!med) throw new AppError('Medication not found', 404);
  return med;
}

export async function createMedication(data: CreateMedicationInput) {
  return prisma.medication.create({ data });
}

export async function updateMedication(id: number, data: Partial<CreateMedicationInput>) {
  const exists = await prisma.medication.findUnique({ where: { id } });
  if (!exists) throw new AppError('Medication not found', 404);
  return prisma.medication.update({ where: { id }, data });
}

export async function deleteMedication(id: number) {
  const exists = await prisma.medication.findUnique({ where: { id } });
  if (!exists) throw new AppError('Medication not found', 404);

  const assignmentCount = await prisma.medicationAssignment.count({ where: { medicationId: id } });
  if (assignmentCount > 0) {
    throw new AppError(
      `Cannot delete: ${assignmentCount} patient assignment(s) reference this medication. Remove those assignments first.`,
      409,
    );
  }

  await prisma.medication.delete({ where: { id } });
}
