-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "doseAmount" DOUBLE PRECISION,
ADD COLUMN     "doseUnit" TEXT;

-- AlterTable
ALTER TABLE "MedicationAssignment" ADD COLUMN     "prescribedById" INTEGER,
ADD COLUMN     "refillsAllowed" INTEGER,
ADD COLUMN     "refillsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timesPerDay" INTEGER;

-- AddForeignKey
ALTER TABLE "MedicationAssignment" ADD CONSTRAINT "MedicationAssignment_prescribedById_fkey" FOREIGN KEY ("prescribedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
