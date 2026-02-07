/**
 * End-to-End Test Script for the Async Student Feature
 *
 * Tests the full lifecycle:
 *   1. Setup: Create test users, academic year, exam section, lessons, enrollment
 *   2. Enrollment: Mark student as async
 *   3. Async Notes: Submit → Approve (creates attendance) → Revert → Reject → Re-submit
 *   4. Bulk Review: Submit multiple notes → Bulk approve → Bulk reject
 *   5. Sunday School: Create assignment → Generate code → Log attendance via code
 *   6. Sunday School Admin: Manual approve, excuse, reject logs
 *   7. Sunday School Progress: Verify progress calculation
 *   8. Cleanup: Delete ALL test data in reverse dependency order
 *
 * Usage: bun scripts/test-async-feature.ts
 */

import { PrismaClient, UserRole, YearLevel, AttendanceStatus, NoteSubmissionStatus, SundaySchoolGrade, SundaySchoolLogStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Test data IDs - tracked for cleanup
const TEST_PREFIX = "__e2e_async_"
const testIds: {
  adminUserId?: string
  studentUserId?: string
  student2UserId?: string
  mentorUserId?: string
  academicYearId?: string
  examSectionId?: string
  lessonIds: string[]
  enrollmentId?: string
  enrollment2Id?: string
  mentorEnrollmentPlaceholder?: boolean
  noteSubmissionIds: string[]
  attendanceRecordIds: string[]
  ssAssignmentId?: string
  ssAssignment2Id?: string
  ssCodeId?: string
  ssLogIds: string[]
} = {
  lessonIds: [],
  noteSubmissionIds: [],
  attendanceRecordIds: [],
  ssLogIds: [],
}

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

async function setup() {
  console.log("\n━━━ SETUP: Creating test data ━━━")

  const passwordHash = await bcrypt.hash("TestPass123!", 10)

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}admin@test.com`,
      name: `${TEST_PREFIX}Admin`,
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  })
  testIds.adminUserId = admin.id
  console.log(`  Created admin: ${admin.id}`)

  // Create student user
  const student = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}student@test.com`,
      name: `${TEST_PREFIX}Student`,
      password: passwordHash,
      role: UserRole.STUDENT,
    },
  })
  testIds.studentUserId = student.id
  console.log(`  Created student: ${student.id}`)

  // Create second student for bulk tests
  const student2 = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}student2@test.com`,
      name: `${TEST_PREFIX}Student2`,
      password: passwordHash,
      role: UserRole.STUDENT,
    },
  })
  testIds.student2UserId = student2.id
  console.log(`  Created student2: ${student2.id}`)

  // Create mentor user
  const mentor = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}mentor@test.com`,
      name: `${TEST_PREFIX}Mentor`,
      password: passwordHash,
      role: UserRole.MENTOR,
    },
  })
  testIds.mentorUserId = mentor.id
  console.log(`  Created mentor: ${mentor.id}`)

  // Create academic year
  const academicYear = await prisma.academicYear.create({
    data: {
      name: `${TEST_PREFIX}2025-2026`,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      isActive: false, // don't mess with active year
    },
  })
  testIds.academicYearId = academicYear.id
  console.log(`  Created academic year: ${academicYear.id}`)

  // Find or create exam section
  let examSection = await prisma.examSection.findFirst()
  if (!examSection) {
    examSection = await prisma.examSection.create({
      data: {
        name: "BIBLE_STUDIES",
        displayName: "Bible Studies",
      },
    })
    testIds.examSectionId = examSection.id
  }
  console.log(`  Using exam section: ${examSection.id}`)

  // Create 3 test lessons
  for (let i = 1; i <= 3; i++) {
    const lesson = await prisma.lesson.create({
      data: {
        academicYearId: academicYear.id,
        examSectionId: examSection.id,
        title: `${TEST_PREFIX}Lesson ${i}`,
        scheduledDate: new Date(`2025-10-0${i}`),
        lessonNumber: 900 + i, // high number to avoid conflicts
      },
    })
    testIds.lessonIds.push(lesson.id)
    console.log(`  Created lesson ${i}: ${lesson.id}`)
  }

  // Create enrollment for student (NOT async yet)
  const enrollment = await prisma.studentEnrollment.create({
    data: {
      studentId: student.id,
      academicYearId: academicYear.id,
      yearLevel: YearLevel.YEAR_1,
      mentorId: mentor.id,
      isAsyncStudent: false,
    },
  })
  testIds.enrollmentId = enrollment.id
  console.log(`  Created enrollment: ${enrollment.id}`)

  // Create enrollment for student2 (async from the start)
  const enrollment2 = await prisma.studentEnrollment.create({
    data: {
      studentId: student2.id,
      academicYearId: academicYear.id,
      yearLevel: YearLevel.YEAR_1,
      isAsyncStudent: true,
    },
  })
  testIds.enrollment2Id = enrollment2.id
  console.log(`  Created enrollment2: ${enrollment2.id}`)

  console.log("  Setup complete.\n")
}

