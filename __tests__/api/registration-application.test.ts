import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAnnualMentorRequirement: vi.fn(),
  findApplication: vi.fn(),
  updateApplication: vi.fn(),
  findFather: vi.fn(),
  createFather: vi.fn(),
  updateEnrollment: vi.fn(),
  deleteNotifications: vi.fn(),
  upsertAnnualMentorInformation: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/annual-mentor-information', () => ({
  getAnnualMentorRequirement: mocks.getAnnualMentorRequirement,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    registrationSubmission: { findFirst: mocks.findApplication },
    $transaction: mocks.transaction,
  },
}))

import { GET, PATCH } from '@/app/api/registration/application/route'

const incompleteApplication = {
  id: 'registration-1',
  fatherOfConfessionName: null,
  approvalFormUrl: null,
  approvalFormFilename: null,
  mentorName: null,
  mentorPhone: null,
  mentorEmail: null,
}

const completedFields = {
  fatherOfConfessionName: 'Fr. Mark',
  mentorName: 'Mentor Name',
  mentorPhone: '555-0199',
  mentorEmail: 'mentor@example.com',
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/registration/application', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('post-approval application', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    mocks.getAnnualMentorRequirement.mockResolvedValue(null)
    mocks.findApplication.mockResolvedValue(incompleteApplication)
    mocks.findFather.mockResolvedValue({ id: 'father-1' })
    mocks.updateEnrollment.mockResolvedValue({ count: 1 })
    mocks.deleteNotifications.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) => callback({
      fatherOfConfession: {
        findFirst: mocks.findFather,
        create: mocks.createFather,
      },
      registrationSubmission: { update: mocks.updateApplication },
      studentEnrollment: { updateMany: mocks.updateEnrollment },
      annualMentorInformation: { upsert: mocks.upsertAnnualMentorInformation },
      notification: { deleteMany: mocks.deleteNotifications },
    }))
  })

  it('reports every second-stage section as missing for a new account', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual([
      'fatherOfConfession',
      'approvalForm',
      'mentorInformation',
    ])
  })

  it('saves church and mentor information while keeping the reminder for a missing form', async () => {
    mocks.updateApplication.mockResolvedValue({
      id: 'registration-1',
      ...completedFields,
      approvalFormUrl: null,
      approvalFormFilename: null,
    })

    const response = await PATCH(patchRequest(completedFields))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual(['approvalForm'])
    expect(mocks.updateEnrollment).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      data: {
        fatherOfConfessionId: 'father-1',
        mentorName: 'Mentor Name',
        mentorPhone: '555-0199',
      },
    })
    expect(mocks.deleteNotifications).not.toHaveBeenCalled()
  })

  it('clears the persistent reminder after all application fields are complete', async () => {
    mocks.updateApplication.mockResolvedValue({
      id: 'registration-1',
      ...completedFields,
      approvalFormUrl: 'https://example.com/form.pdf',
      approvalFormFilename: 'form.pdf',
    })

    const response = await PATCH(patchRequest(completedFields))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(true)
    expect(mocks.deleteNotifications).toHaveBeenCalledWith({
      where: {
        userId: 'student-1',
        type: 'REGISTRATION_INCOMPLETE',
        isPersistent: true,
      },
    })
  })

  it('requires the church and mentor fields', async () => {
    const response = await PATCH(patchRequest({ mentorName: 'Mentor Name' }))

    expect(response.status).toBe(400)
    expect(mocks.updateApplication).not.toHaveBeenCalled()
  })

  it('lets an already-promoted legacy student confirm mentor information without a registration record', async () => {
    mocks.findApplication.mockResolvedValue(null)
    mocks.getAnnualMentorRequirement.mockResolvedValue({
      activeYear: { id: 'year-2026', name: '2026-2027' },
      enrollment: {
        id: 'enrollment-1',
        isActive: true,
        yearLevel: 'YEAR_2',
        mentorName: 'Previous Mentor',
        mentorPhone: '555-0100',
      },
      information: null,
    })
    mocks.upsertAnnualMentorInformation.mockResolvedValue({ id: 'annual-1' })

    const getResponse = await GET()
    const getBody = await getResponse.json()

    expect(getResponse.status).toBe(200)
    expect(getBody).toMatchObject({
      annualMentorRequired: true,
      showChurchInformation: false,
      showApprovalForm: false,
      complete: false,
      missingDetails: ['mentorInformation'],
      application: {
        mentorName: 'Previous Mentor',
        mentorPhone: '555-0100',
      },
    })

    const response = await PATCH(patchRequest({
      mentorName: 'Current Mentor',
      mentorPhone: '555-0111',
      mentorEmail: 'current@example.com',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(true)
    expect(mocks.upsertAnnualMentorInformation).toHaveBeenCalledWith({
      where: {
        studentId_academicYearId: {
          studentId: 'student-1',
          academicYearId: 'year-2026',
        },
      },
      create: {
        studentId: 'student-1',
        academicYearId: 'year-2026',
        mentorName: 'Current Mentor',
        mentorPhone: '555-0111',
        mentorEmail: 'current@example.com',
      },
      update: {
        mentorName: 'Current Mentor',
        mentorPhone: '555-0111',
        mentorEmail: 'current@example.com',
        submittedAt: expect.any(Date),
      },
    })
  })
})
