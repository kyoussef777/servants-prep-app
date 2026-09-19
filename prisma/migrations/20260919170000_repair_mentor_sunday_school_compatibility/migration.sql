-- Mentor is assignment-derived and intentionally has no permanent RoleTag.
-- Adding the Sunday School Servant tag previously changed an active mentor's
-- compatibility-era User.role to SERVANT, which made /dashboard choose the
-- Sunday School landing page and could trigger a client-side redirect loop.
-- Restore MENTOR only for people who still have an active normalized mentor
-- assignment. Higher-impact compatibility roles remain untouched.
UPDATE "User" AS u
SET "role" = 'MENTOR'::"UserRole"
WHERE u."role" = 'SERVANT'::"UserRole"
  AND EXISTS (
    SELECT 1
    FROM "MentorAssignment" AS ma
    INNER JOIN "StudentEnrollment" AS se
      ON se."id" = ma."studentEnrollmentId"
    WHERE ma."mentorUserId" = u."id"
      AND ma."endedAt" IS NULL
      AND se."status" = 'ACTIVE'::"EnrollmentStatus"
  )
  AND EXISTS (
    SELECT 1
    FROM "UserRoleAssignment" AS ura
    WHERE ura."userId" = u."id"
      AND ura."tag" = 'SUNDAY_SCHOOL_SERVANT'::"RoleTag"
      AND ura."revokedAt" IS NULL
  );
