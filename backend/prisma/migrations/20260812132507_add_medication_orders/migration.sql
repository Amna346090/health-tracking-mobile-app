-- CreateTable
CREATE TABLE "MedicationOrder" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dose" TEXT NOT NULL,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationOrder_assignmentId_idx" ON "MedicationOrder"("assignmentId");

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MedicationAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationOrder" ADD CONSTRAINT "MedicationOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
