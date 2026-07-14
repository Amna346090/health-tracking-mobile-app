-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "healthIssue" TEXT;
