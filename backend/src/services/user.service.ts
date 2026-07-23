import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  firstName: true,
  lastName: true,
  createdAt: true,
} as const;

export async function getAllUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function deleteUser(targetId: number, requestedById: number) {
  if (targetId === requestedById) {
    throw new AppError('You cannot delete your own account', 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError('User not found', 404);
  }

  // PatientProfile cascades on delete (logs, meds, photos, tokens, etc.), but several
  // tables also hold a *second*, ON DELETE RESTRICT reference straight to User —
  // recording who authored/logged/uploaded something (MedicationLog.userId,
  // HealthLog.createdById, Photo.uploadedById, Document.uploadedById,
  // Appointment.createdById, Message.senderId, TestRequest.requestedById,
  // HealthMetric.createdById). Postgres does not reliably resolve those RESTRICT
  // checks in favor of the sibling patientId cascade, so every row authored by
  // this user must be deleted explicitly first, regardless of role.
  const [healthLogs, photos, medicationLogs, documents, appointments, messages, testRequests, healthMetrics] =
    await Promise.all([
      prisma.healthLog.count({ where: { createdById: targetId } }),
      prisma.photo.count({ where: { uploadedById: targetId } }),
      prisma.medicationLog.count({ where: { userId: targetId } }),
      prisma.document.count({ where: { uploadedById: targetId } }),
      prisma.appointment.count({ where: { createdById: targetId } }),
      prisma.message.count({ where: { senderId: targetId } }),
      prisma.testRequest.count({ where: { requestedById: targetId } }),
      prisma.healthMetric.count({ where: { createdById: targetId } }),
    ]);
  const total = healthLogs + photos + medicationLogs + documents + appointments + messages + testRequests + healthMetrics;

  // STAFF/ADMIN accounts have no PatientProfile cascade to fall back on, so if they
  // authored records for patients they aren't the sole owner of, block deletion
  // rather than silently wiping other patients' history as a side effect.
  if (target.role !== 'PATIENT' && total > 0) {
    throw new AppError(
      `Cannot delete: this account has ${total} historical record(s) tied to it. Reassign or archive them first.`,
      409,
    );
  }

  const patientProfile = target.role === 'PATIENT' ? await prisma.patientProfile.findUnique({ where: { userId: targetId } }) : null;

  await prisma.$transaction([
    ...(patientProfile
      ? [
          prisma.medicationLog.deleteMany({ where: { assignment: { patientId: patientProfile.id } } }),
          prisma.reminderLog.deleteMany({ where: { assignment: { patientId: patientProfile.id } } }),
        ]
      : []),
    prisma.medicationLog.deleteMany({ where: { userId: targetId } }),
    prisma.healthLog.deleteMany({ where: { createdById: targetId } }),
    prisma.photo.deleteMany({ where: { uploadedById: targetId } }),
    prisma.document.deleteMany({ where: { uploadedById: targetId } }),
    prisma.appointment.deleteMany({ where: { createdById: targetId } }),
    prisma.message.deleteMany({ where: { senderId: targetId } }),
    prisma.testRequest.deleteMany({ where: { requestedById: targetId } }),
    prisma.healthMetric.deleteMany({ where: { createdById: targetId } }),
    prisma.user.delete({ where: { id: targetId } }),
  ]);
}

export async function resetPassword(targetId: number, newPassword: string) {
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw new AppError('User not found', 404);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { passwordHash } }),
    // Force the account to re-authenticate everywhere with the new password.
    prisma.refreshToken.deleteMany({ where: { userId: targetId } }),
  ]);
}
