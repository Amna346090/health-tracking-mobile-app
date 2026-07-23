import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Role, Gender } from '@prisma/client';
import prisma from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { AppError } from '../middleware/errorHandler';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  firstName: true,
  lastName: true,
  notifPush: true,
  notifEmail: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Excludes visually ambiguous characters (0/O, 1/I/l) since this gets read aloud/copied by staff.
const PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generatePassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
  }
  return out;
}

async function generateUsername(firstName: string, lastName?: string): Promise<string> {
  const base = `${firstName}${lastName ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  let candidate = base;
  let attempt = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    attempt++;
    const digits = attempt < 5 ? 3 : 5;
    candidate = `${base}${crypto.randomInt(10 ** (digits - 1), 10 ** digits)}`;
  }
  return candidate;
}

interface RegisterInput {
  email?: string;
  password?: string;
  role?: Role;
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  healthIssue?: string;
  phone?: string;
  address?: string;
}

export interface GeneratedCredentials {
  identifier: string;
  password?: string;
}

export async function register(input: RegisterInput, requestedByRole: Role) {
  const { email, password, role = Role.PATIENT, firstName, lastName, dateOfBirth, gender, healthIssue, phone, address } = input;

  // Only admins may create STAFF/ADMIN accounts; staff may only create patients.
  if (role !== Role.PATIENT && requestedByRole !== Role.ADMIN) {
    throw new AppError('Only admins can create staff or admin accounts', 403);
  }

  if (role === Role.PATIENT) {
    if (!phone?.trim()) throw new AppError('phone is required for patient accounts', 400);
  } else if (!email?.trim() || !password) {
    throw new AppError('email and password are required for staff/admin accounts', 400);
  }

  if (email) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError('Email already registered', 409);
  }

  if (dateOfBirth && isNaN(new Date(dateOfBirth).getTime())) {
    throw new AppError('Invalid dateOfBirth format', 400);
  }

  // No email means there's no way to log in unless we hand the account a username.
  const generatedUsername = email ? undefined : await generateUsername(firstName, lastName);

  const passwordWasGenerated = !password;
  const finalPassword = password ?? generatePassword();
  const passwordHash = await bcrypt.hash(finalPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: email ?? null,
      username: generatedUsername ?? null,
      passwordHash,
      role,
      firstName,
      lastName: lastName?.trim() || '',
      ...(role === Role.PATIENT && {
        patientProfile: {
          create: {
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender: gender ?? null,
            healthIssue: healthIssue ?? null,
            phone: phone ?? null,
            address: address ?? null,
          },
        },
      }),
      ...(role === Role.STAFF && {
        provider: { create: {} },
      }),
    },
    select: {
      ...SAFE_USER_SELECT,
      patientProfile: true,
    },
  });

  const generatedCredentials: GeneratedCredentials | undefined =
    generatedUsername || passwordWasGenerated
      ? {
          identifier: generatedUsername ?? email!,
          ...(passwordWasGenerated && { password: finalPassword }),
        }
      : undefined;

  return { ...user, generatedCredentials };
}

export async function login(identifier: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: {
      ...SAFE_USER_SELECT,
      passwordHash: true,
      patientProfile: true,
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Invalid credentials', 401);
  }

  const { passwordHash: _omit, ...safeUser } = user;

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshTokenValue = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      token: refreshTokenValue,
      userId: user.id,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  });

  return { user: safeUser, accessToken, refreshToken: refreshTokenValue };
}

export async function refresh(token: string) {
  let payload: { sub: number };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError('Invalid or expired refresh token', 401);

  // Rotate: delete old, issue new pair
  await prisma.refreshToken.delete({ where: { token } });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const newRefreshToken = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...SAFE_USER_SELECT,
      patientProfile: true,
    },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new AppError('User not found', 404);

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect', 401);
  }
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Invalidate other sessions — this device's access token stays valid until it expires.
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

export async function registerPushToken(userId: number, token: string) {
  await prisma.user.update({ where: { id: userId }, data: { pushToken: token } });
}

export async function updateNotificationSettings(
  userId: number,
  data: { notifPush?: boolean; notifEmail?: boolean },
) {
  return prisma.user.update({
    where:  { id: userId },
    data:   {
      ...(data.notifPush  !== undefined && { notifPush:  data.notifPush }),
      ...(data.notifEmail !== undefined && { notifEmail: data.notifEmail }),
    },
    select: SAFE_USER_SELECT,
  });
}
