import { DoseStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

// ─── Shared selects ───────────────────────────────────────────────────────────

const MEDICATION_SELECT = {
  id: true,
  name: true,
  dosage: true,
  form: true,
  quantityPerDose: true,
  foodInstruction: true,
  instructions: true,
  prescribingNotes: true,
} as const;

const LOG_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayBounds() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function getAssignmentsForPatient(patientId: number, activeOnly = true) {
  return prisma.medicationAssignment.findMany({
    where: { patientId, ...(activeOnly ? { active: true } : {}) },
    include: { medication: { select: MEDICATION_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}

/** Returns active assignments enriched with the latest dose log for today. */
export async function getTodaySchedule(patientId: number) {
  const { start, end } = todayBounds();

  const assignments = await prisma.medicationAssignment.findMany({
    where: {
      patientId,
      active: true,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: {
      medication: { select: MEDICATION_SELECT },
      logs: {
        where: { takenAt: { gte: start, lt: end } },
        orderBy: { takenAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { medication: { name: 'asc' } },
  });

  return assignments.map(({ logs, ...rest }) => ({
    ...rest,
    todayLog: logs[0] ?? null,
  }));
}

export async function getAssignmentById(id: number) {
  const a = await prisma.medicationAssignment.findUnique({
    where: { id },
    include: {
      medication: { select: MEDICATION_SELECT },
      patient: { select: { id: true, userId: true } },
    },
  });
  if (!a) throw new AppError('Assignment not found', 404);
  return a;
}

export interface CreateAssignmentInput {
  patientId: number;
  medicationId: number;
  frequency: string;
  timesPerDay?: number;
  timesOfDay: string[];
  startDate: string;
  endDate?: string | null;
  refillsAllowed?: number;
  prescribedById?: number;
}

export async function createAssignment(data: CreateAssignmentInput) {
  const [patient, medication] = await Promise.all([
    prisma.patientProfile.findUnique({ where: { id: data.patientId } }),
    prisma.medication.findUnique({ where: { id: data.medicationId } }),
  ]);
  if (!patient) throw new AppError('Patient not found', 404);
  if (!medication) throw new AppError('Medication not found', 404);

  return prisma.medicationAssignment.create({
    data: {
      patientId: data.patientId,
      medicationId: data.medicationId,
      frequency: data.frequency,
      timesPerDay: data.timesPerDay ?? null,
      timesOfDay: data.timesOfDay,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      refillsAllowed: data.refillsAllowed ?? null,
      prescribedById: data.prescribedById ?? null,
      active: true,
    },
    include: { medication: { select: MEDICATION_SELECT } },
  });
}

export async function updateAssignment(
  id: number,
  data: Partial<{
    frequency: string;
    timesPerDay: number | null;
    timesOfDay: string[];
    startDate: string;
    endDate: string | null;
    refillsAllowed: number | null;
    active: boolean;
  }>,
) {
  const exists = await prisma.medicationAssignment.findUnique({ where: { id } });
  if (!exists) throw new AppError('Assignment not found', 404);

  return prisma.medicationAssignment.update({
    where: { id },
    data: {
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.timesPerDay !== undefined && { timesPerDay: data.timesPerDay }),
      ...(data.timesOfDay !== undefined && { timesOfDay: data.timesOfDay }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.refillsAllowed !== undefined && { refillsAllowed: data.refillsAllowed }),
      ...(data.active !== undefined && { active: data.active }),
    },
    include: { medication: { select: MEDICATION_SELECT } },
  });
}

export async function recordRefill(id: number) {
  const assignment = await prisma.medicationAssignment.findUnique({ where: { id } });
  if (!assignment) throw new AppError('Assignment not found', 404);
  if (assignment.refillsAllowed === null || assignment.refillsUsed >= assignment.refillsAllowed) {
    throw new AppError('No refills remaining', 400);
  }
  return prisma.medicationAssignment.update({
    where: { id },
    data: { refillsUsed: assignment.refillsUsed + 1 },
    include: { medication: { select: MEDICATION_SELECT } },
  });
}

export async function deactivateAssignment(id: number) {
  const exists = await prisma.medicationAssignment.findUnique({ where: { id } });
  if (!exists) throw new AppError('Assignment not found', 404);
  return prisma.medicationAssignment.update({
    where: { id },
    data: { active: false },
  });
}

// ─── Dose logs ────────────────────────────────────────────────────────────────

export async function getLogsForAssignment(
  assignmentId: number,
  limit = 30,
  offset = 0,
) {
  const assignment = await prisma.medicationAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, patient: { select: { userId: true } } },
  });
  if (!assignment) throw new AppError('Assignment not found', 404);

  return prisma.medicationLog.findMany({
    where: { assignmentId },
    orderBy: { takenAt: 'desc' },
    take: limit,
    skip: offset,
    include: { user: { select: LOG_USER_SELECT } },
  });
}

export async function logDose(
  assignmentId: number,
  loggedByUserId: number,
  loggedByRole: Role,
  status: DoseStatus,
  notes?: string,
) {
  const assignment = await prisma.medicationAssignment.findUnique({
    where: { id: assignmentId },
    include: { patient: { select: { userId: true } } },
  });
  if (!assignment) throw new AppError('Assignment not found', 404);
  if (!assignment.active) throw new AppError('This assignment is no longer active', 400);

  // Patients can only log for their own assignments
  if (loggedByRole === Role.PATIENT && assignment.patient.userId !== loggedByUserId) {
    throw new AppError('Forbidden', 403);
  }

  return prisma.medicationLog.create({
    data: {
      assignmentId,
      userId: loggedByUserId,
      status,
      notes: notes ?? null,
      takenAt: new Date(),
    },
    include: { user: { select: LOG_USER_SELECT } },
  });
}
