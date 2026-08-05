-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "thresholdSetAt" TIMESTAMP(3);

-- Backfill: best-effort anchor for existing patients, using their most recent known
-- contact (or account creation if never contacted) as the start of their first cycle.
UPDATE "PatientProfile" SET "thresholdSetAt" = COALESCE("lastContactAt", "createdAt");

-- AlterTable
ALTER TABLE "PatientProfile" ALTER COLUMN "thresholdSetAt" SET NOT NULL,
ALTER COLUMN "thresholdSetAt" SET DEFAULT CURRENT_TIMESTAMP;
