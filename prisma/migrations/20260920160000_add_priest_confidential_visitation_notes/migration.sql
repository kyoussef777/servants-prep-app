CREATE TABLE "SundaySchoolPriestNote" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SundaySchoolPriestNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SundaySchoolPriestNote_childId_createdAt_idx"
ON "SundaySchoolPriestNote"("childId", "createdAt");

CREATE INDEX "SundaySchoolPriestNote_authorId_createdAt_idx"
ON "SundaySchoolPriestNote"("authorId", "createdAt");

ALTER TABLE "SundaySchoolPriestNote"
ADD CONSTRAINT "SundaySchoolPriestNote_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SundaySchoolPriestNote"
ADD CONSTRAINT "SundaySchoolPriestNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
