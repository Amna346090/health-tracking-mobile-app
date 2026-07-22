import { AppointmentStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const PATIENT_SUMMARY_SELECT = {
  id: true,
  user: { select: { firstName: true, lastName: true, email: true } },
} as const;

export async function getAppointmentsForPatient(patientId: number) {
  return prisma.appointment.findMany({
    where: { patientId },
    orderBy: { scheduledFor: 'asc' },
  });
}

export interface AppointmentFilters {
  status?: AppointmentStatus;
  from?: string;
  to?: string;
}

export async function getAllAppointments(filters: AppointmentFilters = {}) {
  const { status, from, to } = filters;
  return prisma.appointment.findMany({
    where: {
      ...(status && { status }),
      ...((from || to) && {
        scheduledFor: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    },
    include: { patient: { select: PATIENT_SUMMARY_SELECT } },
    orderBy: { scheduledFor: 'asc' },
  });
}

export async function getAppointmentById(id: number) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: { select: { id: true, userId: true } } },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);
  return appointment;
}

export interface CreateAppointmentInput {
  patientId: number;
  scheduledFor: string;
  reason?: string | null;
  notes?: string | null;
  createdById: number;
}

export async function createAppointment(data: CreateAppointmentInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  const scheduledFor = new Date(data.scheduledFor);
  scheduledFor.setSeconds(0, 0);

  return prisma.appointment.create({
    data: {
      patientId: data.patientId,
      scheduledFor,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      createdById: data.createdById,
      status: AppointmentStatus.SCHEDULED,
    },
  });
}

export interface UpdateAppointmentInput {
  scheduledFor?: string;
  reason?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
}

export async function updateAppointment(id: number, data: UpdateAppointmentInput) {
  const exists = await prisma.appointment.findUnique({ where: { id } });
  if (!exists) throw new AppError('Appointment not found', 404);

  const wasRescheduled = data.scheduledFor !== undefined
    && new Date(data.scheduledFor).getTime() !== exists.scheduledFor.getTime();

  const scheduledFor = data.scheduledFor !== undefined ? new Date(data.scheduledFor) : undefined;
  if (scheduledFor) scheduledFor.setSeconds(0, 0);

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...(scheduledFor !== undefined && { scheduledFor }),
      ...(data.reason !== undefined && { reason: data.reason }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.status !== undefined && { status: data.status }),
      ...(wasRescheduled && data.status === undefined && { status: AppointmentStatus.RESCHEDULED }),
    },
  });

  // A completed appointment counts as staff contact — resets the touch-base countdown.
  if (data.status === AppointmentStatus.COMPLETED) {
    await prisma.patientProfile.update({
      where: { id: exists.patientId },
      data: { lastContactAt: new Date() },
    });
  }

  return updated;
}
