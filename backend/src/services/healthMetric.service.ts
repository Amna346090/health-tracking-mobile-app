import { HealthMetricType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export async function getMetricsForPatient(patientId: number, type?: HealthMetricType) {
  return prisma.healthMetric.findMany({
    where: { patientId, ...(type && { type }) },
    orderBy: { recordedAt: 'desc' },
  });
}

export async function getMetricTrend(patientId: number, type: HealthMetricType, limit = 30) {
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
  type: HealthMetricType;
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
