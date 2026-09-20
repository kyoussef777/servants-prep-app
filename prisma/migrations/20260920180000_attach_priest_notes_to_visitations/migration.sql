ALTER TABLE "SundaySchoolPriestNote"
ADD COLUMN "visitationId" TEXT NOT NULL;

DROP INDEX "SundaySchoolPriestNote_childId_createdAt_idx";

ALTER TABLE "SundaySchoolPriestNote"
DROP CONSTRAINT "SundaySchoolPriestNote_childId_fkey";

ALTER TABLE "SundaySchoolPriestNote"
DROP COLUMN "childId";

CREATE INDEX "SundaySchoolPriestNote_visitationId_createdAt_idx"
ON "SundaySchoolPriestNote"("visitationId", "createdAt");

ALTER TABLE "SundaySchoolPriestNote"
ADD CONSTRAINT "SundaySchoolPriestNote_visitationId_fkey"
FOREIGN KEY ("visitationId") REFERENCES "SundaySchoolVisitation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
