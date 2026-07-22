import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { renderPrescriptionPdf } from '../lib/pdf';

export async function getPrescriptionPdf(assignmentId: number): Promise<Buffer> {
  const assignment = await prisma.medicationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      medication: true,
      patient: { select: { id: true, userId: true, dateOfBirth: true, user: { select: { firstName: true, lastName: true } } } },
      prescribedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!assignment) throw new AppError('Assignment not found', 404);

  return renderPrescriptionPdf({
    patientName: `${assignment.patient.user.firstName} ${assignment.patient.user.lastName}`,
    patientDateOfBirth: assignment.patient.dateOfBirth.toISOString(),
    prescriberName: assignment.prescribedBy ? `${assignment.prescribedBy.firstName} ${assignment.prescribedBy.lastName}` : null,
    medicationName: assignment.medication.name,
    dosage: assignment.medication.dosage,
    doseAmount: assignment.medication.doseAmount,
    doseUnit: assignment.medication.doseUnit,
    form: assignment.medication.form,
    quantityPerDose: assignment.medication.quantityPerDose,
    frequency: assignment.frequency,
    timesPerDay: assignment.timesPerDay,
    timesOfDay: assignment.timesOfDay,
    foodInstruction: assignment.medication.foodInstruction,
    startDate: assignment.startDate.toISOString(),
    endDate: assignment.endDate ? assignment.endDate.toISOString() : null,
    refillsAllowed: assignment.refillsAllowed,
    refillsUsed: assignment.refillsUsed,
    instructions: assignment.medication.instructions,
    prescribingNotes: assignment.medication.prescribingNotes,
  });
}
