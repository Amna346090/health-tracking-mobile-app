import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendPushNotification } from '../lib/expoPush';

const SENDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

export async function listMessagesForPatient(patientId: number) {
  return prisma.message.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: SENDER_SELECT } },
  });
}

export interface CreateMessageInput {
  patientId: number;
  senderId: number;
  body: string;
}

export async function createMessage(data: CreateMessageInput) {
  const patient = await prisma.patientProfile.findUnique({
    where: { id: data.patientId },
    select: {
      id: true,
      user: { select: { pushToken: true, notifPush: true } },
    },
  });
  if (!patient) throw new AppError('Patient not found', 404);

  const message = await prisma.message.create({
    data: {
      patientId: data.patientId,
      senderId: data.senderId,
      body: data.body,
    },
    include: { sender: { select: SENDER_SELECT } },
  });

  if (patient.user.notifPush && patient.user.pushToken) {
    const preview = data.body.length > 120 ? `${data.body.slice(0, 117)}...` : data.body;
    sendPushNotification(patient.user.pushToken, 'New message', preview, {
      messageId: message.id,
      patientId: data.patientId,
    }).catch((e) => {
      console.error(`[message] push failed for message ${message.id}:`, e instanceof Error ? e.message : e);
    });
  }

  return message;
}

export async function markMessageRead(id: number, requestingUserId: number) {
  const message = await prisma.message.findUnique({
    where: { id },
    include: { patient: { select: { userId: true } } },
  });
  if (!message) throw new AppError('Message not found', 404);
  if (message.patient.userId !== requestingUserId) throw new AppError('Forbidden', 403);
  if (message.readAt) return message;

  return prisma.message.update({
    where: { id },
    data: { readAt: new Date() },
    include: { sender: { select: SENDER_SELECT } },
  });
}