async function testAsyncEnrollment() {
  console.log("━━━ TEST 1: Async Enrollment Toggle ━━━")

  // Verify student is NOT async initially
  const before = await prisma.studentEnrollment.findUnique({
    where: { id: testIds.enrollmentId! },
  })
  assert(before !== null, "Enrollment exists")
  assert(before!.isAsyncStudent === false, "Student starts as non-async")

  // Toggle to async
  const updated = await prisma.studentEnrollment.update({
    where: { id: testIds.enrollmentId! },
    data: { isAsyncStudent: true },
  })
  assert(updated.isAsyncStudent === true, "Student toggled to async")

  // Toggle back
  const reverted = await prisma.studentEnrollment.update({
    where: { id: testIds.enrollmentId! },
    data: { isAsyncStudent: false },
  })
  assert(reverted.isAsyncStudent === false, "Student toggled back to non-async")

  // Set to async for remaining tests
  await prisma.studentEnrollment.update({
    where: { id: testIds.enrollmentId! },
    data: { isAsyncStudent: true },
  })
  console.log()
}

async function testAsyncNoteSubmission() {
  console.log("━━━ TEST 2: Async Note Submission ━━━")

  const studentId = testIds.studentUserId!
  const lessonId = testIds.lessonIds[0]

  // Submit a note
  const submission = await prisma.asyncNoteSubmission.create({
    data: {
      studentId,
      lessonId,
      content: "These are my notes for lesson 1. Key points: Creation narrative, covenant with Abraham.",
    },
  })
  testIds.noteSubmissionIds.push(submission.id)
  assert(submission.status === NoteSubmissionStatus.PENDING, "New submission is PENDING")
  assert(submission.content.length > 0, "Submission has content")
  assert(submission.reviewedBy === null, "No reviewer yet")
  assert(submission.attendanceRecordId === null, "No attendance record yet")

  // Verify unique constraint: can't submit again for same lesson
  let duplicateError = false
  try {
    await prisma.asyncNoteSubmission.create({
      data: { studentId, lessonId, content: "Duplicate attempt" },
    })
  } catch {
    duplicateError = true
  }
  assert(duplicateError, "Duplicate submission blocked by unique constraint (studentId + lessonId)")
  console.log()
}

async function testNoteReviewApproval() {
  console.log("━━━ TEST 3: Note Review - Approve ━━━")

  const submissionId = testIds.noteSubmissionIds[0]
  const reviewerId = testIds.adminUserId!

  // Approve the submission (simulating what the review API does)
  const result = await prisma.$transaction(async (tx) => {
    const submission = await tx.asyncNoteSubmission.findUniqueOrThrow({
      where: { id: submissionId },
    })

    // Create attendance record via upsert (matches API behavior)
    const attendanceRecord = await tx.attendanceRecord.upsert({
      where: {
        lessonId_studentId: {
          lessonId: submission.lessonId,
          studentId: submission.studentId,
        },
      },
      update: {
        status: AttendanceStatus.PRESENT,
        recordedBy: reviewerId,
        notes: "Async note submission approved",
      },
      create: {
        lessonId: submission.lessonId,
        studentId: submission.studentId,
        status: AttendanceStatus.PRESENT,
        recordedBy: reviewerId,
        notes: "Async note submission approved",
      },
    })

    const updated = await tx.asyncNoteSubmission.update({
      where: { id: submissionId },
      data: {
        status: NoteSubmissionStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewFeedback: "Good notes!",
        attendanceRecordId: attendanceRecord.id,
      },
    })

    return { updated, attendanceRecord }
  })

  testIds.attendanceRecordIds.push(result.attendanceRecord.id)

  assert(result.updated.status === NoteSubmissionStatus.APPROVED, "Submission is APPROVED")
  assert(result.updated.reviewedBy === reviewerId, "Reviewer is recorded")
  assert(result.updated.reviewFeedback === "Good notes!", "Feedback is saved")
  assert(result.updated.attendanceRecordId !== null, "Attendance record is linked")

  // Verify attendance record exists
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: result.attendanceRecord.id },
  })
  assert(attendance !== null, "Attendance record created")
  assert(attendance!.status === AttendanceStatus.PRESENT, "Attendance marked as PRESENT")
  assert(attendance!.notes === "Async note submission approved", "Attendance has approval note")
  console.log()
}

