import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getOverdueOrNearingPatients } from './touchBase.service';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

const TOUCH_BASE_DUE = 'TOUCH_BASE_DUE';

/**
 * Real (1-day-or-longer) thresholds are only checked once daily, at a fixed hour, so being
 * "overdue" there naturally produces at most one send per day for as long as the cycle remains
 * unacknowledged — no extra bookkeeping needed. Sub-day (test) thresholds are checked on every
 * tick instead, so without a boundary-level dedup they'd fire on every single check for the whole
 * remaining length of the cycle (e.g. every minute for the entire 10-minute span of a 10-minute
 * threshold) instead of once per cycle. This checks whether a notification already exists for the
 * CURRENT cycle boundary specifically, so a test threshold gets one send per boundary crossed —
 * repeating again at the next boundary regardless of whether "Mark as contacted" was ever clicked.
 */
async function alreadyNotifiedForCurrentCycle(patientId: number, cycleBoundary: Date): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      type: TOUCH_BASE_DUE,
      patientId,
      createdAt: { gte: cycleBoundary },
    },
  });
  return !!existing;
}

export async function runTouchBaseReminderJob(): Promise<void> {
  const now = new Date();
  const isDailyTick = now.getUTCHours() === 8 && now.getUTCMinutes() === 0;

  const queue = await getOverdueOrNearingPatients();
  const candidates = queue.filter((item) => {
    if (!item.overdue) return false;
    return item.thresholdDays < 1 || isDailyTick;
  });
  if (candidates.length === 0) return;

  const staffUsers = await prisma.user.findMany({
    where: { role: { in: [Role.STAFF, Role.ADMIN] } },
    select: { id: true, email: true, pushToken: true },
  });
  if (staffUsers.length === 0) return;

  for (const item of candidates) {
    if (item.thresholdDays < 1 && await alreadyNotifiedForCurrentCycle(item.id, item.dueAt)) continue;

    const patientName = `${item.user.firstName} ${item.user.lastName}`;
    const daysSince = item.lastContactAt
      ? Math.round((Date.now() - item.lastContactAt.getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const sinceText = daysSince !== null ? `${daysSince} days ago` : 'never';
    const title = 'Touch-base reminder';
    const body = `You need to reach back to ${patientName} — last contact was ${sinceText}.`;

    for (const staff of staffUsers) {
      try {
        await prisma.notification.create({
          data: {
            userId: staff.id,
            type: TOUCH_BASE_DUE,
            title,
            body,
            patientId: item.id,
          },
        });
      } catch (e) {
        console.error(`[touch-base reminder] failed to create notification for user ${staff.id}:`, e);
        continue;
      }

      if (staff.pushToken) {
        sendPushNotification(staff.pushToken, title, body, {
          patientId: item.id,
          type: TOUCH_BASE_DUE,
        }).catch((e) => {
          console.error(`[touch-base reminder] push failed for user ${staff.id}:`, e instanceof Error ? e.message : e);
        });
      }

      if (staff.email) {
        sendEmail(staff.email, title, `<p>${body}</p>`).catch((e) => {
          console.error(`[touch-base reminder] email failed for user ${staff.id}:`, e instanceof Error ? e.message : e);
        });
      }
    }
  }
}
