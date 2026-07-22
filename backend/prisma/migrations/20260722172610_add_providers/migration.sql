-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "providerId" INTEGER;

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "providerId" INTEGER;

-- CreateTable
CREATE TABLE "Provider" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "npi" TEXT,
    "credentials" TEXT,
    "specialty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_userId_key" ON "Provider"("userId");

-- CreateIndex
CREATE INDEX "Appointment_providerId_idx" ON "Appointment"("providerId");

-- CreateIndex
CREATE INDEX "PatientProfile_providerId_idx" ON "PatientProfile"("providerId");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
