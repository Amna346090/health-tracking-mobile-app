-- Convert the `form` enum column to free text, preserving existing values
-- (enum labels like 'TABLET' become the text 'TABLET').
ALTER TABLE "Medication" ALTER COLUMN "form" TYPE TEXT USING "form"::text;

-- DropEnum
DROP TYPE "MedicationForm";
