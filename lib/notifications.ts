import webpush from 'web-push'
import { prisma } from './prisma'
import { NotificationType, Prisma, YearLevel } from '@prisma/client'

// Configure VAPID keys for web push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@servantsprep.app'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface NotificationPayload {
  title: string
  body: string
  url?: string
  tag?: string
  notificationId?: string
}

/**
 * Send push notification to a specific user (all their subscriptions)
 */
async function sendPushToUser(userId: string, payload: NotificationPayload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
      } catch (error: unknown) {
        // If subscription is expired/invalid, remove it
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
        throw error
      }
    })
  )

  return results
}

/**
 * Send push notifications to multiple users
 */
async function sendPushToUsers(userIds: string[], payload: NotificationPayload) {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)))
}

/**
 * Create an in-app notification and optionally send push
 */
async function createNotification({
  userId,
  type,
  title,
  body,
  url,
  metadata,
  sendPush = true,
}: {
  userId: string
  type: NotificationType
  title: string
  body: string
  url?: string
  metadata?: Prisma.InputJsonValue
  sendPush?: boolean
}) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, url, metadata: metadata ?? Prisma.JsonNull },
  })

  if (sendPush) {
    sendPushToUser(userId, {
      title,
      body,
      url: url || '/',
      tag: type,
      notificationId: notification.id,
    }).catch(() => {
      // Push delivery is best-effort
    })
  }

  return notification
}

/**
 * Create notifications for multiple users
 */
async function createNotifications({
  userIds,
  type,
  title,
  body,
  url,
  metadata,
  sendPush = true,
}: {
  userIds: string[]
  type: NotificationType
  title: string
  body: string
  url?: string
  metadata?: Prisma.InputJsonValue
  sendPush?: boolean
}) {
  if (userIds.length === 0) return []

  // Create in-app notifications for all users
  const notifications = await prisma.$transaction(
    userIds.map((userId) =>
      prisma.notification.create({
        data: { userId, type, title, body, url, metadata: metadata ?? Prisma.JsonNull },
      })
    )
  )

  // Send push notifications (best-effort, non-blocking)
  if (sendPush) {
    const payloads = notifications.map((n) => ({
      userId: n.userId,
      payload: {
        title,
        body,
        url: url || '/',
        tag: type,
        notificationId: n.id,
      },
    }))

    Promise.allSettled(
      payloads.map((p) => sendPushToUser(p.userId, p.payload))
    ).catch(() => {})
  }

  return notifications
}

// ============================================
// NOTIFICATION TRIGGERS
// ============================================

/**
 * Notify a student that their grade was posted
 */
export async function notifyGradePosted({
  studentId,
  studentName,
  examSection,
  percentage,
}: {
  studentId: string
  studentName: string
  examSection: string
  percentage: number
}) {
  // Notify the student
  await createNotification({
    userId: studentId,
    type: NotificationType.GRADE_POSTED,
    title: 'Grade Posted',
    body: `Your ${examSection} exam grade has been posted: ${percentage.toFixed(1)}%`,
    url: '/dashboard/student',
    metadata: { examSection, percentage },
  })

  // Notify the student's mentor
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { studentId },
    select: { mentorId: true },
  })

  if (enrollment?.mentorId) {
    await createNotification({
      userId: enrollment.mentorId,
      type: NotificationType.GRADE_POSTED,
      title: 'Mentee Grade Posted',
      body: `${studentName}'s ${examSection} exam grade: ${percentage.toFixed(1)}%`,
      url: '/dashboard/mentor',
      metadata: { studentId, studentName, examSection, percentage },
    })
  }
}

/**
 * Notify mentors when attendance is recorded for their mentees
 */
export async function notifyAttendanceRecorded({
  lessonTitle,
  lessonDate,
  studentRecords,
}: {
  lessonTitle: string
  lessonDate: string
  studentRecords: Array<{ studentId: string; studentName: string; status: string }>
}) {
  // Group students by mentor
  const studentIds = studentRecords.map((r) => r.studentId)
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId: { in: studentIds }, mentorId: { not: null } },
    select: { studentId: true, mentorId: true },
  })

  const mentorMentees = new Map<string, Array<{ studentName: string; status: string }>>()
  for (const enrollment of enrollments) {
    if (!enrollment.mentorId) continue
    const record = studentRecords.find((r) => r.studentId === enrollment.studentId)
    if (!record) continue

    if (!mentorMentees.has(enrollment.mentorId)) {
      mentorMentees.set(enrollment.mentorId, [])
    }
    mentorMentees.get(enrollment.mentorId)!.push({
      studentName: record.studentName,
      status: record.status,
    })
  }

  // Notify each mentor about their mentees' attendance
  for (const [mentorId, mentees] of mentorMentees) {
    const absentCount = mentees.filter((m) => m.status === 'ABSENT').length
    const lateCount = mentees.filter((m) => m.status === 'LATE').length

    let body = `Attendance recorded for "${lessonTitle}" (${lessonDate}). `
    if (absentCount > 0 || lateCount > 0) {
      const parts = []
      if (absentCount > 0) parts.push(`${absentCount} absent`)
      if (lateCount > 0) parts.push(`${lateCount} late`)
      body += `Your mentees: ${parts.join(', ')}.`
    } else {
      body += `All ${mentees.length} of your mentees were present.`
    }

    await createNotification({
      userId: mentorId,
      type: NotificationType.ATTENDANCE_RECORDED,
      title: 'Attendance Update',
      body,
      url: '/dashboard/mentor',
      metadata: { lessonTitle, mentees },
    })
  }
}

