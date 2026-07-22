import prisma from '../lib/prisma';
import { getTouchBaseSettings } from './patient.service';

const PATIENT_USER_SELECT = {
  id: true,
  lastContactAt: true,
  touchBaseThresholdDays: true,
  providerId: true,
  createdAt: true,
  user: { select: { firstName: true, lastName: true, email: true } },
} as const;

const NEARING_WINDOW_DAYS = 3;

export interface TouchBaseQueueItem {
  id: number;
  lastContactAt: Date | null;
  thresholdDays: number;
  dueAt: Date;
  overdue: boolean;
  user: { firstName: string; lastName: string; email: string };
}

export interface TouchBaseQueueFilters {
  providerId?: number;
}

/** Patients who are overdue (past their threshold) or nearing it (within NEARING_WINDOW_DAYS). */
export async function getOverdueOrNearingPatients(filters: TouchBaseQueueFilters = {}): Promise<TouchBaseQueueItem[]> {
  const settings = await getTouchBaseSettings();
  const patients = await prisma.patientProfile.findMany({
    // Unassigned patients stay visible alongside whichever provider's queue is being filtered.
    where: filters.providerId !== undefined
      ? { OR: [{ providerId: filters.providerId }, { providerId: null }] }
      : undefined,
    select: PATIENT_USER_SELECT,
  });

  const now = Date.now();
  const nearingCutoff = now + NEARING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const results: TouchBaseQueueItem[] = [];
  for (const p of patients) {
    const thresholdDays = p.touchBaseThresholdDays ?? settings.defaultThresholdDays;
    const anchor = p.lastContactAt ?? p.createdAt;
    const dueAt = new Date(anchor.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

    if (dueAt.getTime() <= nearingCutoff) {
      results.push({
        id: p.id,
        lastContactAt: p.lastContactAt,
        thresholdDays,
        dueAt,
        overdue: dueAt.getTime() <= now,
        user: p.user,
      });
    }
  }

  return results.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
