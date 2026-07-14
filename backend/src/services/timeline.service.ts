import { DoseStatus } from '@prisma/client';
import prisma from '../lib/prisma';

// ─── Unified event types ──────────────────────────────────────────────────────

const ACTOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

export type TimelineEvent =
  | {
      type: 'MEDICATION_LOG';
      id: number;
      timestamp: string;
      status: DoseStatus;
      notes: string | null;
      medication: { name: string; dosage: string };
      loggedBy: { id: number; firstName: string; lastName: string; role: string };
    }
  | {
      type: 'HEALTH_LOG';
      id: number;
      timestamp: string;
      date: string;
      weight: number | null;
      height: number | null;
      feeling: string | null;
      notes: string | null;
      createdBy: { id: number; firstName: string; lastName: string; role: string };
    }
  | {
      type: 'PHOTO';
      id: number;
      timestamp: string;
      url: string;
      caption: string | null;
      uploadedBy: { id: number; firstName: string; lastName: string; role: string };
    };

// ─── Timeline ─────────────────────────────────────────────────────────────────

export async function getTimeline(
  patientId: number,
  limit: number,
  before?: Date,
): Promise<TimelineEvent[]> {
  // Fetch `limit` items from each source (over-fetches slightly; sliced after merge)
  const [medLogs, healthLogs, photos] = await Promise.all([
    prisma.medicationLog.findMany({
      where: {
        assignment: { patientId },
        ...(before ? { takenAt: { lt: before } } : {}),
      },
      orderBy: { takenAt: 'desc' },
      take: limit,
      include: {
        assignment: { include: { medication: { select: { name: true, dosage: true } } } },
        user:       { select: ACTOR_SELECT },
      },
    }),
    prisma.healthLog.findMany({
      where: {
        patientId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { createdBy: { select: ACTOR_SELECT } },
    }),
    prisma.photo.findMany({
      where: {
        patientId,
        ...(before ? { uploadedAt: { lt: before } } : {}),
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      include: { uploadedBy: { select: ACTOR_SELECT } },
    }),
  ]);

  const events: TimelineEvent[] = [
    ...medLogs.map((l) => ({
      type:       'MEDICATION_LOG' as const,
      id:         l.id,
      timestamp:  l.takenAt.toISOString(),
      status:     l.status,
      notes:      l.notes,
      medication: l.assignment.medication,
      loggedBy:   l.user,
    })),
    ...healthLogs.map((l) => ({
      type:      'HEALTH_LOG' as const,
      id:        l.id,
      timestamp: l.createdAt.toISOString(),
      date:      l.date.toISOString().split('T')[0],
      weight:    l.weight,
      height:    l.height,
      feeling:   l.feeling,
      notes:     l.notes,
      createdBy: l.createdBy,
    })),
    ...photos.map((p) => ({
      type:       'PHOTO' as const,
      id:         p.id,
      timestamp:  p.uploadedAt.toISOString(),
      url:        p.url,
      caption:    p.caption,
      uploadedBy: p.uploadedBy,
    })),
  ];

  return events
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface PatientSummary {
  adherence: {
    last7d:  { taken: number; total: number; rate: number | null };
    last30d: { taken: number; total: number; rate: number | null };
  };
  weight: {
    latest: number | null;
    date:   string | null;
    trend:  'UP' | 'DOWN' | 'STABLE' | null;
  };
  daysSinceLastLog: number | null;
  totalPhotos:      number;
}

export async function getSummary(patientId: number): Promise<PatientSummary> {
  const now     = new Date();
  const ago7d   = new Date(now.getTime() -  7 * 86_400_000);
  const ago30d  = new Date(now.getTime() - 30 * 86_400_000);

  const [logs7d, logs30d, weightRows, lastLog, photoCount] = await Promise.all([
    prisma.medicationLog.findMany({
      where:  { assignment: { patientId }, takenAt: { gte: ago7d }, status: { in: ['TAKEN', 'MISSED'] } },
      select: { status: true },
    }),
    prisma.medicationLog.findMany({
      where:  { assignment: { patientId }, takenAt: { gte: ago30d }, status: { in: ['TAKEN', 'MISSED'] } },
      select: { status: true },
    }),
    prisma.healthLog.findMany({
      where:   { patientId, weight: { not: null } },
      orderBy: { date: 'desc' },
      take:    2,
      select:  { weight: true, date: true },
    }),
    prisma.healthLog.findFirst({
      where:   { patientId },
      orderBy: { createdAt: 'desc' },
      select:  { createdAt: true },
    }),
    prisma.photo.count({ where: { patientId } }),
  ]);

  const calcAdherence = (logs: { status: string }[]) => {
    const taken = logs.filter((l) => l.status === 'TAKEN').length;
    const total = logs.length;
    return { taken, total, rate: total > 0 ? Math.round((taken / total) * 100) : null };
  };

  // Weight + trend (compare two most recent weight entries)
  let weight: PatientSummary['weight'] = { latest: null, date: null, trend: null };
  if (weightRows[0]) {
    weight.latest = weightRows[0].weight;
    weight.date   = weightRows[0].date.toISOString().split('T')[0];
    if (weightRows[1] && weightRows[0].weight !== null && weightRows[1].weight !== null) {
      const diff = weightRows[0].weight - weightRows[1].weight;
      weight.trend = diff > 0.1 ? 'UP' : diff < -0.1 ? 'DOWN' : 'STABLE';
    }
  }

  // Days since last health log
  let daysSinceLastLog: number | null = null;
  if (lastLog) {
    daysSinceLastLog = Math.floor((now.getTime() - lastLog.createdAt.getTime()) / 86_400_000);
  }

  return {
    adherence: { last7d: calcAdherence(logs7d), last30d: calcAdherence(logs30d) },
    weight,
    daysSinceLastLog,
    totalPhotos: photoCount,
  };
}
