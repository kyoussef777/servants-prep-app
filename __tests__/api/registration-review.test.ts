import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { RegistrationStatus, UserRole } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  transaction: vi.fn(),
  findSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  findUser: vi.fn(),
  createUser: vi.fn(),
  findAcademicYear: vi.fn(),
  findFather: vi.fn(),
  createEnrollment: vi.fn(),
  createNotification: vi.fn(),
  hash: vi.fn(),
  backfillAttendance: vi.fn(),
  notifyReviewed: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.hash } }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock('@/lib/api-utils', () => ({ backfillAttendanceForStudent: mocks.backfillAttendance }))
vi.mock('@/lib/notifications', () => ({ notifyRegistrationReviewed: mocks.notifyReviewed }))

import { POST } from '@/app/api/registration/submissions/[id]/review/route'

describe('registration approval follow-up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: UserRole.SUPER_ADMIN },
    })
    mocks.hash.mockResolvedValue('hashed-password')
    mocks.findSubmission.mockResolvedValue({
      id: 'registration-1',
      status: RegistrationStatus.PENDING,
      email: 'student@example.com',
      fullName: 'Student Name',
      phone: '555-0100',
      profileImageUrl: 'https://example.com/profile.jpg',
      fatherOfConfessionName: 'Fr. Mark',
      approvalFormUrl: null,
      approvalFormFilename: null,
      mentorName: null,
      mentorPhone: null,
      mentorEmail: null,
    })
    mocks.findUser.mockResolvedValue(null)
    mocks.createUser.mockResolvedValue({ id: 'student-1' })
    mocks.findAcademicYear.mockResolvedValue({ id: 'year-1' })
    mocks.findFather.mockResolvedValue({ id: 'father-1' })
    mocks.createEnrollment.mockResolvedValue({ id: 'enrollment-1' })
    mocks.createNotification.mockResolvedValue({ id: 'notification-1' })
    mocks.backfillAttendance.mockResolvedValue(undefined)
    mocks.updateSubmission.mockResolvedValue({
      id: 'registration-1',
      fullName: 'Student Name',
      createdUser: { id: 'student-1' },
    })
    mocks.notifyReviewed.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (callback) => callback({
      registrationSubmission: {
        findUnique: mocks.findSubmission,
        update: mocks.updateSubmission,
      },
      user: {
        findUnique: mocks.findUser,
        create: mocks.createUser,
      },
      academicYear: { findFirst: mocks.findAcademicYear },
      fatherOfConfession: {
        findFirst: mocks.findFather,
        create: vi.fn(),
      },
      studentEnrollment: { create: mocks.createEnrollment },
      notification: { create: mocks.createNotification },
    }))
  })

  it('creates a persistent reminder when optional registration details are missing', async () => {
    const request = new NextRequest('http://localhost/api/registration/submissions/registration-1/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', yearLevel: 'YEAR_1' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'registration-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        type: 'REGISTRATION_INCOMPLETE',
        url: '/dashboard/student/registration',
        isPersistent: true,
        metadata: {
          registrationId: 'registration-1',
          missingDetails: ['approval form', 'mentor servant information'],
        },
      }),
    })
  })
})