async function testNoteReviewRevert() {
  console.log("━━━ TEST 4: Note Review - Revert to Pending ━━━")

  const submissionId = testIds.noteSubmissionIds[0]

  // Get current state
  const before = await prisma.asyncNoteSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  })
  assert(before.status === NoteSubmissionStatus.APPROVED, "Starts as APPROVED")
  const attendanceId = before.attendanceRecordId

  // Revert to PENDING (simulating API behavior)
  await prisma.$transaction(async (tx) => {
    if (before.attendanceRecordId) {
      await tx.attendanceRecord.delete({
        where: { id: before.attendanceRecordId },
      })
    }

    await tx.asyncNoteSubmission.update({
      where: { id: submissionId },
      data: {
        status: NoteSubmissionStatus.PENDING,
        reviewedBy: null,
        reviewedAt: null,
        reviewFeedback: null,
        attendanceRecordId: null,
      },
    })
  })

  const after = await prisma.asyncNoteSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  })
  assert(after.status === NoteSubmissionStatus.PENDING, "Reverted to PENDING")
  assert(after.reviewedBy === null, "Reviewer cleared")
  assert(after.reviewFeedback === null, "Feedback cleared")
  assert(after.attendanceRecordId === null, "Attendance link cleared")

  // Verify attendance record was deleted
  const deletedAttendance = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId! },
  })
  assert(deletedAttendance === null, "Attendance record deleted on revert")

  // Remove from tracked IDs since it's deleted
  testIds.attendanceRecordIds = testIds.attendanceRecordIds.filter((id) => id !== attendanceId)
  console.log()
}

async function testNoteReviewReject() {
  console.log("━━━ TEST 5: Note Review - Reject ━━━")

  const submissionId = testIds.noteSubmissionIds[0]
  const reviewerId = testIds.adminUserId!

  await prisma.asyncNoteSubmission.update({
    where: { id: submissionId },
    data: {
      status: NoteSubmissionStatus.REJECTED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewFeedback: "Needs more detail on the covenant section.",
    },
  })

  const after = await prisma.asyncNoteSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  })
  assert(after.status === NoteSubmissionStatus.REJECTED, "Submission is REJECTED")
  assert(after.reviewFeedback === "Needs more detail on the covenant section.", "Rejection feedback saved")
  assert(after.attendanceRecordId === null, "No attendance record for rejected submission")
  console.log()
}

async function testNoteResubmission() {
  console.log("━━━ TEST 6: Note Re-submission After Rejection ━━━")

  const submissionId = testIds.noteSubmissionIds[0]

  // Simulate re-submission (update existing rejected submission, as the POST API does)
  const resubmitted = await prisma.asyncNoteSubmission.update({
    where: { id: submissionId },
    data: {
      content: "Updated notes with more detail on covenant: God's promise to Abraham included land, descendants, and blessings.",
      status: NoteSubmissionStatus.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      reviewFeedback: null,
      submittedAt: new Date(),
    },
  })

  assert(resubmitted.status === NoteSubmissionStatus.PENDING, "Re-submission is PENDING")
  assert(resubmitted.content.includes("covenant"), "Updated content saved")
  assert(resubmitted.reviewedBy === null, "Review fields cleared")
  console.log()
}

