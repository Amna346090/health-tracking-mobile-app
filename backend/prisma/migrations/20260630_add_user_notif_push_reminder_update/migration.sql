-- AlterTable
ALTER TABLE "ReminderLog" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT now(),
ALTER COLUMN "sentAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifPush" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_assignmentId_scheduledFor_channel_key" ON "ReminderLog"("assignmentId", "scheduledFor", "channel");
