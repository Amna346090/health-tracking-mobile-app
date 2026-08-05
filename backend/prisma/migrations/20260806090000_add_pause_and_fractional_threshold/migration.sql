-- AlterTable
ALTER TABLE "PatientProfile" ALTER COLUMN "touchBaseThresholdDays" TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "touchBaseRemindersPaused" BOOLEAN NOT NULL DEFAULT false;
