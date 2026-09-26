ALTER TABLE "ServantApplication"
ADD COLUMN "adminNotifiedAt" TIMESTAMP(3);

-- Preserve existing deliveries so the reconciliation does not recreate alerts
-- that an administrator already received before this tracking column existed.
UPDATE "ServantApplication" AS application
SET "adminNotifiedAt" = delivered."createdAt"
FROM (
  SELECT
    "metadata"->>'applicationId' AS "applicationId",
    MIN("createdAt") AS "createdAt"
  FROM "Notification"
  WHERE
    "type" = 'SERVANT_APPLICATION_RECEIVED'
    AND "metadata" IS NOT NULL
  GROUP BY "metadata"->>'applicationId'
) AS delivered
WHERE application."id" = delivered."applicationId";

CREATE INDEX "ServantApplication_status_adminNotifiedAt_idx"
ON "ServantApplication"("status", "adminNotifiedAt");
