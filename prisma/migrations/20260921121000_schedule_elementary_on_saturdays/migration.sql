-- Preserve any Saturday lesson that was already created manually, then move
-- the generated Elementary calendar from Sunday to the preceding Saturday.
DELETE FROM "SundaySchoolWeeklyLesson" AS sunday_lesson
USING "SundaySchoolClass" AS school_class
WHERE sunday_lesson."classId" = school_class."id"
  AND school_class."level" IN (
    'PRE_K',
    'KINDERGARTEN',
    'GRADE_1',
    'GRADE_2',
    'GRADE_3',
    'GRADE_4',
    'GRADE_5'
  )
  AND EXTRACT(DOW FROM sunday_lesson."sundayDate") = 0
  AND EXISTS (
    SELECT 1
    FROM "SundaySchoolWeeklyLesson" AS saturday_lesson
    WHERE saturday_lesson."classId" = sunday_lesson."classId"
      AND saturday_lesson."sundayDate" = sunday_lesson."sundayDate" - INTERVAL '1 day'
  );

UPDATE "SundaySchoolWeeklyLesson" AS lesson
SET "sundayDate" = lesson."sundayDate" - INTERVAL '1 day'
FROM "SundaySchoolClass" AS school_class
WHERE lesson."classId" = school_class."id"
  AND school_class."level" IN (
    'PRE_K',
    'KINDERGARTEN',
    'GRADE_1',
    'GRADE_2',
    'GRADE_3',
    'GRADE_4',
    'GRADE_5'
  )
  AND EXTRACT(DOW FROM lesson."sundayDate") = 0;

-- Attendance entered with the old Sunday default belongs to the preceding
-- Saturday. Skip the rare case where that Saturday already has a session so
-- no attendance records are lost to a uniqueness collision.
UPDATE "SundaySchoolSession" AS session
SET "date" = session."date" - INTERVAL '1 day'
FROM "SundaySchoolClass" AS school_class
WHERE session."classId" = school_class."id"
  AND school_class."level" IN (
    'PRE_K',
    'KINDERGARTEN',
    'GRADE_1',
    'GRADE_2',
    'GRADE_3',
    'GRADE_4',
    'GRADE_5'
  )
  AND EXTRACT(DOW FROM session."date") = 0
  AND NOT EXISTS (
    SELECT 1
    FROM "SundaySchoolSession" AS saturday_session
    WHERE saturday_session."classId" = session."classId"
      AND saturday_session."date" = session."date" - INTERVAL '1 day'
  );
