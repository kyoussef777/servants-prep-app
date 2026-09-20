-- CreateEnum
CREATE TYPE "RoleTag" AS ENUM ('SUPER_ADMIN', 'PRIEST', 'SERVANTS_PREP_SERVANT', 'SERVANTS_PREP_STUDENT', 'SUNDAY_SCHOOL_SERVANT', 'SUNDAY_SCHOOL_STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "RoleGrantSource" AS ENUM ('SUPER_ADMIN', 'PREP_REGISTRATION', 'PARENT_SIGNUP', 'CHILD_REGISTRATION', 'GUARDIAN_LINK', 'SUNDAY_SCHOOL_ACCOUNT', 'GRADUATION', 'MIGRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SundaySchoolYearStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SundaySchoolRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SundaySchoolClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SundaySchoolEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "SundaySchoolRolloverDisposition" AS ENUM ('PROMOTE', 'HOLD', 'WITHDRAW', 'GRADUATE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "SundaySchoolRosterImportStatus" AS ENUM ('PREVIEWED', 'IN_PROGRESS', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "SundaySchoolRosterImportRowOutcome" AS ENUM ('CREATED', 'MATCHED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "SundaySchoolRolloverRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SundaySchoolRolloverItemStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditEventResult" AS ENUM ('SUCCESS', 'DENIED', 'FAILED');

-- DropForeignKey
ALTER TABLE "SundaySchoolChildGuardian" DROP CONSTRAINT "SundaySchoolChildGuardian_childId_fkey";

-- DropForeignKey
ALTER TABLE "SundaySchoolChildGuardian" DROP CONSTRAINT "SundaySchoolChildGuardian_parentId_fkey";

-- DropForeignKey
ALTER TABLE "SundaySchoolClass" DROP CONSTRAINT "SundaySchoolClass_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "SundaySchoolServantAssignment" DROP CONSTRAINT "SundaySchoolServantAssignment_ageGroupId_fkey";

-- DropForeignKey
ALTER TABLE "SundaySchoolServantAssignment" DROP CONSTRAINT "SundaySchoolServantAssignment_classId_fkey";

-- DropIndex
DROP INDEX "SundaySchoolAgeGroup_name_key";

-- DropIndex
DROP INDEX "SundaySchoolChildGuardian_childId_idx";

-- DropIndex
DROP INDEX "SundaySchoolChildGuardian_parentId_childId_key";

-- DropIndex
DROP INDEX "SundaySchoolChildGuardian_parentId_idx";

-- AlterTable
ALTER TABLE "ChildRegistrationRequest" ADD COLUMN     "resultingEnrollmentId" TEXT,
ADD COLUMN     "sundaySchoolYearId" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolAgeGroup" ADD COLUMN     "status" "SundaySchoolRecordStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "sundaySchoolYearId" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolChild" ADD COLUMN     "status" "SundaySchoolRecordStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "SundaySchoolChildAttendance" ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "placementId" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolChildGuardian" ADD COLUMN     "endedAt" TIMESTAMPTZ(3),
ADD COLUMN     "guardianProfileId" TEXT,
ADD COLUMN     "linkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "linkedById" TEXT,
ADD COLUMN     "relationshipLabel" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolClass" ADD COLUMN     "sectionName" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN     "status" "SundaySchoolClassStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "sundaySchoolYearId" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolServantAssignment" ADD COLUMN     "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "endedAt" TIMESTAMPTZ(3),
ADD COLUMN     "endedById" TEXT,
ADD COLUMN     "sundaySchoolYearId" TEXT;

-- AlterTable
ALTER TABLE "SundaySchoolVisitation" ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "placementId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "emailNormalized" TEXT,
ADD COLUMN     "serviceStartedOn" DATE,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "usernameNormalized" TEXT;

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" "RoleTag" NOT NULL,
    "source" "RoleGrantSource" NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" TEXT,
    "note" TEXT,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorAssignment" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveFrom" DATE,
    "endedAt" TIMESTAMPTZ(3),
    "endedById" TEXT,
    "endReason" TEXT,

    CONSTRAINT "MentorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SundaySchoolYearStatus" NOT NULL DEFAULT 'DRAFT',
    "previousYearId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SundaySchoolYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolAgeGroupLevel" (
    "id" TEXT NOT NULL,
    "sundaySchoolYearId" TEXT NOT NULL,
    "ageGroupId" TEXT NOT NULL,
    "level" "SundaySchoolLevel" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolAgeGroupLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolEnrollment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "sundaySchoolYearId" TEXT NOT NULL,
    "level" "SundaySchoolLevel" NOT NULL,
    "status" "SundaySchoolEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "previousEnrollmentId" TEXT,
    "rolloverDisposition" "SundaySchoolRolloverDisposition" NOT NULL DEFAULT 'PROMOTE',
    "nextLevelOverride" "SundaySchoolLevel",
    "enrolledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SundaySchoolEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolClassPlacement" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sundaySchoolYearId" TEXT NOT NULL,
    "level" "SundaySchoolLevel" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "movedById" TEXT,
    "moveReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolClassPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolGuardianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "SundaySchoolRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SundaySchoolGuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolRosterImport" (
    "id" TEXT NOT NULL,
    "sundaySchoolYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "SundaySchoolRosterImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "matchedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SundaySchoolRosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolRosterImportRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "outcome" "SundaySchoolRosterImportRowOutcome" NOT NULL,
    "childId" TEXT,
    "enrollmentId" TEXT,
    "errorCode" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolRosterImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolRolloverRun" (
    "id" TEXT NOT NULL,
    "sourceYearId" TEXT NOT NULL,
    "targetYearId" TEXT NOT NULL,
    "status" "SundaySchoolRolloverRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "errorSummary" TEXT,
    "triggeredById" TEXT,

    CONSTRAINT "SundaySchoolRolloverRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolRolloverItem" (
    "id" TEXT NOT NULL,
    "rolloverRunId" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT NOT NULL,
    "targetEnrollmentId" TEXT,
    "disposition" "SundaySchoolRolloverDisposition" NOT NULL,
    "sourceLevel" "SundaySchoolLevel" NOT NULL,
    "targetLevel" "SundaySchoolLevel",
    "status" "SundaySchoolRolloverItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SundaySchoolRolloverItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "result" "AuditEventResult" NOT NULL,
    "requestId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_revokedAt_idx" ON "UserRoleAssignment"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_tag_revokedAt_idx" ON "UserRoleAssignment"("tag", "revokedAt");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_grantedById_idx" ON "UserRoleAssignment"("grantedById");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_revokedById_idx" ON "UserRoleAssignment"("revokedById");

-- CreateIndex
CREATE INDEX "MentorAssignment_studentEnrollmentId_endedAt_idx" ON "MentorAssignment"("studentEnrollmentId", "endedAt");

-- CreateIndex
CREATE INDEX "MentorAssignment_mentorUserId_endedAt_idx" ON "MentorAssignment"("mentorUserId", "endedAt");

-- CreateIndex
CREATE INDEX "MentorAssignment_assignedById_idx" ON "MentorAssignment"("assignedById");

-- CreateIndex
CREATE INDEX "MentorAssignment_endedById_idx" ON "MentorAssignment"("endedById");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolYear_name_key" ON "SundaySchoolYear"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolYear_previousYearId_key" ON "SundaySchoolYear"("previousYearId");

-- CreateIndex
CREATE INDEX "SundaySchoolYear_status_startDate_endDate_idx" ON "SundaySchoolYear"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "SundaySchoolAgeGroupLevel_ageGroupId_idx" ON "SundaySchoolAgeGroupLevel"("ageGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAgeGroupLevel_sundaySchoolYearId_level_key" ON "SundaySchoolAgeGroupLevel"("sundaySchoolYearId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAgeGroupLevel_ageGroupId_level_key" ON "SundaySchoolAgeGroupLevel"("ageGroupId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolEnrollment_previousEnrollmentId_key" ON "SundaySchoolEnrollment"("previousEnrollmentId");

-- CreateIndex
CREATE INDEX "SundaySchoolEnrollment_sundaySchoolYearId_status_idx" ON "SundaySchoolEnrollment"("sundaySchoolYearId", "status");

-- CreateIndex
CREATE INDEX "SundaySchoolEnrollment_childId_status_idx" ON "SundaySchoolEnrollment"("childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolEnrollment_childId_sundaySchoolYearId_key" ON "SundaySchoolEnrollment"("childId", "sundaySchoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolEnrollment_id_sundaySchoolYearId_level_key" ON "SundaySchoolEnrollment"("id", "sundaySchoolYearId", "level");

-- CreateIndex
CREATE INDEX "SundaySchoolClassPlacement_enrollmentId_endedAt_idx" ON "SundaySchoolClassPlacement"("enrollmentId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolClassPlacement_classId_endedAt_idx" ON "SundaySchoolClassPlacement"("classId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolClassPlacement_movedById_idx" ON "SundaySchoolClassPlacement"("movedById");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClassPlacement_id_enrollmentId_key" ON "SundaySchoolClassPlacement"("id", "enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolGuardianProfile_userId_key" ON "SundaySchoolGuardianProfile"("userId");

-- CreateIndex
CREATE INDEX "SundaySchoolGuardianProfile_lastName_firstName_idx" ON "SundaySchoolGuardianProfile"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "SundaySchoolGuardianProfile_email_idx" ON "SundaySchoolGuardianProfile"("email");

-- CreateIndex
CREATE INDEX "SundaySchoolGuardianProfile_phone_idx" ON "SundaySchoolGuardianProfile"("phone");

-- CreateIndex
CREATE INDEX "SundaySchoolGuardianProfile_status_idx" ON "SundaySchoolGuardianProfile"("status");

-- CreateIndex
CREATE INDEX "SundaySchoolRosterImport_sundaySchoolYearId_status_idx" ON "SundaySchoolRosterImport"("sundaySchoolYearId", "status");

-- CreateIndex
CREATE INDEX "SundaySchoolRosterImport_classId_createdAt_idx" ON "SundaySchoolRosterImport"("classId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolRosterImport_createdById_idempotencyKey_key" ON "SundaySchoolRosterImport"("createdById", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SundaySchoolRosterImportRow_childId_idx" ON "SundaySchoolRosterImportRow"("childId");

-- CreateIndex
CREATE INDEX "SundaySchoolRosterImportRow_enrollmentId_idx" ON "SundaySchoolRosterImportRow"("enrollmentId");

-- CreateIndex
CREATE INDEX "SundaySchoolRosterImportRow_outcome_idx" ON "SundaySchoolRosterImportRow"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolRosterImportRow_importId_rowNumber_key" ON "SundaySchoolRosterImportRow"("importId", "rowNumber");

-- CreateIndex
CREATE INDEX "SundaySchoolRolloverRun_status_startedAt_idx" ON "SundaySchoolRolloverRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolRolloverRun_triggeredById_idx" ON "SundaySchoolRolloverRun"("triggeredById");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolRolloverRun_sourceYearId_targetYearId_key" ON "SundaySchoolRolloverRun"("sourceYearId", "targetYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolRolloverItem_targetEnrollmentId_key" ON "SundaySchoolRolloverItem"("targetEnrollmentId");

-- CreateIndex
CREATE INDEX "SundaySchoolRolloverItem_status_idx" ON "SundaySchoolRolloverItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolRolloverItem_rolloverRunId_sourceEnrollmentId_key" ON "SundaySchoolRolloverItem"("rolloverRunId", "sourceEnrollmentId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildRegistrationRequest_resultingEnrollmentId_key" ON "ChildRegistrationRequest"("resultingEnrollmentId");

-- CreateIndex
CREATE INDEX "ChildRegistrationRequest_sundaySchoolYearId_status_idx" ON "ChildRegistrationRequest"("sundaySchoolYearId", "status");

-- CreateIndex
CREATE INDEX "SundaySchoolAgeGroup_sundaySchoolYearId_status_idx" ON "SundaySchoolAgeGroup"("sundaySchoolYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAgeGroup_sundaySchoolYearId_name_key" ON "SundaySchoolAgeGroup"("sundaySchoolYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAgeGroup_id_sundaySchoolYearId_key" ON "SundaySchoolAgeGroup"("id", "sundaySchoolYearId");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_status_idx" ON "SundaySchoolChild"("status");

-- CreateIndex
CREATE INDEX "SundaySchoolChildAttendance_enrollmentId_idx" ON "SundaySchoolChildAttendance"("enrollmentId");

-- CreateIndex
CREATE INDEX "SundaySchoolChildAttendance_placementId_idx" ON "SundaySchoolChildAttendance"("placementId");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_childId_endedAt_idx" ON "SundaySchoolChildGuardian"("childId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_parentId_endedAt_idx" ON "SundaySchoolChildGuardian"("parentId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_guardianProfileId_endedAt_idx" ON "SundaySchoolChildGuardian"("guardianProfileId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_linkedById_idx" ON "SundaySchoolChildGuardian"("linkedById");

-- CreateIndex
CREATE INDEX "SundaySchoolClass_sundaySchoolYearId_status_idx" ON "SundaySchoolClass"("sundaySchoolYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClass_sundaySchoolYearId_level_sectionName_key" ON "SundaySchoolClass"("sundaySchoolYearId", "level", "sectionName");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClass_id_sundaySchoolYearId_key" ON "SundaySchoolClass"("id", "sundaySchoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClass_id_sundaySchoolYearId_level_key" ON "SundaySchoolClass"("id", "sundaySchoolYearId", "level");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_sundaySchoolYearId_endedAt_idx" ON "SundaySchoolServantAssignment"("sundaySchoolYearId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_userId_endedAt_idx" ON "SundaySchoolServantAssignment"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_endedById_idx" ON "SundaySchoolServantAssignment"("endedById");

-- CreateIndex
CREATE INDEX "SundaySchoolVisitation_enrollmentId_createdAt_idx" ON "SundaySchoolVisitation"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "SundaySchoolVisitation_placementId_createdAt_idx" ON "SundaySchoolVisitation"("placementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameNormalized_key" ON "User"("usernameNormalized");

-- CreateIndex
CREATE INDEX "User_usernameNormalized_idx" ON "User"("usernameNormalized");

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAssignment" ADD CONSTRAINT "MentorAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolYear" ADD CONSTRAINT "SundaySchoolYear_previousYearId_fkey" FOREIGN KEY ("previousYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClass" ADD CONSTRAINT "SundaySchoolClass_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClass" ADD CONSTRAINT "SundaySchoolClass_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAgeGroup" ADD CONSTRAINT "SundaySchoolAgeGroup_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAgeGroupLevel" ADD CONSTRAINT "SundaySchoolAgeGroupLevel_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAgeGroupLevel" ADD CONSTRAINT "SundaySchoolAgeGroupLevel_ageGroupId_sundaySchoolYearId_fkey" FOREIGN KEY ("ageGroupId", "sundaySchoolYearId") REFERENCES "SundaySchoolAgeGroup"("id", "sundaySchoolYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolEnrollment" ADD CONSTRAINT "SundaySchoolEnrollment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolEnrollment" ADD CONSTRAINT "SundaySchoolEnrollment_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolEnrollment" ADD CONSTRAINT "SundaySchoolEnrollment_previousEnrollmentId_fkey" FOREIGN KEY ("previousEnrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClassPlacement" ADD CONSTRAINT "SundaySchoolClassPlacement_enrollmentId_sundaySchoolYearId_fkey" FOREIGN KEY ("enrollmentId", "sundaySchoolYearId", "level") REFERENCES "SundaySchoolEnrollment"("id", "sundaySchoolYearId", "level") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClassPlacement" ADD CONSTRAINT "SundaySchoolClassPlacement_classId_sundaySchoolYearId_leve_fkey" FOREIGN KEY ("classId", "sundaySchoolYearId", "level") REFERENCES "SundaySchoolClass"("id", "sundaySchoolYearId", "level") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClassPlacement" ADD CONSTRAINT "SundaySchoolClassPlacement_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildAttendance" ADD CONSTRAINT "SundaySchoolChildAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildAttendance" ADD CONSTRAINT "SundaySchoolChildAttendance_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "SundaySchoolClassPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolVisitation" ADD CONSTRAINT "SundaySchoolVisitation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolVisitation" ADD CONSTRAINT "SundaySchoolVisitation_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "SundaySchoolClassPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_resultingEnrollmentId_fkey" FOREIGN KEY ("resultingEnrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolGuardianProfile" ADD CONSTRAINT "SundaySchoolGuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "SundaySchoolGuardianProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRosterImport" ADD CONSTRAINT "SundaySchoolRosterImport_sundaySchoolYearId_fkey" FOREIGN KEY ("sundaySchoolYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRosterImport" ADD CONSTRAINT "SundaySchoolRosterImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRosterImportRow" ADD CONSTRAINT "SundaySchoolRosterImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "SundaySchoolRosterImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRosterImportRow" ADD CONSTRAINT "SundaySchoolRosterImportRow_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRosterImportRow" ADD CONSTRAINT "SundaySchoolRosterImportRow_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverRun" ADD CONSTRAINT "SundaySchoolRolloverRun_sourceYearId_fkey" FOREIGN KEY ("sourceYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverRun" ADD CONSTRAINT "SundaySchoolRolloverRun_targetYearId_fkey" FOREIGN KEY ("targetYearId") REFERENCES "SundaySchoolYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverRun" ADD CONSTRAINT "SundaySchoolRolloverRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverItem" ADD CONSTRAINT "SundaySchoolRolloverItem_rolloverRunId_fkey" FOREIGN KEY ("rolloverRunId") REFERENCES "SundaySchoolRolloverRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverItem" ADD CONSTRAINT "SundaySchoolRolloverItem_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolRolloverItem" ADD CONSTRAINT "SundaySchoolRolloverItem_targetEnrollmentId_fkey" FOREIGN KEY ("targetEnrollmentId") REFERENCES "SundaySchoolEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Compatibility backfill
-- ---------------------------------------------------------------------------
-- Stable, deterministic identifiers make the backfill reviewable and make a
-- retry fail on a uniqueness constraint instead of silently duplicating data.

-- Keep normalized login identifiers and the session invalidation counter
-- correct for every write path, including maintenance scripts and bulk admin
-- operations that do not flow through a single API route.
CREATE OR REPLACE FUNCTION public."sync_user_identity_security"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW."email" := btrim(NEW."email");
    NEW."emailNormalized" := lower(NEW."email");

    IF NEW."username" IS NOT NULL THEN
        NEW."username" := lower(btrim(NEW."username"));
        NEW."usernameNormalized" := NEW."username";
    ELSE
        NEW."usernameNormalized" := NULL;
    END IF;

    IF TG_OP = 'UPDATE' AND (
        NEW."email" IS DISTINCT FROM OLD."email"
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

CREATE TRIGGER "User_sync_identity_security"
BEFORE INSERT OR UPDATE OF "email", "username", "password", "isDisabled", "role"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION public."sync_user_identity_security"();

ALTER TABLE "User"
  ADD CONSTRAINT "User_username_format_check"
  CHECK (
      "username" IS NULL
      OR (
          "username" = lower("username")
          AND "username" ~ '^[a-z0-9._-]{3,40}$'
          AND "username" !~ '^[^@]+@[^@]+$'
      )
  );

UPDATE "User"
SET "emailNormalized" = lower(btrim("email"))
WHERE "emailNormalized" IS NULL;

INSERT INTO "SundaySchoolYear" (
    "id", "name", "startDate", "endDate", "status", "createdAt", "updatedAt"
)
VALUES (
    'ssy_2026_2027', '2026-2027', DATE '2026-09-11', DATE '2027-09-10',
    'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

-- Preserve General for the first section in each grade. If production has
-- more than one section for a grade, use the existing class name so the new
-- year/grade/section unique key remains valid.
WITH ranked_classes AS (
    SELECT
        "id",
        row_number() OVER (
            PARTITION BY "level"
            ORDER BY "createdAt", "id"
        ) AS section_number
    FROM "SundaySchoolClass"
)
UPDATE "SundaySchoolClass" AS class
SET
    "sectionName" = CASE
        WHEN ranked_classes.section_number = 1 THEN 'General'
        ELSE class."name"
    END,
    "sundaySchoolYearId" = 'ssy_2026_2027',
    "status" = CASE
        WHEN class."isActive" THEN 'ACTIVE'::"SundaySchoolClassStatus"
        ELSE 'ARCHIVED'::"SundaySchoolClassStatus"
    END
FROM ranked_classes
WHERE ranked_classes."id" = class."id";

UPDATE "SundaySchoolAgeGroup"
SET
    "sundaySchoolYearId" = 'ssy_2026_2027',
    "status" = CASE
        WHEN "isActive" THEN 'ACTIVE'::"SundaySchoolRecordStatus"
        ELSE 'ARCHIVED'::"SundaySchoolRecordStatus"
    END;

INSERT INTO "SundaySchoolAgeGroupLevel" (
    "id", "sundaySchoolYearId", "ageGroupId", "level", "createdAt"
)
SELECT
    'ssagl_' || substr(md5(age_group."id" || ':' || grade."level"::text), 1, 20),
    age_group."sundaySchoolYearId",
    age_group."id",
    grade."level",
    CURRENT_TIMESTAMP
FROM "SundaySchoolAgeGroup" AS age_group
CROSS JOIN LATERAL unnest(age_group."levels") AS grade("level")
WHERE age_group."sundaySchoolYearId" IS NOT NULL
ON CONFLICT ("sundaySchoolYearId", "level") DO NOTHING;

UPDATE "SundaySchoolChild"
SET "status" = CASE
    WHEN "isActive" THEN 'ACTIVE'::"SundaySchoolRecordStatus"
    ELSE 'INACTIVE'::"SundaySchoolRecordStatus"
END;

UPDATE "SundaySchoolServantAssignment" AS assignment
SET "sundaySchoolYearId" = COALESCE(
    (SELECT class."sundaySchoolYearId"
     FROM "SundaySchoolClass" AS class
     WHERE class."id" = assignment."classId"),
    (SELECT age_group."sundaySchoolYearId"
     FROM "SundaySchoolAgeGroup" AS age_group
     WHERE age_group."id" = assignment."ageGroupId"),
    'ssy_2026_2027'
);

INSERT INTO "UserRoleAssignment" (
    "id", "userId", "tag", "source", "grantedAt", "note"
)
SELECT
    'ssrole_' || substr(md5(mapped."userId" || ':' || mapped.tag::text), 1, 20),
    mapped."userId",
    mapped.tag,
    'MIGRATION',
    CURRENT_TIMESTAMP,
    'Backfilled from legacy User.role'
FROM (
    SELECT "id" AS "userId", 'SUPER_ADMIN'::"RoleTag" AS tag FROM "User" WHERE role = 'SUPER_ADMIN'
    UNION ALL
    SELECT "id", 'PRIEST'::"RoleTag" FROM "User" WHERE role = 'PRIEST'
    UNION ALL
    SELECT "id", 'SERVANTS_PREP_SERVANT'::"RoleTag" FROM "User" WHERE role IN ('PRIEST', 'SERVANT_PREP')
    UNION ALL
    SELECT "id", 'SERVANTS_PREP_STUDENT'::"RoleTag" FROM "User" WHERE role = 'STUDENT'
    UNION ALL
    SELECT "id", 'SUNDAY_SCHOOL_SERVANT'::"RoleTag" FROM "User" WHERE role IN ('PRIEST', 'SERVANT')
    UNION ALL
    SELECT "id", 'PARENT'::"RoleTag" FROM "User" WHERE role = 'PARENT'
) AS mapped
ON CONFLICT DO NOTHING;

INSERT INTO "MentorAssignment" (
    "id", "studentEnrollmentId", "mentorUserId", "assignedAt", "effectiveFrom",
    "endedAt", "endReason"
)
SELECT
    'ssmentor_' || substr(md5(enrollment."id" || ':' || enrollment."mentorId"), 1, 20),
    enrollment."id",
    enrollment."mentorId",
    CASE
        WHEN enrollment."status" = 'ACTIVE' THEN CURRENT_TIMESTAMP
        ELSE COALESCE(enrollment."graduatedAt", enrollment."updatedAt")
    END,
    NULL,
    CASE
        WHEN enrollment."status" = 'ACTIVE' THEN NULL
        ELSE COALESCE(enrollment."graduatedAt", enrollment."updatedAt")
    END,
    CASE
        WHEN enrollment."status" = 'ACTIVE' THEN NULL
        ELSE 'Closed during migration because the legacy enrollment is not active'
    END
FROM "StudentEnrollment" AS enrollment
WHERE enrollment."mentorId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "SundaySchoolEnrollment" (
    "id", "childId", "sundaySchoolYearId", "level", "status",
    "rolloverDisposition", "enrolledAt", "createdAt", "updatedAt"
)
SELECT
    'ssenroll_' || substr(md5(child."id" || ':ssy_2026_2027'), 1, 20),
    child."id",
    'ssy_2026_2027',
    child."level",
    CASE
        WHEN child."isActive" THEN 'ACTIVE'::"SundaySchoolEnrollmentStatus"
        ELSE 'WITHDRAWN'::"SundaySchoolEnrollmentStatus"
    END,
    'PROMOTE',
    child."createdAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SundaySchoolChild" AS child
ON CONFLICT ("childId", "sundaySchoolYearId") DO NOTHING;

INSERT INTO "SundaySchoolClassPlacement" (
    "id", "enrollmentId", "classId", "sundaySchoolYearId", "level",
    "startedAt", "createdAt", "moveReason"
)
SELECT
    'ssplace_' || substr(md5(enrollment."id" || ':' || child."classId"), 1, 20),
    enrollment."id",
    child."classId",
    enrollment."sundaySchoolYearId",
    enrollment."level",
    enrollment."enrolledAt",
    CURRENT_TIMESTAMP,
    'Backfilled from legacy SundaySchoolChild.classId'
FROM "SundaySchoolEnrollment" AS enrollment
JOIN "SundaySchoolChild" AS child ON child."id" = enrollment."childId"
JOIN "SundaySchoolClass" AS class
  ON class."id" = child."classId"
 AND class."sundaySchoolYearId" = enrollment."sundaySchoolYearId"
 AND class."level" = enrollment."level"
WHERE child."classId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "SundaySchoolChildAttendance" AS attendance
SET
    "enrollmentId" = enrollment."id",
    "placementId" = placement."id"
FROM "SundaySchoolEnrollment" AS enrollment
JOIN "SundaySchoolClassPlacement" AS placement
  ON placement."enrollmentId" = enrollment."id"
 AND placement."endedAt" IS NULL
WHERE enrollment."childId" = attendance."childId";

UPDATE "SundaySchoolVisitation" AS visitation
SET
    "enrollmentId" = enrollment."id",
    "placementId" = placement."id"
FROM "SundaySchoolEnrollment" AS enrollment
JOIN "SundaySchoolClassPlacement" AS placement
  ON placement."enrollmentId" = enrollment."id"
 AND placement."endedAt" IS NULL
WHERE enrollment."childId" = visitation."childId";

INSERT INTO "SundaySchoolGuardianProfile" (
    "id", "userId", "firstName", "lastName", "email", "phone",
    "status", "createdAt", "updatedAt"
)
SELECT DISTINCT
    'ssguardian_' || substr(md5(parent."id"), 1, 20),
    parent."id",
    parent."name",
    '',
    parent."email",
    parent."phone",
    CASE
        WHEN parent."isDisabled" THEN 'INACTIVE'::"SundaySchoolRecordStatus"
        ELSE 'ACTIVE'::"SundaySchoolRecordStatus"
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SundaySchoolChildGuardian" AS link
JOIN "User" AS parent ON parent."id" = link."parentId"
ON CONFLICT ("userId") DO NOTHING;

UPDATE "SundaySchoolChildGuardian" AS link
SET "guardianProfileId" = profile."id"
FROM "SundaySchoolGuardianProfile" AS profile
WHERE profile."userId" = link."parentId";

-- ---------------------------------------------------------------------------
-- Database invariants Prisma 6 cannot fully express
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_revocation_order_check"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "grantedAt");

ALTER TABLE "MentorAssignment"
  ADD CONSTRAINT "MentorAssignment_end_order_check"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "assignedAt");

ALTER TABLE "SundaySchoolYear"
  ADD CONSTRAINT "SundaySchoolYear_date_order_check"
  CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT "SundaySchoolYear_no_overlap_excl"
  EXCLUDE USING gist (daterange("startDate", "endDate", '[]') WITH &&);

ALTER TABLE "SundaySchoolClassPlacement"
  ADD CONSTRAINT "SundaySchoolClassPlacement_end_order_check"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "SundaySchoolServantAssignment"
  ADD CONSTRAINT "SundaySchoolServantAssignment_scope_check"
  CHECK (("classId" IS NOT NULL)::integer + ("ageGroupId" IS NOT NULL)::integer = 1),
  ADD CONSTRAINT "SundaySchoolServantAssignment_age_group_authority_check"
  CHECK ("ageGroupId" IS NULL OR "authority" = 'COORDINATOR'),
  ADD CONSTRAINT "SundaySchoolServantAssignment_end_order_check"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "assignedAt");

ALTER TABLE "SundaySchoolChildGuardian"
  ADD CONSTRAINT "SundaySchoolChildGuardian_end_order_check"
  CHECK ("endedAt" IS NULL OR "endedAt" >= "linkedAt");

ALTER TABLE "SundaySchoolRosterImport"
  ADD CONSTRAINT "SundaySchoolRosterImport_counts_check"
  CHECK (
      "totalRows" >= 0 AND "createdRows" >= 0 AND "matchedRows" >= 0
      AND "skippedRows" >= 0 AND "failedRows" >= 0
  );

ALTER TABLE "SundaySchoolRolloverRun"
  ADD CONSTRAINT "SundaySchoolRolloverRun_distinct_years_check"
  CHECK ("sourceYearId" <> "targetYearId"),
  ADD CONSTRAINT "SundaySchoolRolloverRun_completion_order_check"
  CHECK ("completedAt" IS NULL OR "completedAt" >= "startedAt");

CREATE UNIQUE INDEX "UserRoleAssignment_active_user_tag_key"
  ON "UserRoleAssignment" ("userId", "tag")
  WHERE "revokedAt" IS NULL;

CREATE UNIQUE INDEX "MentorAssignment_active_enrollment_key"
  ON "MentorAssignment" ("studentEnrollmentId")
  WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "SundaySchoolYear_single_open_key"
  ON "SundaySchoolYear" ((1))
  WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "SundaySchoolClassPlacement_active_enrollment_key"
  ON "SundaySchoolClassPlacement" ("enrollmentId")
  WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "SundaySchoolServantAssignment_active_class_key"
  ON "SundaySchoolServantAssignment" ("userId", "sundaySchoolYearId", "classId")
  WHERE "endedAt" IS NULL AND "classId" IS NOT NULL;

CREATE UNIQUE INDEX "SundaySchoolServantAssignment_active_age_group_key"
  ON "SundaySchoolServantAssignment" ("userId", "sundaySchoolYearId", "ageGroupId")
  WHERE "endedAt" IS NULL AND "ageGroupId" IS NOT NULL;

CREATE UNIQUE INDEX "SundaySchoolChildGuardian_active_parent_child_key"
  ON "SundaySchoolChildGuardian" ("parentId", "childId")
  WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "SundaySchoolChildGuardian_active_profile_child_key"
  ON "SundaySchoolChildGuardian" ("guardianProfileId", "childId")
  WHERE "endedAt" IS NULL AND "guardianProfileId" IS NOT NULL;

-- Scope/year agreement is enforced with composite foreign keys. Null scope
-- columns are intentionally ignored by PostgreSQL, which supports exactly-one
-- scope assignments while still validating whichever scope is present.
ALTER TABLE "SundaySchoolServantAssignment"
  ADD CONSTRAINT "SundaySchoolServantAssignment_classId_sundaySchoolYearId_fkey"
  FOREIGN KEY ("classId", "sundaySchoolYearId")
  REFERENCES "SundaySchoolClass" ("id", "sundaySchoolYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SundaySchoolServantAssignment_ageGroupId_sundaySchoolYearI_fkey"
  FOREIGN KEY ("ageGroupId", "sundaySchoolYearId")
  REFERENCES "SundaySchoolAgeGroup" ("id", "sundaySchoolYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SundaySchoolRosterImport"
  ADD CONSTRAINT "SundaySchoolRosterImport_classId_sundaySchoolYearId_fkey"
  FOREIGN KEY ("classId", "sundaySchoolYearId")
  REFERENCES "SundaySchoolClass" ("id", "sundaySchoolYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
