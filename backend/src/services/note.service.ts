import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

// ─── List / Get ───────────────────────────────────────────────────────────────

export async function getNotes(patientId: number) {
  return prisma.note.findMany({
    where: { patientId },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getNoteById(id: number) {
  const note = await prisma.note.findUnique({
    where: { id },
    include: { author: { select: AUTHOR_SELECT } },
  });
  if (!note) throw new AppError('Note not found', 404);
  return note;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateNoteInput {
  patientId: number;
  body: string;
  authorId: number;
}

export async function createNote(data: CreateNoteInput) {
  const patient = await prisma.patientProfile.findUnique({ where: { id: data.patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  return prisma.note.create({
    data: {
      patientId: data.patientId,
      body: data.body,
      authorId: data.authorId,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateNote(id: number, body: string) {
  const exists = await prisma.note.findUnique({ where: { id } });
  if (!exists) throw new AppError('Note not found', 404);

  return prisma.note.update({
    where: { id },
    data: { body },
    include: { author: { select: AUTHOR_SELECT } },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteNote(id: number) {
  const exists = await prisma.note.findUnique({ where: { id } });
  if (!exists) throw new AppError('Note not found', 404);
  await prisma.note.delete({ where: { id } });
}
