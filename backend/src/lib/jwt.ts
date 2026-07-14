import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AccessTokenPayload {
  sub: number;
  role: Role;
}

function secret(envVar: string): string {
  const val = process.env[envVar];
  if (!val) throw new Error(`Missing env var: ${envVar}`);
  return val;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, secret('JWT_ACCESS_SECRET'), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ sub: userId }, secret('JWT_REFRESH_SECRET'), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, secret('JWT_ACCESS_SECRET')) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { sub: number } {
  return jwt.verify(token, secret('JWT_REFRESH_SECRET')) as unknown as { sub: number };
}
