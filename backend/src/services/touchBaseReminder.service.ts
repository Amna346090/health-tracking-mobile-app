import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getOverdueOrNearingPatients } from './touchBase.service';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

const TOUCH_BASE_DUE = 'TOUCH_BASE_DUE';

/**
 * Real (1-day-or-longer) thresholds are date-level, not time-of-day — they're only checked
 * and sent once daily, at a fixed hour, and repeat daily as long as the current cycle remains
 * unacknowledged. Sub-day thresholds (admin-only test values in minutes) are checked and sent
 * on every tick instead, so a 1-minute test threshold produces roughly one send per minute —
 * this only ever applies to test thresholds, real reminders are untouched by this path.
 * "Mark as contacted" is the only thing that silences a cycle, and only until the next one is due.
 */
export async function runTouchBaseReminderJob(): Promise<void> {
  const now = new Date();
  const isDailyTick = now.getUTCHours() === 8 && now.getUTCMinutes() === 0;

  const queue = await getOverdueOrNearingPatients();
  const toNotify = queue.filter((item) => {
    if (!item.overdue) return false;
    return item.thresholdDays < 1 || isDailyTick;
  });
  if (toNotify.length === 0) return;

  const staffUsers = await prisma.user.findMany({
    where: { role: { in: [Role.STAFF, Role.ADMIN] } },
    select: { id: true, email: true, pushToken: true },
  });
  if (staffUsers.length === 0) return;

  for (const item of toNotify) {
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
