-- College and graduate students share one Sunday School grade level. Preserve
-- all existing records and history while moving both legacy values to the new
-- combined value.

-- A placement's level participates in foreign keys to both its enrollment and
-- class. Drop those two constraints temporarily so all three records can move
-- to the combined enum value in one migration, then restore the constraints.
ALTER TABLE "SundaySchoolClassPlacement"
  DROP CONSTRAINT "SundaySchoolClassPlacement_enrollmentId_sundaySchoolYearId_fkey";

ALTER TABLE "SundaySchoolClassPlacement"
  DROP CONSTRAINT "SundaySchoolClassPlacement_classId_sundaySchoolYearId_leve_fkey";

-- If a year already has both a College and Grad class with the same section
-- key, preserve both classes by giving the later duplicate its existing class
-- name as the section key before their levels are combined.
WITH ranked_classes AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "sundaySchoolYearId", "sectionName"
      ORDER BY CASE "level"::text WHEN 'COLLEGE' THEN 0 ELSE 1 END, "createdAt", "id"
    ) AS duplicate_number
  FROM "SundaySchoolClass"
  WHERE "level"::text IN ('COLLEGE', 'GRAD')
)
UPDATE "SundaySchoolClass" AS class
SET "sectionName" = class."name"
FROM ranked_classes
WHERE class."id" = ranked_classes."id"
  AND ranked_classes.duplicate_number > 1;

UPDATE "SundaySchoolClass"
SET "level" = 'COLLEGE_GRAD'
WHERE "level"::text IN ('COLLEGE', 'GRAD');

UPDATE "SundaySchoolChild"
SET "level" = 'COLLEGE_GRAD'
WHERE "level"::text IN ('COLLEGE', 'GRAD');

UPDATE "SundaySchoolEnrollment"
SET
  "level" = CASE
    WHEN "level"::text IN ('COLLEGE', 'GRAD') THEN 'COLLEGE_GRAD'::"SundaySchoolLevel"
    ELSE "level"
  END,
  "nextLevelOverride" = CASE
    WHEN "nextLevelOverride"::text IN ('COLLEGE', 'GRAD') THEN 'COLLEGE_GRAD'::"SundaySchoolLevel"
    ELSE "nextLevelOverride"
  END
WHERE "level"::text IN ('COLLEGE', 'GRAD')
   OR "nextLevelOverride"::text IN ('COLLEGE', 'GRAD');

UPDATE "SundaySchoolClassPlacement"
SET "level" = 'COLLEGE_GRAD'
WHERE "level"::text IN ('COLLEGE', 'GRAD');

UPDATE "ChildRegistrationRequest"
SET "intendedLevel" = 'COLLEGE_GRAD'
WHERE "intendedLevel"::text IN ('COLLEGE', 'GRAD');

UPDATE "SundaySchoolRolloverItem"
SET
  "sourceLevel" = CASE
    WHEN "sourceLevel"::text IN ('COLLEGE', 'GRAD') THEN 'COLLEGE_GRAD'::"SundaySchoolLevel"
    ELSE "sourceLevel"
  END,
  "targetLevel" = CASE
    WHEN "targetLevel"::text IN ('COLLEGE', 'GRAD') THEN 'COLLEGE_GRAD'::"SundaySchoolLevel"
    ELSE "targetLevel"
  END
WHERE "sourceLevel"::text IN ('COLLEGE', 'GRAD')
   OR "targetLevel"::text IN ('COLLEGE', 'GRAD');

-- Keep a single normalized owner row per Sunday School year if College and
-- Grad were previously assigned separately.
WITH ranked_levels AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "sundaySchoolYearId"
      ORDER BY CASE "level"::text WHEN 'COLLEGE' THEN 0 ELSE 1 END, "createdAt", "id"
    ) AS owner_number
  FROM "SundaySchoolAgeGroupLevel"
  WHERE "level"::text IN ('COLLEGE', 'GRAD')
)
DELETE FROM "SundaySchoolAgeGroupLevel" AS level_row
USING ranked_levels
WHERE level_row."id" = ranked_levels."id"
  AND ranked_levels.owner_number > 1;

UPDATE "SundaySchoolAgeGroupLevel"
SET "level" = 'COLLEGE_GRAD'
WHERE "level"::text IN ('COLLEGE', 'GRAD');

-- Replace the legacy values inside age-group arrays and remove any duplicate
-- combined entry when a band previously contained both values.
UPDATE "SundaySchoolAgeGroup" AS age_group
SET "levels" = ARRAY(
  SELECT normalized_level
  FROM (
    SELECT
      CASE
        WHEN level::text IN ('COLLEGE', 'GRAD') THEN 'COLLEGE_GRAD'::"SundaySchoolLevel"
        ELSE level
      END AS normalized_level,
      MIN(position) AS first_position
    FROM unnest(age_group."levels") WITH ORDINALITY AS existing(level, position)
    GROUP BY normalized_level
  ) AS normalized_levels
  ORDER BY first_position
)
WHERE age_group."levels"::text LIKE '%COLLEGE%'
   OR age_group."levels"::text LIKE '%GRAD%';

-- The normalized owner row is authoritative for year-scoped age groups. If
-- College and Grad belonged to different bands, keep the combined level only
-- on the band whose owner row survived the de-duplication above.
UPDATE "SundaySchoolAgeGroup" AS age_group
SET "levels" = array_remove(age_group."levels", 'COLLEGE_GRAD'::"SundaySchoolLevel")
WHERE age_group."sundaySchoolYearId" IS NOT NULL
  AND age_group."levels" @> ARRAY['COLLEGE_GRAD'::"SundaySchoolLevel"]
  AND NOT EXISTS (
    SELECT 1
    FROM "SundaySchoolAgeGroupLevel" AS level_row
    WHERE level_row."sundaySchoolYearId" = age_group."sundaySchoolYearId"
      AND level_row."ageGroupId" = age_group."id"
      AND level_row."level" = 'COLLEGE_GRAD'
  );

ALTER TABLE "SundaySchoolClassPlacement"
  ADD CONSTRAINT "SundaySchoolClassPlacement_enrollmentId_sundaySchoolYearId_fkey"
  FOREIGN KEY ("enrollmentId", "sundaySchoolYearId", "level")
  REFERENCES "SundaySchoolEnrollment"("id", "sundaySchoolYearId", "level")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SundaySchoolClassPlacement"
  ADD CONSTRAINT "SundaySchoolClassPlacement_classId_sundaySchoolYearId_leve_fkey"
  FOREIGN KEY ("classId", "sundaySchoolYearId", "level")
  REFERENCES "SundaySchoolClass"("id", "sundaySchoolYearId", "level")
  ON DELETE RESTRICT ON UPDATE CASCADE;