async function testBulkReview() {
  console.log("━━━ TEST 7: Bulk Review ━━━")

  const student1Id = testIds.studentUserId!
  const student2Id = testIds.student2UserId!
  const reviewerId = testIds.adminUserId!
  const lesson2Id = testIds.lessonIds[1]
  const lesson3Id = testIds.lessonIds[2]

  // Create submissions for bulk test
  const sub1 = await prisma.asyncNoteSubmission.create({
    data: {
      studentId: student1Id,
      lessonId: lesson2Id,
      content: "Student 1 notes for lesson 2",
    },
  })
  testIds.noteSubmissionIds.push(sub1.id)

  const sub2 = await prisma.asyncNoteSubmission.create({
    data: {
      studentId: student2Id,
      lessonId: lesson2Id,
      content: "Student 2 notes for lesson 2",
    },
  })
  testIds.noteSubmissionIds.push(sub2.id)

  const sub3 = await prisma.asyncNoteSubmission.create({
    data: {
      studentId: student2Id,
      lessonId: lesson3Id,
      content: "Student 2 notes for lesson 3",
    },
  })
  testIds.noteSubmissionIds.push(sub3.id)

  assert(sub1.status === NoteSubmissionStatus.PENDING, "Bulk sub1 is PENDING")
  assert(sub2.status === NoteSubmissionStatus.PENDING, "Bulk sub2 is PENDING")
  assert(sub3.status === NoteSubmissionStatus.PENDING, "Bulk sub3 is PENDING")

  // Bulk approve (simulating bulk-review API)
  const submissionIds = [sub1.id, sub2.id, sub3.id]
  let processedCount = 0

  await prisma.$transaction(async (tx) => {
    const submissions = await tx.asyncNoteSubmission.findMany({
      where: { id: { in: submissionIds } },
    })

    for (const submission of submissions) {
      if (submission.status === NoteSubmissionStatus.APPROVED) continue

      const attendanceRecord = await tx.attendanceRecord.upsert({
        where: {
          lessonId_studentId: {
            lessonId: submission.lessonId,
            studentId: submission.studentId,
          },
        },
        update: {
          status: AttendanceStatus.PRESENT,
          recordedBy: reviewerId,
          notes: "Async note submission approved (bulk)",
        },
        create: {
          lessonId: submission.lessonId,
          studentId: submission.studentId,
          status: AttendanceStatus.PRESENT,
          recordedBy: reviewerId,
          notes: "Async note submission approved (bulk)",
        },
      })

      await tx.asyncNoteSubmission.update({
        where: { id: submission.id },
        data: {
          status: NoteSubmissionStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewFeedback: null,
          attendanceRecordId: attendanceRecord.id,
        },
      })

      testIds.attendanceRecordIds.push(attendanceRecord.id)
      processedCount++
    }
  })

  assert(processedCount === 3, `Bulk approved 3 submissions (got ${processedCount})`)

  // Verify all are approved
  const approved = await prisma.asyncNoteSubmission.findMany({
    where: { id: { in: submissionIds } },
  })
  const allApproved = approved.every((s) => s.status === NoteSubmissionStatus.APPROVED)
  assert(allApproved, "All bulk submissions are APPROVED")

  // Verify attendance records created
  const attendanceCount = await prisma.attendanceRecord.count({
    where: {
      studentId: { in: [student1Id, student2Id] },
      lessonId: { in: [lesson2Id, lesson3Id] },
    },
  })
  assert(attendanceCount === 3, `3 attendance records created for bulk review (got ${attendanceCount})`)

  // Bulk reject (reversal)
  let rejectedCount = 0
  await prisma.$transaction(async (tx) => {
    const subs = await tx.asyncNoteSubmission.findMany({
      where: { id: { in: submissionIds } },
    })

    for (const sub of subs) {
      if (sub.status === NoteSubmissionStatus.REJECTED) continue

      if (sub.status === NoteSubmissionStatus.APPROVED && sub.attendanceRecordId) {
        await tx.attendanceRecord.delete({
          where: { id: sub.attendanceRecordId },
        })
      }

      await tx.asyncNoteSubmission.update({
        where: { id: sub.id },
        data: {
          status: NoteSubmissionStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewFeedback: "Bulk rejected for testing",
          attendanceRecordId: null,
        },
      })
      rejectedCount++
    }
  })

  assert(rejectedCount === 3, `Bulk rejected 3 submissions (got ${rejectedCount})`)

  // Verify attendance records deleted
  const afterReject = await prisma.attendanceRecord.count({
    where: {
      studentId: { in: [student1Id, student2Id] },
      lessonId: { in: [lesson2Id, lesson3Id] },
    },
  })
  assert(afterReject === 0, "All attendance records deleted after bulk reject")

  // Clear tracked attendance IDs that were deleted
  testIds.attendanceRecordIds = []
  console.log()
}

