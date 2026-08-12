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

/**
 * Staff functionality is currently hidden from the UI — going forward there's
 * a single admin. New patients default onto that admin's panel (instead of
 * unassigned) so a future re-enabled staff member doesn't see them by default.
 * Creates the admin's Provider row on first use since ADMIN accounts don't get
 * one automatically at registration (only STAFF does).
 */
export async function getOrCreateAdminProvider() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!admin) return null;

  const existing = await prisma.provider.findUnique({ where: { userId: admin.id } });
  if (existing) return existing;

  return prisma.provider.create({ data: { userId: admin.id } });
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
