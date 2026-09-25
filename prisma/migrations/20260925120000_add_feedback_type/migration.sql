CREATE TYPE "SundaySchoolFeedbackType" AS ENUM ('PROBLEM', 'IDEA');

ALTER TABLE "SundaySchoolFeedbackIdea"
ADD COLUMN "type" "SundaySchoolFeedbackType" NOT NULL DEFAULT 'IDEA';