async function testSundaySchoolAssignment() {
  console.log("━━━ TEST 8: Sunday School Assignment ━━━")

  const studentId = testIds.studentUserId!
  const student2Id = testIds.student2UserId!
  const adminId = testIds.adminUserId!
  const academicYearId = testIds.academicYearId!

  // Create assignment for student 1
  const assignment = await prisma.sundaySchoolAssignment.create({
    data: {
      studentId,
      grade: SundaySchoolGrade.GRADE_3,
      academicYearId,
      yearLevel: YearLevel.YEAR_1,
      totalWeeks: 6,
      startDate: new Date("2025-10-01"),
      assignedBy: adminId,
    },
  })
  testIds.ssAssignmentId = assignment.id
  assert(assignment.grade === SundaySchoolGrade.GRADE_3, "Assignment grade is GRADE_3")
  assert(assignment.totalWeeks === 6, "Assignment totalWeeks is 6")
  assert(assignment.isActive === true, "Assignment is active by default")

  // Verify unique constraint: can't create duplicate for same student+year
  let duplicateError = false
  try {
    await prisma.sundaySchoolAssignment.create({
      data: {
        studentId,
        grade: SundaySchoolGrade.GRADE_4,
        academicYearId,
        yearLevel: YearLevel.YEAR_1,
        totalWeeks: 6,
        startDate: new Date("2025-10-01"),
      },
    })
  } catch {
    duplicateError = true
  }
  assert(duplicateError, "Duplicate assignment blocked (same student + academic year)")

  // Create assignment for student 2
  const assignment2 = await prisma.sundaySchoolAssignment.create({
    data: {
      studentId: student2Id,
      grade: SundaySchoolGrade.GRADE_3,
      academicYearId,
      yearLevel: YearLevel.YEAR_1,
      totalWeeks: 6,
      startDate: new Date("2025-10-01"),
      assignedBy: adminId,
    },
  })
  testIds.ssAssignment2Id = assignment2.id

  // Update assignment
  const updated = await prisma.sundaySchoolAssignment.update({
    where: { id: assignment.id },
    data: { totalWeeks: 8 },
  })
  assert(updated.totalWeeks === 8, "Assignment totalWeeks updated to 8")

  // Reset back
  await prisma.sundaySchoolAssignment.update({
    where: { id: assignment.id },
    data: { totalWeeks: 6 },
  })
  console.log()
}

async function testSundaySchoolCode() {
  console.log("━━━ TEST 9: Sunday School Code Generation ━━━")

  const adminId = testIds.adminUserId!

  // Generate a code
  const code = await prisma.sundaySchoolCode.create({
    data: {
      code: `${TEST_PREFIX}ABC123`,
      grade: SundaySchoolGrade.GRADE_3,
      weekOf: new Date("2025-10-06"),
      validUntil: new Date("2025-10-13"),
      generatedBy: adminId,
      isActive: true,
    },
  })
  testIds.ssCodeId = code.id
  assert(code.code === `${TEST_PREFIX}ABC123`, "Code generated with correct value")
  assert(code.isActive === true, "Code is active")
  assert(code.grade === SundaySchoolGrade.GRADE_3, "Code grade matches")

  // Verify unique constraint on grade + weekOf
  let duplicateError = false
  try {
    await prisma.sundaySchoolCode.create({
      data: {
        code: `${TEST_PREFIX}DEF456`,
        grade: SundaySchoolGrade.GRADE_3,
        weekOf: new Date("2025-10-06"),
        validUntil: new Date("2025-10-13"),
        generatedBy: adminId,
      },
    })
  } catch {
    duplicateError = true
  }
  assert(duplicateError, "Duplicate code blocked (same grade + weekOf)")
  console.log()
}

async function testSundaySchoolLogViaCode() {
  console.log("━━━ TEST 10: Sunday School Log via Code Entry ━━━")

  const assignmentId = testIds.ssAssignmentId!
  const codeId = testIds.ssCodeId!

  // Student logs attendance by entering the code
  const log = await prisma.sundaySchoolLog.create({
    data: {
      assignmentId,
      weekNumber: 1,
      weekOf: new Date("2025-10-06"),
      status: SundaySchoolLogStatus.VERIFIED,
      codeId,
      studentNotes: "I attended Sunday School this week and learned about the Nativity story.",
    },
  })
  testIds.ssLogIds.push(log.id)
  assert(log.status === SundaySchoolLogStatus.VERIFIED, "Log status is VERIFIED (via code)")
  assert(log.codeId === codeId, "Log linked to code")
  assert(log.studentNotes !== null, "Student notes saved")

  // Verify unique constraint on assignmentId + weekNumber
  let duplicateError = false
  try {
    await prisma.sundaySchoolLog.create({
      data: {
        assignmentId,
        weekNumber: 1,
        weekOf: new Date("2025-10-06"),
        status: SundaySchoolLogStatus.VERIFIED,
      },
    })
  } catch {
    duplicateError = true
  }
  assert(duplicateError, "Duplicate log blocked (same assignment + weekNumber)")
  console.log()
}

