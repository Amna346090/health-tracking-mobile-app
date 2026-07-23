import { TestRequestStatus, ReminderChannel, ReminderStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

const OVERDUE_NAG_INTERVAL_DAYS = 3;

function todayDateOnly(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function sendReminder(
  testRequest: { id: number; name: string; dueDate: Date; patient: { id: number; user: { email: string | null; pushToken: string | null } } },
  offsetLabel: string,
  bodyText: string,
): Promise<void> {
  const { patient } = testRequest;
  const { user } = patient;
  const title = 'Test/Scan Reminder';
  const htmlBody = `<p>${bodyText}</p>`;

  // Same policy as appointment reminders — always both channels, not gated behind the
  // patient's general notifPush/notifEmail preference, since this is a care-coordination requirement.
  const channels: ReminderChannel[] = [];
  if (user.pushToken) channels.push(ReminderChannel.PUSH);
  if (user.email) channels.push(ReminderChannel.EMAIL);

  for (const channel of channels) {
    let logId: number;
    try {
      const log = await prisma.testRequestReminderLog.create({
        data: {
          patientId: patient.id,
          testRequestId: testRequest.id,
          offsetLabel,
          channel,
          status: ReminderStatus.PENDING,
        },
      });
      logId = log.id;
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') continue;
      console.error('[test-request reminder] failed to create log', e);
      continue;
    }

    let status: ReminderStatus = ReminderStatus.SENT;
    let errorMessage: string | null = null;

    try {
      if (channel === ReminderChannel.PUSH) {
        await sendPushNotification(user.pushToken!, title, bodyText, {
          testRequestId: testRequest.id,
          patientId: patient.id,
        });
      } else {
        await sendEmail(user.email!, title, htmlBody);
      }
    } catch (e: unknown) {
      status = ReminderStatus.FAILED;
      errorMessage = e instanceof Error ? e.message : String(e);
      console.error(
        `[test-request reminder] ${channel} send failed for test request ${testRequest.id}:`,
        errorMessage,
      );
    }

    await prisma.testRequestReminderLog.update({
      where: { id: logId },
      data: {
        status,
        errorMessage,
        sentAt: status === ReminderStatus.SENT ? new Date() : null,
      },
    });
  }
}

const PATIENT_INCLUDE = {
  patient: {
    select: {
      id: true,
      user: { select: { email: true, pushToken: true } },
    },
  },
} as const;

/**
 * Test/scan due dates are date-only (no time-of-day), unlike appointments/medications
 * which key off exact clock times — so this only actually runs once a day, at a fixed
 * hour, even though it's ticked from the same per-minute cron as the other reminder jobs.
 */
export async function runTestRequestReminderJob(): Promise<void> {
  const now = new Date();
  if (now.getUTCHours() !== 9 || now.getUTCMinutes() !== 0) return;

  const today = todayDateOnly(now);

  const dueIn2Days = await prisma.testRequest.findMany({
    where: { status: TestRequestStatus.PENDING, dueDate: addDays(today, 2) },
    include: PATIENT_INCLUDE,
  });
  for (const req of dueIn2Days) {
    await sendReminder(req, 'before-2d', `"${req.name}" is due in 2 days. Please submit your results soon.`);
  }

  const dueToday = await prisma.testRequest.findMany({
    where: { status: TestRequestStatus.PENDING, dueDate: today },
    include: PATIENT_INCLUDE,
  });
  for (const req of dueToday) {
    await sendReminder(req, 'day-of', `"${req.name}" is due today. Please submit your results.`);
  }

  const overdue = await prisma.testRequest.findMany({
    where: { status: TestRequestStatus.PENDING, dueDate: { lt: today } },
    include: PATIENT_INCLUDE,
  });
  for (const req of overdue) {
    const daysOverdue = Math.round((today.getTime() - req.dueDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysOverdue > 0 && daysOverdue % OVERDUE_NAG_INTERVAL_DAYS === 0) {
      await sendReminder(req, `overdue-${daysOverdue}`, `"${req.name}" is now ${daysOverdue} days overdue. Please submit your results as soon as possible.`);
    }
  }
}
