import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Gender } from '@prisma/client';

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getAllPatients() {
  return prisma.patientProfile.findMany({
    include: { user: { select: USER_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPatientById(id: number) {
  return prisma.patientProfile.findUnique({
    where: { id },
    include: { user: { select: USER_SELECT } },
  });
}

export async function getPatientByUserId(userId: number) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    include: { user: { select: USER_SELECT } },
  });
}

interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender | null;
  healthIssue?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  address?: string | null;
}

export async function updatePatient(id: number, input: UpdatePatientInput) {
  const { firstName, lastName, dateOfBirth, gender, healthIssue, avatarUrl, phone, address } = input;

  if (dateOfBirth !== undefined && isNaN(new Date(dateOfBirth).getTime())) {
    throw new AppError('Invalid dateOfBirth format', 400);
  }

  return prisma.$transaction(async (tx) => {
    const profile = await tx.patientProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!profile) throw new AppError('Patient not found', 404);

    if (firstName !== undefined || lastName !== undefined) {
      await tx.user.update({
        where: { id: profile.userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
        },
      });
    }

    return tx.patientProfile.update({
      where: { id },
      data: {
        ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender !== undefined && { gender }),
        ...(healthIssue !== undefined && { healthIssue }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
      include: { user: { select: USER_SELECT } },
    });
  });
}