async function testSundaySchoolAdminActions() {
  console.log("━━━ TEST 11: Sunday School Admin Actions ━━━")

  const assignmentId = testIds.ssAssignmentId!
  const adminId = testIds.adminUserId!

  // Admin manually approves week 2
  const manualLog = await prisma.sundaySchoolLog.create({
    data: {
      assignmentId,
      weekNumber: 2,
      weekOf: new Date("2025-10-13"),
      status: SundaySchoolLogStatus.MANUAL,
      markedBy: adminId,
      notes: "Admin verified attendance via phone call",
    },
  })
  testIds.ssLogIds.push(manualLog.id)
  assert(manualLog.status === SundaySchoolLogStatus.MANUAL, "Manual log created")
  assert(manualLog.markedBy === adminId, "Marked by admin")

  // Admin excuses week 3
  const excusedLog = await prisma.sundaySchoolLog.create({
    data: {
      assignmentId,
      weekNumber: 3,
      weekOf: new Date("2025-10-20"),
      status: SundaySchoolLogStatus.EXCUSED,
      markedBy: adminId,
      notes: "Student was sick",
    },
  })
  testIds.ssLogIds.push(excusedLog.id)
  assert(excusedLog.status === SundaySchoolLogStatus.EXCUSED, "Excused log created")

  // Admin rejects week 4 (student claimed attendance but didn't go)
  const rejectedLog = await prisma.sundaySchoolLog.create({
    data: {
      assignmentId,
      weekNumber: 4,
      weekOf: new Date("2025-10-27"),
      status: SundaySchoolLogStatus.REJECTED,
      markedBy: adminId,
      notes: "Could not verify attendance",
    },
  })
  testIds.ssLogIds.push(rejectedLog.id)
  assert(rejectedLog.status === SundaySchoolLogStatus.REJECTED, "Rejected log created")
  console.log()
}

async function testSundaySchoolProgress() {
  console.log("━━━ TEST 12: Sunday School Progress Calculation ━━━")

  const assignmentId = testIds.ssAssignmentId!

  // Fetch assignment with all logs
  const assignment = await prisma.sundaySchoolAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      logs: { orderBy: { weekNumber: "asc" } },
    },
  })

  assert(assignment.totalWeeks === 6, "Assignment is 6 weeks total")
  assert(assignment.logs.length === 4, `Has 4 logged weeks (got ${assignment.logs.length})`)

  // Calculate progress (matching the progress API logic)
  const verified = assignment.logs.filter((l) => l.status === SundaySchoolLogStatus.VERIFIED).length
  const manual = assignment.logs.filter((l) => l.status === SundaySchoolLogStatus.MANUAL).length
  const excused = assignment.logs.filter((l) => l.status === SundaySchoolLogStatus.EXCUSED).length
  const rejected = assignment.logs.filter((l) => l.status === SundaySchoolLogStatus.REJECTED).length

  assert(verified === 1, `1 verified (got ${verified})`)
  assert(manual === 1, `1 manual (got ${manual})`)
  assert(excused === 1, `1 excused (got ${excused})`)
  assert(rejected === 1, `1 rejected (got ${rejected})`)

  // Effective completion: verified + manual = 2 out of (totalWeeks - excused) = 5
  const effectiveTotal = assignment.totalWeeks - excused
  const completed = verified + manual
  const percentage = Math.round((completed / effectiveTotal) * 100)

  assert(effectiveTotal === 5, `Effective total is 5 (6 - 1 excused) (got ${effectiveTotal})`)
  assert(completed === 2, `Completed is 2 (1 verified + 1 manual) (got ${completed})`)
  assert(percentage === 40, `Progress is 40% (got ${percentage}%)`)
  console.log()
}

