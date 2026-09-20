-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP', 'MENTOR', 'STUDENT', 'SERVANT', 'PARENT');

-- CreateEnum
CREATE TYPE "YearLevel" AS ENUM ('YEAR_1', 'YEAR_2');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ExamSectionType" AS ENUM ('BIBLE_STUDIES', 'DOGMA', 'COMPARATIVE_THEOLOGY', 'RITUAL_THEOLOGY_SACRAMENTS', 'CHURCH_HISTORY_COPTIC_HERITAGE', 'SPIRITUALITY_OF_SERVANT', 'PSYCHOLOGY_METHODOLOGY', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "SundaySchoolServantAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'NO_CLASS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExamYearLevel" AS ENUM ('YEAR_1', 'YEAR_2', 'BOTH');

-- CreateEnum
CREATE TYPE "NoteSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SundaySchoolGrade" AS ENUM ('PRE_K', 'KINDERGARTEN', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6_PLUS');

-- CreateEnum
CREATE TYPE "SundaySchoolLevel" AS ENUM ('PRE_K', 'KINDERGARTEN', 'GRADE_1', 'GRADE_2', 'GRADE_3', 'GRADE_4', 'GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12');

-- CreateEnum
CREATE TYPE "SundaySchoolAuthority" AS ENUM ('SERVANT', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "SundaySchoolVisitationStatus" AS ENUM ('DONE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "SundaySchoolFeedbackStatus" AS ENUM ('OPEN', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SundaySchoolFeedbackVoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "SundaySchoolLogStatus" AS ENUM ('VERIFIED', 'MANUAL', 'EXCUSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StudentGrade" AS ENUM ('GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'COLLEGE_FRESHMAN', 'COLLEGE_SOPHOMORE', 'COLLEGE_JUNIOR', 'COLLEGE_SENIOR', 'POST_COLLEGE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GRADE_POSTED', 'ATTENDANCE_RECORDED', 'LESSON_SCHEDULED', 'LESSON_CANCELLED', 'REGISTRATION_RECEIVED', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'ASYNC_NOTE_REVIEWED', 'MENTOR_ASSIGNED', 'ANNOUNCEMENT', 'CONDUCT_REMOVAL', 'SERVANT_APPLICATION_RECEIVED', 'SERVANT_APPLICATION_REVIEWED', 'CHILD_REGISTRATION_RECEIVED', 'CHILD_REGISTRATION_REVIEWED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "profileImageUrl" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "graduatedAcademicYearId" TEXT,
    "yearLevel" "YearLevel" NOT NULL,
    "mentorId" TEXT,
    "mentorName" TEXT,
    "mentorPhone" TEXT,
    "fatherOfConfessionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graduatedAt" TIMESTAMP(3),
    "graduationNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAsyncStudent" BOOLEAN NOT NULL DEFAULT false,
    "asyncApprovedAt" TIMESTAMP(3),
    "asyncApprovedBy" TEXT,
    "asyncReason" TEXT,
    "attendanceStartDate" TIMESTAMP(3),

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSection" (
    "id" TEXT NOT NULL,
    "name" "ExamSectionType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "averageRequirement" INTEGER NOT NULL DEFAULT 75,

    CONSTRAINT "ExamSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examSectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "speaker" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "lessonNumber" INTEGER NOT NULL,
    "isExamDay" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conductRemoval" BOOLEAN NOT NULL DEFAULT false,
    "conductNote" TEXT,
    "notEnrolledYet" BOOLEAN NOT NULL DEFAULT false,
    "expectedAbsenceId" TEXT,
    "expectedAbsenceNA" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedAbsence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "markAsNA" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examSectionId" TEXT NOT NULL,
    "yearLevel" "ExamYearLevel" NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamScore" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "gradedBy" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FatherOfConfession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "church" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FatherOfConfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsyncNoteSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NoteSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewFeedback" TEXT,
    "attendanceRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncNoteSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grade" "SundaySchoolGrade" NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "yearLevel" "YearLevel" NOT NULL,
    "totalWeeks" INTEGER NOT NULL DEFAULT 6,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" "SundaySchoolGrade" NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "status" "SundaySchoolLogStatus" NOT NULL,
    "codeId" TEXT,
    "markedBy" TEXT,
    "notes" TEXT,
    "studentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "SundaySchoolLevel" NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolAgeGroup" (
    "overseerId" TEXT,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "levels" "SundaySchoolLevel"[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolAgeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolServantAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "authority" "SundaySchoolAuthority" NOT NULL,
    "classId" TEXT,
    "ageGroupId" TEXT,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolServantAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolChild" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "level" "SundaySchoolLevel" NOT NULL,
    "classId" TEXT,
    "familyId" TEXT,
    "userId" TEXT,
    "birthDate" TIMESTAMP(3),
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "homeAddress" TEXT,
    "motherName" TEXT,
    "motherPhone" TEXT,
    "motherEmail" TEXT,
    "fatherName" TEXT,
    "fatherPhone" TEXT,
    "fatherEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolWeeklyLesson" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sundayDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "ownerId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolWeeklyLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolWeeklyLessonResource" (
    "id" TEXT NOT NULL,
    "weeklyLessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolWeeklyLessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "topic" TEXT,
    "notes" TEXT,
    "takenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolChildAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolChildAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolServantAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "status" "SundaySchoolServantAttendanceStatus" NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolServantAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolVisitation" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "status" "SundaySchoolVisitationStatus" NOT NULL DEFAULT 'NOT_DONE',
    "visitedAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolVisitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolFeedbackIdea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SundaySchoolFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolFeedbackIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolFeedbackVote" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "SundaySchoolFeedbackVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SundaySchoolFeedbackVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationSubmission" (
    "id" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "fatherOfConfessionName" TEXT NOT NULL,
    "previouslyServed" BOOLEAN NOT NULL,
    "currentlyServing" BOOLEAN NOT NULL,
    "previouslyAttendedPrep" BOOLEAN NOT NULL,
    "previousPrepLocation" TEXT,
    "grade" "StudentGrade" NOT NULL,
    "approvalFormUrl" TEXT NOT NULL,
    "approvalFormFilename" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "profileImageFilename" TEXT,
    "mentorName" TEXT NOT NULL,
    "mentorPhone" TEXT NOT NULL,
    "mentorEmail" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantApplication" (
    "id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "availability" TEXT,
    "motivation" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildRegistrationRequest" (
    "id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedByUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "intendedLevel" "SundaySchoolLevel" NOT NULL,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdChildId" TEXT,
    "placedClassId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildRegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SundaySchoolChildGuardian" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SundaySchoolChildGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");

-- CreateIndex
CREATE INDEX "AcademicYear_isActive_idx" ON "AcademicYear"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_key" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_mentorId_idx" ON "StudentEnrollment"("mentorId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_isActive_idx" ON "StudentEnrollment"("isActive");

-- CreateIndex
CREATE INDEX "StudentEnrollment_status_idx" ON "StudentEnrollment"("status");

-- CreateIndex
CREATE INDEX "StudentEnrollment_academicYearId_idx" ON "StudentEnrollment"("academicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_graduatedAcademicYearId_idx" ON "StudentEnrollment"("graduatedAcademicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_fatherOfConfessionId_idx" ON "StudentEnrollment"("fatherOfConfessionId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_mentorId_isActive_idx" ON "StudentEnrollment"("mentorId", "isActive");

-- CreateIndex
CREATE INDEX "StudentEnrollment_mentorId_status_idx" ON "StudentEnrollment"("mentorId", "status");

-- CreateIndex
CREATE INDEX "StudentEnrollment_isAsyncStudent_idx" ON "StudentEnrollment"("isAsyncStudent");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSection_name_key" ON "ExamSection"("name");

-- CreateIndex
CREATE INDEX "Lesson_academicYearId_idx" ON "Lesson"("academicYearId");

-- CreateIndex
CREATE INDEX "Lesson_examSectionId_idx" ON "Lesson"("examSectionId");

-- CreateIndex
CREATE INDEX "Lesson_scheduledDate_idx" ON "Lesson"("scheduledDate");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_academicYearId_lessonNumber_key" ON "Lesson"("academicYearId", "lessonNumber");

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_lessonId_idx" ON "AttendanceRecord"("lessonId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_conductRemoval_idx" ON "AttendanceRecord"("conductRemoval");

-- CreateIndex
CREATE INDEX "AttendanceRecord_notEnrolledYet_idx" ON "AttendanceRecord"("notEnrolledYet");

-- CreateIndex
CREATE INDEX "AttendanceRecord_expectedAbsenceId_idx" ON "AttendanceRecord"("expectedAbsenceId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_lessonId_idx" ON "AttendanceRecord"("studentId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_lessonId_studentId_key" ON "AttendanceRecord"("lessonId", "studentId");

-- CreateIndex
CREATE INDEX "ExpectedAbsence_studentId_idx" ON "ExpectedAbsence"("studentId");

-- CreateIndex
CREATE INDEX "ExpectedAbsence_startDate_idx" ON "ExpectedAbsence"("startDate");

-- CreateIndex
CREATE INDEX "ExpectedAbsence_endDate_idx" ON "ExpectedAbsence"("endDate");

-- CreateIndex
CREATE INDEX "Exam_academicYearId_idx" ON "Exam"("academicYearId");

-- CreateIndex
CREATE INDEX "Exam_examSectionId_idx" ON "Exam"("examSectionId");

-- CreateIndex
CREATE INDEX "Exam_yearLevel_idx" ON "Exam"("yearLevel");

-- CreateIndex
CREATE INDEX "ExamScore_examId_idx" ON "ExamScore"("examId");

-- CreateIndex
CREATE INDEX "ExamScore_studentId_idx" ON "ExamScore"("studentId");

-- CreateIndex
CREATE INDEX "ExamScore_studentId_examId_idx" ON "ExamScore"("studentId", "examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamScore_examId_studentId_key" ON "ExamScore"("examId", "studentId");

-- CreateIndex
CREATE INDEX "StudentNote_studentId_idx" ON "StudentNote"("studentId");

-- CreateIndex
CREATE INDEX "StudentNote_authorId_idx" ON "StudentNote"("authorId");

-- CreateIndex
CREATE INDEX "StudentNote_createdAt_idx" ON "StudentNote"("createdAt");

-- CreateIndex
CREATE INDEX "FatherOfConfession_isActive_idx" ON "FatherOfConfession"("isActive");

-- CreateIndex
CREATE INDEX "FatherOfConfession_name_idx" ON "FatherOfConfession"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AsyncNoteSubmission_attendanceRecordId_key" ON "AsyncNoteSubmission"("attendanceRecordId");

-- CreateIndex
CREATE INDEX "AsyncNoteSubmission_studentId_idx" ON "AsyncNoteSubmission"("studentId");

-- CreateIndex
CREATE INDEX "AsyncNoteSubmission_lessonId_idx" ON "AsyncNoteSubmission"("lessonId");

-- CreateIndex
CREATE INDEX "AsyncNoteSubmission_status_idx" ON "AsyncNoteSubmission"("status");

-- CreateIndex
CREATE INDEX "AsyncNoteSubmission_submittedAt_idx" ON "AsyncNoteSubmission"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AsyncNoteSubmission_studentId_lessonId_key" ON "AsyncNoteSubmission"("studentId", "lessonId");

-- CreateIndex
CREATE INDEX "SundaySchoolAssignment_studentId_idx" ON "SundaySchoolAssignment"("studentId");

-- CreateIndex
CREATE INDEX "SundaySchoolAssignment_academicYearId_idx" ON "SundaySchoolAssignment"("academicYearId");

-- CreateIndex
CREATE INDEX "SundaySchoolAssignment_grade_idx" ON "SundaySchoolAssignment"("grade");

-- CreateIndex
CREATE INDEX "SundaySchoolAssignment_isActive_idx" ON "SundaySchoolAssignment"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAssignment_studentId_academicYearId_key" ON "SundaySchoolAssignment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolCode_code_key" ON "SundaySchoolCode"("code");

-- CreateIndex
CREATE INDEX "SundaySchoolCode_code_idx" ON "SundaySchoolCode"("code");

-- CreateIndex
CREATE INDEX "SundaySchoolCode_grade_idx" ON "SundaySchoolCode"("grade");

-- CreateIndex
CREATE INDEX "SundaySchoolCode_weekOf_idx" ON "SundaySchoolCode"("weekOf");

-- CreateIndex
CREATE INDEX "SundaySchoolCode_validUntil_idx" ON "SundaySchoolCode"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolCode_grade_weekOf_key" ON "SundaySchoolCode"("grade", "weekOf");

-- CreateIndex
CREATE INDEX "SundaySchoolLog_assignmentId_idx" ON "SundaySchoolLog"("assignmentId");

-- CreateIndex
CREATE INDEX "SundaySchoolLog_status_idx" ON "SundaySchoolLog"("status");

-- CreateIndex
CREATE INDEX "SundaySchoolLog_weekOf_idx" ON "SundaySchoolLog"("weekOf");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolLog_assignmentId_weekNumber_key" ON "SundaySchoolLog"("assignmentId", "weekNumber");

-- CreateIndex
CREATE INDEX "SundaySchoolClass_level_idx" ON "SundaySchoolClass"("level");

-- CreateIndex
CREATE INDEX "SundaySchoolClass_isActive_idx" ON "SundaySchoolClass"("isActive");

-- CreateIndex
CREATE INDEX "SundaySchoolClass_academicYearId_idx" ON "SundaySchoolClass"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolClass_name_academicYearId_key" ON "SundaySchoolClass"("name", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolAgeGroup_name_key" ON "SundaySchoolAgeGroup"("name");

-- CreateIndex
CREATE INDEX "SundaySchoolAgeGroup_overseerId_idx" ON "SundaySchoolAgeGroup"("overseerId");

-- CreateIndex
CREATE INDEX "SundaySchoolAgeGroup_isActive_idx" ON "SundaySchoolAgeGroup"("isActive");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_userId_academicYearId_idx" ON "SundaySchoolServantAssignment"("userId", "academicYearId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_classId_idx" ON "SundaySchoolServantAssignment"("classId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_ageGroupId_idx" ON "SundaySchoolServantAssignment"("ageGroupId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAssignment_academicYearId_idx" ON "SundaySchoolServantAssignment"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolChild_userId_key" ON "SundaySchoolChild"("userId");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_classId_idx" ON "SundaySchoolChild"("classId");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_familyId_idx" ON "SundaySchoolChild"("familyId");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_level_idx" ON "SundaySchoolChild"("level");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_isActive_idx" ON "SundaySchoolChild"("isActive");

-- CreateIndex
CREATE INDEX "SundaySchoolChild_lastName_firstName_idx" ON "SundaySchoolChild"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "SundaySchoolFamily_name_idx" ON "SundaySchoolFamily"("name");

-- CreateIndex
CREATE INDEX "SundaySchoolWeeklyLesson_sundayDate_idx" ON "SundaySchoolWeeklyLesson"("sundayDate");

-- CreateIndex
CREATE INDEX "SundaySchoolWeeklyLesson_ownerId_sundayDate_idx" ON "SundaySchoolWeeklyLesson"("ownerId", "sundayDate");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolWeeklyLesson_classId_sundayDate_key" ON "SundaySchoolWeeklyLesson"("classId", "sundayDate");

-- CreateIndex
CREATE INDEX "SundaySchoolWeeklyLessonResource_weeklyLessonId_idx" ON "SundaySchoolWeeklyLessonResource"("weeklyLessonId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolWeeklyLessonResource_weeklyLessonId_sortOrder_key" ON "SundaySchoolWeeklyLessonResource"("weeklyLessonId", "sortOrder");

-- CreateIndex
CREATE INDEX "SundaySchoolSession_classId_date_idx" ON "SundaySchoolSession"("classId", "date");

-- CreateIndex
CREATE INDEX "SundaySchoolSession_date_idx" ON "SundaySchoolSession"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolSession_classId_date_key" ON "SundaySchoolSession"("classId", "date");

-- CreateIndex
CREATE INDEX "SundaySchoolChildAttendance_sessionId_idx" ON "SundaySchoolChildAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "SundaySchoolChildAttendance_childId_idx" ON "SundaySchoolChildAttendance"("childId");

-- CreateIndex
CREATE INDEX "SundaySchoolChildAttendance_status_idx" ON "SundaySchoolChildAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolChildAttendance_sessionId_childId_key" ON "SundaySchoolChildAttendance"("sessionId", "childId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAttendance_sessionId_idx" ON "SundaySchoolServantAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAttendance_servantId_idx" ON "SundaySchoolServantAttendance"("servantId");

-- CreateIndex
CREATE INDEX "SundaySchoolServantAttendance_status_idx" ON "SundaySchoolServantAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolServantAttendance_sessionId_servantId_key" ON "SundaySchoolServantAttendance"("sessionId", "servantId");

-- CreateIndex
CREATE INDEX "SundaySchoolVisitation_classId_createdAt_idx" ON "SundaySchoolVisitation"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "SundaySchoolVisitation_childId_createdAt_idx" ON "SundaySchoolVisitation"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "SundaySchoolVisitation_status_idx" ON "SundaySchoolVisitation"("status");

-- CreateIndex
CREATE INDEX "SundaySchoolFeedbackIdea_status_createdAt_idx" ON "SundaySchoolFeedbackIdea"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SundaySchoolFeedbackIdea_submittedById_idx" ON "SundaySchoolFeedbackIdea"("submittedById");

-- CreateIndex
CREATE INDEX "SundaySchoolFeedbackVote_ideaId_vote_idx" ON "SundaySchoolFeedbackVote"("ideaId", "vote");

-- CreateIndex
CREATE INDEX "SundaySchoolFeedbackVote_userId_idx" ON "SundaySchoolFeedbackVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolFeedbackVote_ideaId_userId_key" ON "SundaySchoolFeedbackVote"("ideaId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "InviteCode_isActive_idx" ON "InviteCode"("isActive");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "RegistrationSubmission_inviteCodeId_idx" ON "RegistrationSubmission"("inviteCodeId");

-- CreateIndex
CREATE INDEX "RegistrationSubmission_status_idx" ON "RegistrationSubmission"("status");

-- CreateIndex
CREATE INDEX "RegistrationSubmission_email_idx" ON "RegistrationSubmission"("email");

-- CreateIndex
CREATE INDEX "RegistrationSubmission_createdAt_idx" ON "RegistrationSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "ServantApplication_status_idx" ON "ServantApplication"("status");

-- CreateIndex
CREATE INDEX "ServantApplication_email_idx" ON "ServantApplication"("email");

-- CreateIndex
CREATE INDEX "ServantApplication_createdAt_idx" ON "ServantApplication"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChildRegistrationRequest_createdChildId_key" ON "ChildRegistrationRequest"("createdChildId");

-- CreateIndex
CREATE INDEX "ChildRegistrationRequest_status_idx" ON "ChildRegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "ChildRegistrationRequest_submittedByUserId_idx" ON "ChildRegistrationRequest"("submittedByUserId");

-- CreateIndex
CREATE INDEX "ChildRegistrationRequest_intendedLevel_idx" ON "ChildRegistrationRequest"("intendedLevel");

-- CreateIndex
CREATE INDEX "ChildRegistrationRequest_createdAt_idx" ON "ChildRegistrationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_childId_idx" ON "SundaySchoolChildGuardian"("childId");

-- CreateIndex
CREATE INDEX "SundaySchoolChildGuardian_parentId_idx" ON "SundaySchoolChildGuardian"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SundaySchoolChildGuardian_parentId_childId_key" ON "SundaySchoolChildGuardian"("parentId", "childId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_graduatedAcademicYearId_fkey" FOREIGN KEY ("graduatedAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_fatherOfConfessionId_fkey" FOREIGN KEY ("fatherOfConfessionId") REFERENCES "FatherOfConfession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_asyncApprovedBy_fkey" FOREIGN KEY ("asyncApprovedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_examSectionId_fkey" FOREIGN KEY ("examSectionId") REFERENCES "ExamSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_expectedAbsenceId_fkey" FOREIGN KEY ("expectedAbsenceId") REFERENCES "ExpectedAbsence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedAbsence" ADD CONSTRAINT "ExpectedAbsence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedAbsence" ADD CONSTRAINT "ExpectedAbsence_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_examSectionId_fkey" FOREIGN KEY ("examSectionId") REFERENCES "ExamSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamScore" ADD CONSTRAINT "ExamScore_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamScore" ADD CONSTRAINT "ExamScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamScore" ADD CONSTRAINT "ExamScore_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncNoteSubmission" ADD CONSTRAINT "AsyncNoteSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncNoteSubmission" ADD CONSTRAINT "AsyncNoteSubmission_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncNoteSubmission" ADD CONSTRAINT "AsyncNoteSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncNoteSubmission" ADD CONSTRAINT "AsyncNoteSubmission_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAssignment" ADD CONSTRAINT "SundaySchoolAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAssignment" ADD CONSTRAINT "SundaySchoolAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAssignment" ADD CONSTRAINT "SundaySchoolAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolCode" ADD CONSTRAINT "SundaySchoolCode_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolLog" ADD CONSTRAINT "SundaySchoolLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SundaySchoolAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolLog" ADD CONSTRAINT "SundaySchoolLog_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "SundaySchoolCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolLog" ADD CONSTRAINT "SundaySchoolLog_markedBy_fkey" FOREIGN KEY ("markedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolClass" ADD CONSTRAINT "SundaySchoolClass_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolAgeGroup" ADD CONSTRAINT "SundaySchoolAgeGroup_overseerId_fkey" FOREIGN KEY ("overseerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "SundaySchoolAgeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAssignment" ADD CONSTRAINT "SundaySchoolServantAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChild" ADD CONSTRAINT "SundaySchoolChild_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChild" ADD CONSTRAINT "SundaySchoolChild_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "SundaySchoolFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChild" ADD CONSTRAINT "SundaySchoolChild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolWeeklyLesson" ADD CONSTRAINT "SundaySchoolWeeklyLesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolWeeklyLesson" ADD CONSTRAINT "SundaySchoolWeeklyLesson_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolWeeklyLesson" ADD CONSTRAINT "SundaySchoolWeeklyLesson_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolWeeklyLessonResource" ADD CONSTRAINT "SundaySchoolWeeklyLessonResource_weeklyLessonId_fkey" FOREIGN KEY ("weeklyLessonId") REFERENCES "SundaySchoolWeeklyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolSession" ADD CONSTRAINT "SundaySchoolSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolSession" ADD CONSTRAINT "SundaySchoolSession_takenBy_fkey" FOREIGN KEY ("takenBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildAttendance" ADD CONSTRAINT "SundaySchoolChildAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SundaySchoolSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildAttendance" ADD CONSTRAINT "SundaySchoolChildAttendance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildAttendance" ADD CONSTRAINT "SundaySchoolChildAttendance_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAttendance" ADD CONSTRAINT "SundaySchoolServantAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SundaySchoolSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAttendance" ADD CONSTRAINT "SundaySchoolServantAttendance_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolServantAttendance" ADD CONSTRAINT "SundaySchoolServantAttendance_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolVisitation" ADD CONSTRAINT "SundaySchoolVisitation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SundaySchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolVisitation" ADD CONSTRAINT "SundaySchoolVisitation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolVisitation" ADD CONSTRAINT "SundaySchoolVisitation_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolFeedbackIdea" ADD CONSTRAINT "SundaySchoolFeedbackIdea_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolFeedbackVote" ADD CONSTRAINT "SundaySchoolFeedbackVote_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "SundaySchoolFeedbackIdea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolFeedbackVote" ADD CONSTRAINT "SundaySchoolFeedbackVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationSubmission" ADD CONSTRAINT "RegistrationSubmission_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationSubmission" ADD CONSTRAINT "RegistrationSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationSubmission" ADD CONSTRAINT "RegistrationSubmission_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantApplication" ADD CONSTRAINT "ServantApplication_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantApplication" ADD CONSTRAINT "ServantApplication_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_createdChildId_fkey" FOREIGN KEY ("createdChildId") REFERENCES "SundaySchoolChild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildRegistrationRequest" ADD CONSTRAINT "ChildRegistrationRequest_placedClassId_fkey" FOREIGN KEY ("placedClassId") REFERENCES "SundaySchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SundaySchoolChildGuardian" ADD CONSTRAINT "SundaySchoolChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "SundaySchoolChild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
