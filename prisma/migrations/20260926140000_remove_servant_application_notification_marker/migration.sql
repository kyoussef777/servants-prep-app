DROP INDEX IF EXISTS "ServantApplication_status_adminNotifiedAt_idx";

ALTER TABLE "ServantApplication"
DROP COLUMN IF EXISTS "adminNotifiedAt";
