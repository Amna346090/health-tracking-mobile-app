import { ReminderChannel, ReminderStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

// ─── Scheduled job entry-point ────────────────────────────────────────────────

export async function runReminderJob(): Promise<void> {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const timeSlot = `${hh}:${mm}`;

  // The canonical DateTime for this dose slot (current UTC minute, no seconds)
  const scheduledFor = new Date(now);
  scheduledFor.setUTCSeconds(0, 0);

  // Find active assignments whose timesOfDay array includes this minute
  const assignments = await prisma.medicationAssignment.findMany({
    where: {
      active: true,
      timesOfDay: { has: timeSlot },
      startDate: { lte: scheduledFor },
      OR: [{ endDate: null }, { endDate: { gte: scheduledFor } }],
    },
    include: {
      medication: { select: { name: true, dosage: true } },
      patient: {
        select: {
          id: true,
          user: {
            select: {
              email: true,
              firstName: true,
              pushToken: true,
              notifPush: true,
              notifEmail: true,
            },
          },
        },
      },
    },
  });

  for (const assignment of assignments) {
    const { patient, medication } = assignment;
    const { user } = patient;
    const title = 'Medication Reminder';
    const body = `Time to take ${medication.name} (${medication.dosage})`;
    const htmlBody = `<p>${body}</p>`;

    const channels: ReminderChannel[] = [];
    if (user.notifPush && user.pushToken) channels.push(ReminderChannel.PUSH);
    if (user.notifEmail)                  channels.push(ReminderChannel.EMAIL);
    if (channels.length === 0) continue;

    for (const channel of channels) {
      // Atomic create — unique constraint prevents double-send even if job overlaps
      let logId: number;
      try {
        const log = await prisma.reminderLog.create({
          data: {
            patientId:    patient.id,
            assignmentId: assignment.id,
            scheduledFor,
            channel,
            status: ReminderStatus.PENDING,
          },
        });
        logId = log.id;
      } catch (e: unknown) {
        // P2002 = unique constraint violation → already sent/pending for this slot
        if ((e as { code?: string }).code === 'P2002') continue;
        console.error('[reminder] failed to create log', e);
        continue;
      }

      let status: ReminderStatus = ReminderStatus.SENT;
      let errorMessage: string | null = null;

      try {
        if (channel === ReminderChannel.PUSH) {
          await sendPushNotification(
            user.pushToken!,
            title,
            body,
            { assignmentId: assignment.id },
          );
        } else {
          await sendEmail(user.email, title, htmlBody);
        }
      } catch (e: unknown) {
        status = ReminderStatus.FAILED;
        errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[reminder] ${channel} send failed for assignment ${assignment.id}:`, errorMessage);
      }

      await prisma.reminderLog.update({
        where: { id: logId },
        data: {
          status,
          errorMessage,
          sentAt: status === ReminderStatus.SENT ? new Date() : null,
        },
      });
    }
  }
}

// ─── Admin / staff queries ────────────────────────────────────────────────────

export async function getReminderLogs(
  patientId: number,
  limit  = 50,
  offset = 0,
) {
  return prisma.reminderLog.findMany({
    where:   { patientId },
    orderBy: { scheduledFor: 'desc' },
    take:    limit,
    skip:    offset,
    include: {
      assignment: {
        select: {
          id: true,
          medication: { select: { name: true, dosage: true } },
        },
      },
    },
  });
}