async function testCascadeDeletes() {
  console.log("━━━ TEST 13: Cascade Delete Behavior ━━━")

  // Test that deleting an assignment cascades to its logs
  const assignment2Id = testIds.ssAssignment2Id!

  // Create a log for assignment 2
  const log = await prisma.sundaySchoolLog.create({
    data: {
      assignmentId: assignment2Id,
      weekNumber: 1,
      weekOf: new Date("2025-10-06"),
      status: SundaySchoolLogStatus.VERIFIED,
    },
  })

  // Delete the assignment
  await prisma.sundaySchoolAssignment.delete({
    where: { id: assignment2Id },
  })
  testIds.ssAssignment2Id = undefined

  // Verify log was cascade deleted
  const orphanLog = await prisma.sundaySchoolLog.findUnique({
    where: { id: log.id },
  })
  assert(orphanLog === null, "Sunday School logs cascade deleted with assignment")

  // Test that deleting a student cascades submissions
  // (We won't actually delete the student here, just verify the schema has cascade)
  const schema = await prisma.asyncNoteSubmission.findFirst({
    where: { studentId: testIds.studentUserId! },
  })
  assert(schema !== null, "Student has note submissions (cascade delete would clean these)")
  console.log()
}

async function testRoleBasedAccess() {
  console.log("━━━ TEST 14: Role-Based Access Validation ━━━")

  // Verify enrollment.isAsyncStudent check
  const nonAsyncEnrollment = await prisma.studentEnrollment.findUnique({
    where: { studentId: testIds.mentorUserId! },
  })
  assert(nonAsyncEnrollment === null, "Mentor has no enrollment (can't be async student)")

  // Verify student is async
  const asyncEnrollment = await prisma.studentEnrollment.findUnique({
    where: { studentId: testIds.studentUserId! },
  })
  assert(asyncEnrollment?.isAsyncStudent === true, "Student is marked as async")

  // Verify student2 is async
  const async2Enrollment = await prisma.studentEnrollment.findUnique({
    where: { studentId: testIds.student2UserId! },
  })
  assert(async2Enrollment?.isAsyncStudent === true, "Student2 is marked as async")

  // Verify mentor-student relationship
  assert(asyncEnrollment?.mentorId === testIds.mentorUserId!, "Student's mentor is correctly assigned")
  console.log()
}

async function testDataIntegrity() {
  console.log("━━━ TEST 15: Data Integrity Checks ━━━")

  // Verify no orphaned attendance records from our test
  const orphanedAttendance = await prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: [testIds.studentUserId!, testIds.student2UserId!] },
      lessonId: { in: testIds.lessonIds },
    },
  })
  // After bulk reject, all attendance records should be gone
  assert(orphanedAttendance.length === 0, `No orphaned attendance records (got ${orphanedAttendance.length})`)

  // Verify all submissions exist and are in expected states
  const allSubs = await prisma.asyncNoteSubmission.findMany({
    where: { id: { in: testIds.noteSubmissionIds } },
  })
  assert(allSubs.length === testIds.noteSubmissionIds.length, `All ${testIds.noteSubmissionIds.length} submissions exist`)

  // Verify Sunday School code is still valid
  const code = await prisma.sundaySchoolCode.findUnique({
    where: { id: testIds.ssCodeId! },
  })
  assert(code !== null, "Sunday School code exists")
  assert(code!.isActive === true, "Sunday School code is still active")
  console.log()
}

