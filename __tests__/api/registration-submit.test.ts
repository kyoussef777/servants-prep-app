import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StudentGrade } from '@prisma/client'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findSettings: vi.fn(),
  findInviteCode: vi.fn(),
  findSubmission: vi.fn(),
  findUser: vi.fn(),
  createSubmission: vi.fn(),
  updateInviteCode: vi.fn(),
  transaction: vi.fn(),
  notifyNewRegistration: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemSettings: { findUnique: mocks.findSettings },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/notifications', () => ({
  notifyNewRegistration: mocks.notifyNewRegistration,
}))

import { POST } from '@/app/api/registration/submit/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/registration/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const requiredApplication = {
  inviteCode: 'SP-TESTCODE',
  email: 'student@example.com',
  fullName: 'Student Name',
  dateOfBirth: '2008-01-02',
  phone: '555-0100',
  fatherOfConfessionName: 'Fr. Mark',
  previouslyServed: false,
  currentlyServing: false,
  previouslyAttendedPrep: false,
  previousPrepLocation: '',
  grade: StudentGrade.GRADE_12,
  profileImageUrl: 'https://example.com/profile.jpg',
  profileImageFilename: 'profile.jpg',
}

describe('registration submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findSettings.mockResolvedValue({ registrationEnabled: true })
    mocks.findInviteCode.mockResolvedValue({
      id: 'invite-1',
      code: 'SP-TESTCODE',
      isActive: true,
      expiresAt: null,
      usageCount: 0,
      maxUses: 10,
    })
    mocks.findSubmission.mockResolvedValue(null)
    mocks.findUser.mockResolvedValue(null)
    mocks.createSubmission.mockResolvedValue({ id: 'registration-1' })
    mocks.updateInviteCode.mockResolvedValue({})
    mocks.notifyNewRegistration.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (callback) => callback({
      inviteCode: {
        findUnique: mocks.findInviteCode,
        update: mocks.updateInviteCode,
      },
      registrationSubmission: {
        findFirst: mocks.findSubmission,
        create: mocks.createSubmission,
      },
      user: { findUnique: mocks.findUser },
    }))
  })

  it('accepts an application without approval or mentor information', async () => {
    const response = await POST(request(requiredApplication))

    expect(response.status).toBe(201)
    expect(mocks.createSubmission).toHaveBeenCalledWith({
      data: expect.objectContaining({
        approvalFormUrl: null,
        approvalFormFilename: null,
        mentorName: null,
        mentorPhone: null,
        mentorEmail: null,
      }),
    })
    expect(mocks.notifyNewRegistration).toHaveBeenCalledWith({
      applicantName: 'Student Name',
      registrationId: 'registration-1',
    })
  })

  it('still validates mentor email when it is supplied', async () => {
    const response = await POST(request({
      ...requiredApplication,
      mentorName: 'Mentor Name',
      mentorPhone: '555-0199',
      mentorEmail: 'not-an-email',
    }))

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
