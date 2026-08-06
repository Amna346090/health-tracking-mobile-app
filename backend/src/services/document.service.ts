import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logUploadAudit } from './uploadAudit.service';

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

  const document = await prisma.document.create({
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

  await logUploadAudit({
    patientId: data.patientId,
    entityType: 'DOCUMENT',
    entityId: document.id,
    action: 'UPLOADED',
    performedById: data.uploadedById,
  });

  return document;
}

// ─── Update (replace file, tag, or attach to visit) ───────────────────────────

export interface UpdateDocumentInput {
  url?: string;
  key?: string | null;
  fileType?: string;
  tag?: string | null;
  appointmentId?: number | null;
}

/** Updates the record; returns the previous S3 key so the caller can clean up storage if the file was replaced. */
export async function updateDocument(
  id: number,
  data: UpdateDocumentInput,
  performedById: number,
): Promise<{ document: Awaited<ReturnType<typeof getDocumentById>>; previousKey: string | null }> {
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError('Document not found', 404);

  if (data.appointmentId !== undefined && data.appointmentId !== null) {
    const appointment = await prisma.appointment.findUnique({ where: { id: data.appointmentId } });
    if (!appointment || appointment.patientId !== existing.patientId) {
      throw new AppError('Appointment does not belong to this patient', 400);
    }
  }

  const fileReplaced = data.url !== undefined && data.url !== existing.url;

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(data.url !== undefined && { url: data.url }),
      ...(data.key !== undefined && { key: data.key }),
      ...(data.fileType !== undefined && { fileType: data.fileType }),
      ...(data.tag !== undefined && { tag: data.tag }),
      ...(data.appointmentId !== undefined && { appointmentId: data.appointmentId }),
    },
    include: { uploadedBy: { select: UPLOADER_SELECT } },
  });

  await logUploadAudit({
    patientId: existing.patientId,
    entityType: 'DOCUMENT',
    entityId: id,
    action: 'EDITED',
    performedById,
    detail: fileReplaced ? 'Replaced file' : 'Updated tag',
  });

  return { document, previousKey: fileReplaced ? existing.key : null };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Removes the DB record and returns the S3 key so the caller can clean up storage. */
export async function deleteDocument(id: number, performedById: number): Promise<{ key: string | null }> {
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, key: true, patientId: true, uploadedById: true },
  });
  if (!document) throw new AppError('Document not found', 404);
  await prisma.document.delete({ where: { id } });

  await logUploadAudit({
    patientId: document.patientId,
    entityType: 'DOCUMENT',
    entityId: id,
    action: 'DELETED',
    performedById,
  });

  return { key: document.key };
}