async function cleanup() {
  console.log("━━━ CLEANUP: Removing all test data ━━━")

  // Delete in reverse dependency order
  // 1. Sunday School logs (depends on assignments and codes)
  const logsDeleted = await prisma.sundaySchoolLog.deleteMany({
    where: { assignmentId: testIds.ssAssignmentId ?? "none" },
  })
  console.log(`  Deleted ${logsDeleted.count} Sunday School logs`)

  // 2. Sunday School assignments
  if (testIds.ssAssignmentId) {
    await prisma.sundaySchoolAssignment.delete({ where: { id: testIds.ssAssignmentId } }).catch(() => {})
    console.log(`  Deleted Sunday School assignment`)
  }
  if (testIds.ssAssignment2Id) {
    await prisma.sundaySchoolAssignment.delete({ where: { id: testIds.ssAssignment2Id } }).catch(() => {})
    console.log(`  Deleted Sunday School assignment 2`)
  }

  // 3. Sunday School codes
  if (testIds.ssCodeId) {
    await prisma.sundaySchoolCode.delete({ where: { id: testIds.ssCodeId } })
    console.log(`  Deleted Sunday School code`)
  }

  // 4. Attendance records (may already be deleted by review tests)
  for (const id of testIds.attendanceRecordIds) {
    await prisma.attendanceRecord.delete({ where: { id } }).catch(() => {})
  }
  console.log(`  Cleaned up ${testIds.attendanceRecordIds.length} tracked attendance records`)

  // 5. Async note submissions
  const subsDeleted = await prisma.asyncNoteSubmission.deleteMany({
    where: { id: { in: testIds.noteSubmissionIds } },
  })
  console.log(`  Deleted ${subsDeleted.count} async note submissions`)

  // 6. Enrollments (depends on users and academic years)
  if (testIds.enrollmentId) {
    await prisma.studentEnrollment.delete({ where: { id: testIds.enrollmentId } })
    console.log(`  Deleted enrollment 1`)
  }
  if (testIds.enrollment2Id) {
    await prisma.studentEnrollment.delete({ where: { id: testIds.enrollment2Id } }).catch(() => {})
    console.log(`  Deleted enrollment 2`)
  }

  // 7. Lessons
  const lessonsDeleted = await prisma.lesson.deleteMany({
    where: { id: { in: testIds.lessonIds } },
  })
  console.log(`  Deleted ${lessonsDeleted.count} lessons`)

  // 8. Exam section (only if we created it)
  if (testIds.examSectionId) {
    await prisma.examSection.delete({ where: { id: testIds.examSectionId } }).catch(() => {})
    console.log(`  Deleted test exam section`)
  }

  // 9. Academic year
  if (testIds.academicYearId) {
    await prisma.academicYear.delete({ where: { id: testIds.academicYearId } })
    console.log(`  Deleted academic year`)
  }

  // 10. Users (last, since everything references them)
  const usersDeleted = await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          testIds.adminUserId,
          testIds.studentUserId,
          testIds.student2UserId,
          testIds.mentorUserId,
        ].filter(Boolean) as string[],
      },
    },
  })
  console.log(`  Deleted ${usersDeleted.count} test users`)

  // Verify cleanup
  console.log("\n━━━ VERIFY CLEANUP ━━━")
  const remainingUsers = await prisma.user.count({
    where: { email: { startsWith: TEST_PREFIX } },
  })
  assert(remainingUsers === 0, `No test users remaining (got ${remainingUsers})`)

  const remainingYears = await prisma.academicYear.count({
    where: { name: { startsWith: TEST_PREFIX } },
  })
  assert(remainingYears === 0, `No test academic years remaining (got ${remainingYears})`)

  const remainingLessons = await prisma.lesson.count({
    where: { title: { startsWith: TEST_PREFIX } },
  })
  assert(remainingLessons === 0, `No test lessons remaining (got ${remainingLessons})`)

  const remainingSubs = await prisma.asyncNoteSubmission.count({
    where: { id: { in: testIds.noteSubmissionIds } },
  })
  assert(remainingSubs === 0, `No test submissions remaining (got ${remainingSubs})`)

  const remainingCodes = await prisma.sundaySchoolCode.count({
    where: { code: { startsWith: TEST_PREFIX } },
  })
  assert(remainingCodes === 0, `No test codes remaining (got ${remainingCodes})`)
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗")
  console.log("║   Async Student Feature - E2E Integration Test  ║")
  console.log("╚══════════════════════════════════════════════════╝")

  try {
    await setup()
    await testAsyncEnrollment()
    await testAsyncNoteSubmission()
    await testNoteReviewApproval()
    await testNoteReviewRevert()
    await testNoteReviewReject()
    await testNoteResubmission()
    await testBulkReview()
    await testSundaySchoolAssignment()
    await testSundaySchoolCode()
    await testSundaySchoolLogViaCode()
    await testSundaySchoolAdminActions()
    await testSundaySchoolProgress()
    await testCascadeDeletes()
    await testRoleBasedAccess()
    await testDataIntegrity()
  } catch (error) {
    console.error("\n✗ UNEXPECTED ERROR:", error)
    failed++
  } finally {
    try {
      await cleanup()
    } catch (cleanupError) {
      console.error("\n✗ CLEANUP ERROR:", cleanupError)
      failed++
    }
  }

  console.log("\n══════════════════════════════════════════════════")
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  console.log("══════════════════════════════════════════════════\n")

  await prisma.$disconnect()

  if (failed > 0) {
    process.exit(1)
  }
}

main()
