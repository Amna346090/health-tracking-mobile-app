-- CreateEnum
CREATE TYPE "MedicationForm" AS ENUM ('TABLET', 'CAPSULE', 'LIQUID', 'INJECTION', 'TOPICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FoodInstruction" AS ENUM ('WITH_FOOD', 'WITHOUT_FOOD', 'EITHER');

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "foodInstruction" "FoodInstruction",
ADD COLUMN     "form" "MedicationForm",
ADD COLUMN     "quantityPerDose" INTEGER;

-- AlterTable
ALTER TABLE "ReminderLog" ALTER COLUMN "scheduledFor" DROP DEFAULT;
