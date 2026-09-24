-- Add Special Needs to the Elementary-style age group in each Sunday School
-- year. Prefer a group explicitly named Elementary; otherwise use the active
-- group that already owns the most Elementary levels.
WITH elementary_levels AS (
    SELECT ARRAY[
        'PRE_K',
        'KINDERGARTEN',
        'GRADE_1',
        'GRADE_2',
        'GRADE_3',
        'GRADE_4',
        'GRADE_5'
    ]::"SundaySchoolLevel"[] AS levels
),
ranked_groups AS (
    SELECT
        age_group."id",
        age_group."sundaySchoolYearId",
        row_number() OVER (
            PARTITION BY age_group."sundaySchoolYearId"
            ORDER BY
                CASE WHEN lower(age_group."name") LIKE 'elementary%' THEN 0 ELSE 1 END,
                (
                    SELECT count(*)
                    FROM unnest(age_group."levels") AS level_row(level)
                    WHERE level_row.level = ANY(elementary_levels.levels)
                ) DESC,
                age_group."sortOrder",
                age_group."createdAt"
        ) AS candidate_rank
    FROM "SundaySchoolAgeGroup" AS age_group
    CROSS JOIN elementary_levels
    WHERE
        age_group."status" = 'ACTIVE'
        AND age_group."levels" && elementary_levels.levels
),
selected_groups AS (
    SELECT "id", "sundaySchoolYearId"
    FROM ranked_groups
    WHERE candidate_rank = 1
)
UPDATE "SundaySchoolAgeGroup" AS age_group
SET "levels" = array_append(age_group."levels", 'SPECIAL_NEEDS'::"SundaySchoolLevel")
FROM selected_groups
WHERE
    age_group."id" = selected_groups."id"
    AND NOT age_group."levels" @> ARRAY['SPECIAL_NEEDS'::"SundaySchoolLevel"];

INSERT INTO "SundaySchoolAgeGroupLevel" (
    "id", "sundaySchoolYearId", "ageGroupId", "level", "createdAt"
)
SELECT
    'ssagl_' || substr(md5(age_group."id" || ':SPECIAL_NEEDS'), 1, 20),
    age_group."sundaySchoolYearId",
    age_group."id",
    'SPECIAL_NEEDS'::"SundaySchoolLevel",
    CURRENT_TIMESTAMP
FROM "SundaySchoolAgeGroup" AS age_group
WHERE
    age_group."sundaySchoolYearId" IS NOT NULL
    AND age_group."levels" @> ARRAY['SPECIAL_NEEDS'::"SundaySchoolLevel"]
ON CONFLICT ("sundaySchoolYearId", "level") DO NOTHING;
