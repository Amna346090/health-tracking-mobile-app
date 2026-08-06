import { UploadAuditAction, UploadEntityType } from '@prisma/client';
import prisma from '../lib/prisma';

const PERFORMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

export interface LogUploadAuditInput {
  patientId: number;
  entityType: UploadEntityType;
  entityId: number;
  action: UploadAuditAction;
  performedById: number;
  detail?: string | null;
}

export async function logUploadAudit(data: LogUploadAuditInput): Promise<void> {
  await prisma.uploadAuditLog.create({
    data: {
      patientId: data.patientId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      performedById: data.performedById,
      detail: data.detail ?? null,
    },
  });
}

export async function getUploadHistoryForPatient(patientId: number, limit = 100) {
  return prisma.uploadAuditLog.findMany({
    where: { patientId },
    include: { performedBy: { select: PERFORMER_SELECT } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
}
