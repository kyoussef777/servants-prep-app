ALTER TABLE "RegistrationSubmission"
  ALTER COLUMN "approvalFormUrl" DROP NOT NULL,
  ALTER COLUMN "approvalFormFilename" DROP NOT NULL,
  ALTER COLUMN "mentorName" DROP NOT NULL,
  ALTER COLUMN "mentorPhone" DROP NOT NULL,
  ALTER COLUMN "mentorEmail" DROP NOT NULL;

ALTER TYPE "NotificationType" ADD VALUE 'REGISTRATION_INCOMPLETE';

ALTER TABLE "Notification"
  ADD COLUMN "isPersistent" BOOLEAN NOT NULL DEFAULT false;
