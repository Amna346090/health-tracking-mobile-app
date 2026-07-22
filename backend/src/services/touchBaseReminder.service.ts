import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getOverdueOrNearingPatients } from './touchBase.service';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

const TOUCH_BASE_DUE = 'TOUCH_BASE_DUE';

/**
 * Only notifies once per "crossing" — if a Notification of this type already exists for
 * the patient created after their current lastContactAt, they've already been flagged for
 * this stretch of silence, so we don't nag daily like the test-request overdue reminders do.
 */
async function alreadyNotified(patientId: number, lastContactAt: Date | null): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      type: TOUCH_BASE_DUE,
      patientId,
      ...(lastContactAt && { createdAt: { gt: lastContactAt } }),
    },
  });
  return !!existing;
}

/** Touch-base due dates are date-level, not time-of-day — runs once daily at a fixed hour. */
export async function runTouchBaseReminderJob(): Promise<void> {
  const now = new Date();
  if (now.getUTCHours() !== 8 || now.getUTCMinutes() !== 0) return;

  const queue = await getOverdueOrNearingPatients();
  const overdue = queue.filter((item) => item.overdue);
  if (overdue.length === 0) return;

  const staffUsers = await prisma.user.findMany({
    where: { role: { in: [Role.STAFF, Role.ADMIN] } },
    select: { id: true, email: true, pushToken: true },
  });
  if (staffUsers.length === 0) return;

  for (const item of overdue) {
    if (await alreadyNotified(item.id, item.lastContactAt)) continue;

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

      sendEmail(staff.email, title, `<p>${body}</p>`).catch((e) => {
        console.error(`[touch-base reminder] email failed for user ${staff.id}:`, e instanceof Error ? e.message : e);
      });
    }
  }
}
