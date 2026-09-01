-- Convert HealthMetric.type from the HealthMetricType enum to free text,
-- preserving existing values (enum labels like 'CHOLESTEROL_LDL' become the text
-- 'CHOLESTEROL_LDL'). Postgres rebuilds the (patientId, type) index automatically.
ALTER TABLE "HealthMetric" ALTER COLUMN "type" TYPE TEXT USING "type"::text;

-- DropEnum
DROP TYPE "HealthMetricType";
