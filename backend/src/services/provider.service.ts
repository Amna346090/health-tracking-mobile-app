import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

export async function getAllProviders() {
  return prisma.provider.findMany({
    include: { user: { select: USER_SELECT } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getProviderById(id: number) {
  return prisma.provider.findUnique({
    where: { id },
    include: { user: { select: USER_SELECT } },
  });
}

export async function getProviderByUserId(userId: number) {
  return prisma.provider.findUnique({
    where: { userId },
  });
}

export interface UpdateProviderInput {
  npi?: string | null;
  credentials?: string | null;
  specialty?: string | null;
}

export async function updateProvider(id: number, data: UpdateProviderInput) {
  const exists = await prisma.provider.findUnique({ where: { id } });
  if (!exists) throw new AppError('Provider not found', 404);

  return prisma.provider.update({
    where: { id },
    data: {
      ...(data.npi !== undefined && { npi: data.npi }),
      ...(data.credentials !== undefined && { credentials: data.credentials }),
      ...(data.specialty !== undefined && { specialty: data.specialty }),
    },
    include: { user: { select: USER_SELECT } },
  });
}
