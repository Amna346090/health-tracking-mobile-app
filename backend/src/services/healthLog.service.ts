import { FeelingStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const CREATED_BY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// ─── List / Get ───────────────────────────────────────────────────────────────

interface ListOptions {
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function getHealthLogs(patientId: number, opts: ListOptions = {}) {
  const { from, to, limit = 20, offset = 0 } = opts;
  return prisma.healthLog.findMany({
    where: {
      patientId,
      ...(from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
    orderBy: { date: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
  });
}

export async function getHealthLogById(id: number) {
  const log = await prisma.healthLog.findUnique({
    where: { id },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });
  if (!log) throw new AppError('Health log not found', 404);
  return log;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateHealthLogInput {
  patientId: number;
  date: string;
  weight?: number | null;
  height?: number | null;
  feeling?: FeelingStatus | null;
  notes?: string | null;
  createdById: number;
}

export async function createHealthLog(data: CreateHealthLogInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  return prisma.healthLog.create({
    data: {
      patientId: data.patientId,
      date: new Date(data.date),
      weight: data.weight ?? null,
      height: data.height ?? null,
      feeling: data.feeling ?? null,
      notes: data.notes ?? null,
      createdById: data.createdById,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateHealthLogInput {
  date?: string;
  weight?: number | null;
  height?: number | null;
  feeling?: FeelingStatus | null;
  notes?: string | null;
}

export async function updateHealthLog(id: number, data: UpdateHealthLogInput) {
  const exists = await prisma.healthLog.findUnique({ where: { id } });
  if (!exists) throw new AppError('Health log not found', 404);

  return prisma.healthLog.update({
    where: { id },
    data: {
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.height !== undefined && { height: data.height }),
      ...(data.feeling !== undefined && { feeling: data.feeling }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteHealthLog(id: number) {
  const exists = await prisma.healthLog.findUnique({ where: { id } });
  if (!exists) throw new AppError('Health log not found', 404);
  await prisma.healthLog.delete({ where: { id } });
}

// ─── Trend ────────────────────────────────────────────────────────────────────

export async function getWeightTrend(patientId: number, days = 30) {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);

  const logs = await prisma.healthLog.findMany({
    where: { patientId, date: { gte: from }, weight: { not: null } },
    select: { date: true, weight: true },
    orderBy: { date: 'asc' },
  });

  return logs.map(({ date, weight }) => ({
    date: date.toISOString().split('T')[0],
    weight: weight as number,
  }));
}
