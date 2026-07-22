import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const UPLOADER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getDocuments(
  patientId: number,
  limit = 20,
  offset = 0,
) {
  return prisma.document.findMany({
    where: { patientId },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
    orderBy: { uploadedAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
  });
}

export async function getDocumentById(id: number) {
  const document = await prisma.document.findUnique({
    where: { id },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });
  if (!document) throw new AppError('Document not found', 404);
  return document;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  patientId: number;
  url: string;
  key: string | null;
  fileType: string;
  tag?: string | null;
  appointmentId?: number | null;
  uploadedById: number;
}

export async function createDocument(data: CreateDocumentInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  if (data.appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
    if (!appointment || appointment.patientId !== data.patientId) {
      throw new AppError('Appointment does not belong to this patient', 400);
    }
  }

  return prisma.document.create({
    data: {
      patientId: data.patientId,
      url: data.url,
      key: data.key ?? null,
      fileType: data.fileType,
      tag: data.tag ?? null,
      appointmentId: data.appointmentId ?? null,
      uploadedById: data.uploadedById,
    },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });
}

// ─── Update (tag / attach to visit) ───────────────────────────────────────────

export async function updateDocument(
  id: number,
  data: Partial<{ tag: string | null; appointmentId: number | null }>,
) {
  const exists = await prisma.document.findUnique({ where: { id } });
  if (!exists) throw new AppError('Document not found', 404);

  if (data.appointmentId !== undefined && data.appointmentId !== null) {
    const appointment = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
    if (!appointment || appointment.patientId !== exists.patientId) {
      throw new AppError('Appointment does not belong to this patient', 400);
    }
  }

  return prisma.document.update({
    where: { id },
    data: {
      ...(data.tag !== undefined && { tag: data.tag }),
      ...(data.appointmentId !== undefined && { appointmentId: data.appointmentId }),
    },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Removes the DB record and returns the S3 key so the caller can clean up storage. */
export async function deleteDocument(id: number): Promise<{ key: string | null }> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, key: true, patientId: true, uploadedById: true },
  });
  if (!document) throw new AppError('Document not found', 404);
  await prisma.document.delete({ where: { id } });
  return { key: document.key };
}
