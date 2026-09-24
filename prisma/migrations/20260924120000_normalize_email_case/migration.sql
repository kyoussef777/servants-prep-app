-- Email addresses are treated as case-insensitive throughout the application.
-- Normalize both existing data and every future write, including maintenance
-- scripts that bypass the HTTP API.

CREATE OR REPLACE FUNCTION public."sync_user_identity_security"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW."email" := lower(btrim(NEW."email"));
    NEW."emailNormalized" := NEW."email";

    IF NEW."username" IS NOT NULL THEN
        NEW."username" := lower(btrim(NEW."username"));
        NEW."usernameNormalized" := NEW."username";
    ELSE
        NEW."usernameNormalized" := NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND (
        NEW."emailNormalized" IS DISTINCT FROM OLD."emailNormalized"
        OR NEW."username" IS DISTINCT FROM OLD."username"
        OR NEW."password" IS DISTINCT FROM OLD."password"
        OR NEW."isDisabled" IS DISTINCT FROM OLD."isDisabled"
        OR NEW."role" IS DISTINCT FROM OLD."role"
    ) THEN
        NEW."authVersion" := GREATEST(NEW."authVersion", OLD."authVersion" + 1);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public."normalize_single_email"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW."email" IS NOT NULL THEN
        NEW."email" := lower(btrim(NEW."email"));
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public."normalize_registration_emails"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW."email" := lower(btrim(NEW."email"));
    NEW."mentorEmail" := lower(btrim(NEW."mentorEmail"));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public."normalize_guardian_email"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW."guardianEmail" IS NOT NULL THEN
        NEW."guardianEmail" := lower(btrim(NEW."guardianEmail"));
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public."normalize_family_emails"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW."motherEmail" IS NOT NULL THEN
        NEW."motherEmail" := lower(btrim(NEW."motherEmail"));
    END IF;
    IF NEW."fatherEmail" IS NOT NULL THEN
        NEW."fatherEmail" := lower(btrim(NEW."fatherEmail"));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ServantApplication_normalize_email" ON "ServantApplication";
CREATE TRIGGER "ServantApplication_normalize_email"
BEFORE INSERT OR UPDATE OF "email" ON "ServantApplication"
FOR EACH ROW EXECUTE FUNCTION public."normalize_single_email"();

DROP TRIGGER IF EXISTS "SundaySchoolGuardianProfile_normalize_email" ON "SundaySchoolGuardianProfile";
CREATE TRIGGER "SundaySchoolGuardianProfile_normalize_email"
BEFORE INSERT OR UPDATE OF "email" ON "SundaySchoolGuardianProfile"
FOR EACH ROW EXECUTE FUNCTION public."normalize_single_email"();

DROP TRIGGER IF EXISTS "RegistrationSubmission_normalize_emails" ON "RegistrationSubmission";
CREATE TRIGGER "RegistrationSubmission_normalize_emails"
BEFORE INSERT OR UPDATE OF "email", "mentorEmail" ON "RegistrationSubmission"
FOR EACH ROW EXECUTE FUNCTION public."normalize_registration_emails"();

DROP TRIGGER IF EXISTS "SundaySchoolChild_normalize_guardian_email" ON "SundaySchoolChild";
CREATE TRIGGER "SundaySchoolChild_normalize_guardian_email"
BEFORE INSERT OR UPDATE OF "guardianEmail" ON "SundaySchoolChild"
FOR EACH ROW EXECUTE FUNCTION public."normalize_guardian_email"();

DROP TRIGGER IF EXISTS "ChildRegistrationRequest_normalize_guardian_email" ON "ChildRegistrationRequest";
CREATE TRIGGER "ChildRegistrationRequest_normalize_guardian_email"
BEFORE INSERT OR UPDATE OF "guardianEmail" ON "ChildRegistrationRequest"
FOR EACH ROW EXECUTE FUNCTION public."normalize_guardian_email"();

DROP TRIGGER IF EXISTS "SundaySchoolFamily_normalize_emails" ON "SundaySchoolFamily";
CREATE TRIGGER "SundaySchoolFamily_normalize_emails"
BEFORE INSERT OR UPDATE OF "motherEmail", "fatherEmail" ON "SundaySchoolFamily"
FOR EACH ROW EXECUTE FUNCTION public."normalize_family_emails"();

UPDATE "User"
SET "email" = lower(btrim("email"))
WHERE "email" IS DISTINCT FROM lower(btrim("email"));

UPDATE "RegistrationSubmission"
SET
    "email" = lower(btrim("email")),
    "mentorEmail" = lower(btrim("mentorEmail"))
WHERE
    "email" IS DISTINCT FROM lower(btrim("email"))
    OR "mentorEmail" IS DISTINCT FROM lower(btrim("mentorEmail"));

UPDATE "ServantApplication"
SET "email" = lower(btrim("email"))
WHERE "email" IS DISTINCT FROM lower(btrim("email"));

UPDATE "SundaySchoolChild"
SET "guardianEmail" = lower(btrim("guardianEmail"))
WHERE "guardianEmail" IS DISTINCT FROM lower(btrim("guardianEmail"));

UPDATE "SundaySchoolFamily"
SET
    "motherEmail" = lower(btrim("motherEmail")),
    "fatherEmail" = lower(btrim("fatherEmail"))
WHERE
    "motherEmail" IS DISTINCT FROM lower(btrim("motherEmail"))
    OR "fatherEmail" IS DISTINCT FROM lower(btrim("fatherEmail"));

UPDATE "ChildRegistrationRequest"
SET "guardianEmail" = lower(btrim("guardianEmail"))
WHERE "guardianEmail" IS DISTINCT FROM lower(btrim("guardianEmail"));

UPDATE "SundaySchoolGuardianProfile"
SET "email" = lower(btrim("email"))
WHERE "email" IS DISTINCT FROM lower(btrim("email"));