/**
 * Notify students about a new lesson scheduled
 */
export async function notifyLessonScheduled({
  lessonTitle,
  lessonDate,
  examSection,
  yearLevel,
}: {
  lessonTitle: string
  lessonDate: string
  examSection: string
  yearLevel?: string
}) {
  // Get all active students
  const whereClause: Prisma.StudentEnrollmentWhereInput = { isActive: true }
  if (yearLevel && Object.values(YearLevel).includes(yearLevel as YearLevel)) {
    whereClause.yearLevel = yearLevel as YearLevel
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: whereClause,
    select: { studentId: true },
  })

  const studentIds = enrollments.map((e) => e.studentId)

  await createNotifications({
    userIds: studentIds,
    type: NotificationType.LESSON_SCHEDULED,
    title: 'New Lesson Scheduled',
    body: `"${lessonTitle}" (${examSection}) scheduled for ${lessonDate}`,
    url: '/dashboard/student',
    metadata: { lessonTitle, lessonDate, examSection },
  })
}

/**
 * Notify students about a cancelled lesson
 */
export async function notifyLessonCancelled({
  lessonTitle,
  lessonDate,
  reason,
}: {
  lessonTitle: string
  lessonDate: string
  reason?: string
}) {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { isActive: true },
    select: { studentId: true },
  })

  const studentIds = enrollments.map((e) => e.studentId)

  await createNotifications({
    userIds: studentIds,
    type: NotificationType.LESSON_CANCELLED,
    title: 'Lesson Cancelled',
    body: `"${lessonTitle}" on ${lessonDate} has been cancelled${reason ? `: ${reason}` : ''}.`,
    url: '/dashboard/student',
    metadata: { lessonTitle, lessonDate, reason },
  })
}

/**
 * Notify admins about a new registration submission
 */
export async function notifyNewRegistration({
  applicantName,
  registrationId,
}: {
  applicantName: string
  registrationId: string
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['SUPER_ADMIN', 'SERVANT_PREP'] },
      isDisabled: false,
    },
    select: { id: true },
  })

  await createNotifications({
    userIds: admins.map((a) => a.id),
    type: NotificationType.REGISTRATION_RECEIVED,
    title: 'New Registration',
    body: `${applicantName} has submitted a registration application.`,
    url: '/dashboard/admin/registrations',
    metadata: { registrationId, applicantName },
  })
}

/**
 * Notify student when their registration is approved/rejected
 */
export async function notifyRegistrationReviewed({
  userId,
  status,
  applicantName,
}: {
  userId: string
  status: 'APPROVED' | 'REJECTED'
  applicantName: string
}) {
  const type =
    status === 'APPROVED'
      ? NotificationType.REGISTRATION_APPROVED
      : NotificationType.REGISTRATION_REJECTED

  await createNotification({
    userId,
    type,
    title: `Registration ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
    body:
      status === 'APPROVED'
        ? `Welcome to the Servants Preparation Program, ${applicantName}! Your registration has been approved.`
        : `Your registration application has been reviewed. Please contact administration for details.`,
    url: status === 'APPROVED' ? '/dashboard/student' : '/',
  })
}

/**
 * Notify student when their async note submission is reviewed
 */
export async function notifyAsyncNoteReviewed({
  studentId,
  lessonTitle,
  status,
  feedback,
}: {
  studentId: string
  lessonTitle: string
  status: 'APPROVED' | 'REJECTED'
  feedback?: string
}) {
  await createNotification({
    userId: studentId,
    type: NotificationType.ASYNC_NOTE_REVIEWED,
    title: `Async Note ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
    body: `Your async note for "${lessonTitle}" has been ${status.toLowerCase()}${feedback ? `. Feedback: ${feedback}` : ''}.`,
    url: '/dashboard/student/async',
    metadata: { lessonTitle, status, feedback },
  })
}

/**
 * Notify student when a mentor is assigned to them
 */
export async function notifyMentorAssigned({
  studentId,
  mentorName,
}: {
  studentId: string
  mentorName: string
}) {
  await createNotification({
    userId: studentId,
    type: NotificationType.MENTOR_ASSIGNED,
    title: 'Mentor Assigned',
    body: `${mentorName} has been assigned as your mentor.`,
    url: '/dashboard/student',
    metadata: { mentorName },
  })
}

/**
 * Send an announcement to users by role
 */
export async function sendAnnouncement({
  title,
  body,
  roles,
  url,
}: {
  title: string
  body: string
  roles: string[]
  url?: string
}) {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles as never },
      isDisabled: false,
    },
    select: { id: true },
  })

  await createNotifications({
    userIds: users.map((u) => u.id),
    type: NotificationType.ANNOUNCEMENT,
    title,
    body,
    url,
  })
}
