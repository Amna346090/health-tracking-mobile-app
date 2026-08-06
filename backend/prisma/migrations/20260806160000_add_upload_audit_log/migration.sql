-- CreateEnum
CREATE TYPE "UploadEntityType" AS ENUM ('PHOTO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadAuditAction" AS ENUM ('UPLOADED', 'EDITED', 'DELETED');

-- CreateTable
CREATE TABLE "UploadAuditLog" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "entityType" "UploadEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" "UploadAuditAction" NOT NULL,
    "detail" TEXT,
    "performedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadAuditLog_patientId_idx" ON "UploadAuditLog"("patientId");

-- AddForeignKey
ALTER TABLE "UploadAuditLog" ADD CONSTRAINT "UploadAuditLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAuditLog" ADD CONSTRAINT "UploadAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
