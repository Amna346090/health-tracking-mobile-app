import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getMetricsForPatient(patientId: number, type?: string) {
  return prisma.healthMetric.findMany({
    where: { patientId, ...(type && { type }) },
    orderBy: { recordedAt: 'desc' },
  });
}

/** Distinct category names this patient has at least one entry for — drives the picker chips. */
export async function getMetricTypesForPatient(patientId: number): Promise<string[]> {
  const rows = await prisma.healthMetric.findMany({
    where: { patientId },
    distinct: ['type'],
    select: { type: true },
    orderBy: { type: 'asc' },
  });
  return rows.map((r) => r.type);
}

export async function getMetricTrend(patientId: number, type: string, limit = 30) {
  const metrics = await prisma.healthMetric.findMany({
    where: { patientId, type },
    select: { recordedAt: true, value: true },
    orderBy: { recordedAt: 'asc' },
    take: limit,
  });

  return metrics.map(({ recordedAt, value }) => ({
    date: recordedAt.toISOString().split('T')[0],
    value,
  }));
}

export interface CreateHealthMetricInput {
  patientId: number;
  type: string;
  label?: string | null;
  value: number;
  unit?: string | null;
  recordedAt: string;
  documentId?: number | null;
  createdById: number;
}

export async function createMetric(data: CreateHealthMetricInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  if (data.documentId) {
    const document = await prisma.document.findUnique({ where: { id: data.documentId } });
    if (!document || document.patientId !== data.patientId) {
      throw new AppError('Document does not belong to this patient', 400);
    }
  }

  return prisma.healthMetric.create({
    data: {
      patientId: data.patientId,
      type: data.type,
      label: data.label ?? null,
      value: data.value,
      unit: data.unit ?? null,
      recordedAt: new Date(data.recordedAt),
      documentId: data.documentId ?? null,
      createdById: data.createdById,
    },
  });
}

export async function deleteMetric(id: number) {
  const exists = await prisma.healthMetric.findUnique({ where: { id } });
  if (!exists) throw new AppError('Health metric not found', 404);
  await prisma.healthMetric.delete({ where: { id } });
}

export async function getMetricById(id: number) {
  const metric = await prisma.healthMetric.findUnique({
    where: { id },
    include: { patient: { select: { id: true, userId: true } } },
  });
  if (!metric) throw new AppError('Health metric not found', 404);
  return metric;
}
