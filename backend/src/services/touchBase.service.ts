import prisma from '../lib/prisma';
import { getTouchBaseSettings } from './patient.service';

const PATIENT_USER_SELECT = {
  id: true,
  lastContactAt: true,
  touchBaseThresholdDays: true,
  thresholdSetAt: true,
  touchBaseRemindersPaused: true,
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
  user: { firstName: string; lastName: string; email: string | null };
}

export interface TouchBaseQueueFilters {
  providerId?: number;
}

/**
 * The threshold is a fixed recurring cycle, not a "reset on contact" countdown: it repeats
 * every `thresholdDays` from the moment it was set (thresholdSetAt), forever, regardless of
 * contact. "Mark as contacted" (lastContactAt) only acknowledges the CURRENT cycle — it silences
 * that cycle's daily reminder but does not shift or restart the schedule for future cycles.
 */
function computeDueDate(
  thresholdSetAt: Date,
  thresholdDays: number,
  lastContactAt: Date | null,
  now: number,
): { dueAt: Date; overdue: boolean } {
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const periodsElapsed = Math.floor((now - thresholdSetAt.getTime()) / thresholdMs);

  if (periodsElapsed >= 1) {
    const currentCycleBoundary = new Date(thresholdSetAt.getTime() + periodsElapsed * thresholdMs);
    const acknowledgedThisCycle =
      lastContactAt !== null && lastContactAt.getTime() >= currentCycleBoundary.getTime();
    if (!acknowledgedThisCycle) {
      return { dueAt: currentCycleBoundary, overdue: true };
    }
    return { dueAt: new Date(thresholdSetAt.getTime() + (periodsElapsed + 1) * thresholdMs), overdue: false };
  }

  return { dueAt: new Date(thresholdSetAt.getTime() + thresholdMs), overdue: false };
}

/** Patients who are overdue (past their current cycle, unacknowledged) or nearing their next cycle. */
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
    if (p.touchBaseRemindersPaused) continue;

    const thresholdDays = p.touchBaseThresholdDays ?? settings.defaultThresholdDays;
    const { dueAt, overdue } = computeDueDate(p.thresholdSetAt, thresholdDays, p.lastContactAt, now);

    if (overdue || dueAt.getTime() <= nearingCutoff) {
      results.push({
        id: p.id,
        lastContactAt: p.lastContactAt,
        thresholdDays,
        dueAt,
        overdue,
        user: p.user,
      });
    }
  }

  return results.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
