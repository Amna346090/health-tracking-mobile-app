-- CreateEnum
CREATE TYPE "TestRequestStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TestRequest" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "dueDate" DATE NOT NULL,
    "status" "TestRequestStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" INTEGER,
    "requestedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRequestReminderLog" (
    "id" SERIAL NOT NULL,
    "testRequestId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "offsetLabel" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRequestReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestRequest_patientId_idx" ON "TestRequest"("patientId");

-- CreateIndex
CREATE INDEX "TestRequest_dueDate_idx" ON "TestRequest"("dueDate");

-- CreateIndex
CREATE INDEX "TestRequestReminderLog_patientId_idx" ON "TestRequestReminderLog"("patientId");

-- CreateIndex
CREATE INDEX "TestRequestReminderLog_testRequestId_idx" ON "TestRequestReminderLog"("testRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "TestRequestReminderLog_testRequestId_offsetLabel_channel_key" ON "TestRequestReminderLog"("testRequestId", "offsetLabel", "channel");

-- AddForeignKey
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRequest" ADD CONSTRAINT "TestRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRequestReminderLog" ADD CONSTRAINT "TestRequestReminderLog_testRequestId_fkey" FOREIGN KEY ("testRequestId") REFERENCES "TestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRequestReminderLog" ADD CONSTRAINT "TestRequestReminderLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
