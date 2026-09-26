CREATE TABLE "AnnualMentorInformation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "mentorName" TEXT NOT NULL,
    "mentorPhone" TEXT NOT NULL,
    "mentorEmail" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualMentorInformation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnualMentorInformation_studentId_academicYearId_key"
ON "AnnualMentorInformation"("studentId", "academicYearId");

CREATE INDEX "AnnualMentorInformation_academicYearId_idx"
ON "AnnualMentorInformation"("academicYearId");

ALTER TABLE "AnnualMentorInformation"
ADD CONSTRAINT "AnnualMentorInformation_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnnualMentorInformation"
ADD CONSTRAINT "AnnualMentorInformation_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
