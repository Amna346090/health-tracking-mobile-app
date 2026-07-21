import { AppointmentStatus, ReminderChannel, ReminderStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { sendPushNotification } from '../lib/expoPush';
import { sendEmail } from '../lib/email';

interface Window {
  offsetLabel: string;
  target: Date;
}

function currentMinuteWindows(now: Date): Window[] {
  const floor = new Date(now);
  floor.setSeconds(0, 0);
  return [
    { offsetLabel: '24h', target: new Date(floor.getTime() + 24 * 60 * 60 * 1000) },
    { offsetLabel: '1h', target: new Date(floor.getTime() + 60 * 60 * 1000) },
  ];
}

export async function runAppointmentReminderJob(): Promise<void> {
  const windows = currentMinuteWindows(new Date());

  for (const { offsetLabel, target } of windows) {
    const rangeEnd = new Date(target.getTime() + 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.RESCHEDULED] },
        scheduledFor: { gte: target, lt: rangeEnd },
      },
      include: {
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

    for (const appointment of appointments) {
      const { patient } = appointment;
      const { user } = patient;
      const title = 'Upcoming Appointment';
      const when = appointment.scheduledFor.toLocaleString();
      const body = `You have an appointment on ${when}${appointment.reason ? ` (${appointment.reason})` : ''}`;
      const htmlBody = `<p>${body}</p>`;

      const channels: ReminderChannel[] = [];
      if (user.notifPush && user.pushToken) channels.push(ReminderChannel.PUSH);
      if (user.notifEmail) channels.push(ReminderChannel.EMAIL);
      if (channels.length === 0) continue;

      for (const channel of channels) {
        let logId: number;
        try {
          const log = await prisma.appointmentReminderLog.create({
            data: {
              patientId: patient.id,
              appointmentId: appointment.id,
              offsetLabel,
              channel,
              status: ReminderStatus.PENDING,
            },
          });
          logId = log.id;
        } catch (e: unknown) {
          if ((e as { code?: string }).code === 'P2002') continue;
          console.error('[appointment reminder] failed to create log', e);
          continue;
        }

        let status: ReminderStatus = ReminderStatus.SENT;
        let errorMessage: string | null = null;

        try {
          if (channel === ReminderChannel.PUSH) {
            await sendPushNotification(user.pushToken!, title, body, {
              appointmentId: appointment.id,
              patientId: patient.id,
            });
          } else {
            await sendEmail(user.email, title, htmlBody);
          }
        } catch (e: unknown) {
          status = ReminderStatus.FAILED;
          errorMessage = e instanceof Error ? e.message : String(e);
          console.error(
            `[appointment reminder] ${channel} send failed for appointment ${appointment.id}:`,
            errorMessage,
          );
        }

        await prisma.appointmentReminderLog.update({
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
}
