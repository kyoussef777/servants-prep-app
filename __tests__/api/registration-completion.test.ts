import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findActiveYear: vi.fn(),
  findEnrollment: vi.fn(),
  findSubmission: vi.fn(),
  findAnnualInformation: vi.fn(),
  upsertAnnualInformation: vi.fn(),
  updateEnrollment: vi.fn(),
  deleteNotifications: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    academicYear: { findFirst: mocks.findActiveYear },
    studentEnrollment: { findUnique: mocks.findEnrollment },
    registrationSubmission: { findFirst: mocks.findSubmission },
    annualMentorInformation: { findUnique: mocks.findAnnualInformation },
    $transaction: mocks.transaction,
  },
}))

import { GET, PATCH } from '@/app/api/registration/completion/route'

const incompleteSubmission = {
  id: 'registration-1',
  approvalFormUrl: null,
  approvalFormFilename: null,
  mentorName: null,
  mentorPhone: null,
  mentorEmail: null,
}

const completedMentorInformation = {
  mentorName: 'Mentor Name',
  mentorPhone: '555-0199',
  mentorEmail: 'mentor@example.com',
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/registration/completion', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('annual mentor information completion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    mocks.findActiveYear.mockResolvedValue({ id: 'year-1', name: '2026-2027' })
    mocks.findEnrollment.mockResolvedValue({ id: 'enrollment-1', isActive: true })
    mocks.findSubmission.mockResolvedValue(incompleteSubmission)
    mocks.findAnnualInformation.mockResolvedValue(null)
    mocks.upsertAnnualInformation.mockResolvedValue(completedMentorInformation)
    mocks.updateEnrollment.mockResolvedValue({ id: 'enrollment-1' })
    mocks.deleteNotifications.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) => callback({
      annualMentorInformation: { upsert: mocks.upsertAnnualInformation },
      studentEnrollment: { update: mocks.updateEnrollment },
      notification: { deleteMany: mocks.deleteNotifications },
    }))
  })

  it('reports an optional approval form and annual mentor information as missing', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual(['approvalForm', 'mentorInformation'])
    expect(body.academicYear).toEqual({ id: 'year-1', name: '2026-2027' })
  })

  it('saves mentor information for the active year and keeps an approval reminder', async () => {
    const response = await PATCH(patchRequest(completedMentorInformation))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual(['approvalForm'])
    expect(mocks.upsertAnnualInformation).toHaveBeenCalledWith({
      where: {
        studentId_academicYearId: {
          studentId: 'student-1',
          academicYearId: 'year-1',
        },
      },
      create: expect.objectContaining({
        studentId: 'student-1',
        academicYearId: 'year-1',
        ...completedMentorInformation,
      }),
      update: expect.objectContaining(completedMentorInformation),
    })
    expect(mocks.deleteNotifications).not.toHaveBeenCalled()
  })

  it('clears the persistent reminder when approval and mentor details are complete', async () => {
    mocks.findSubmission.mockResolvedValue({
      id: 'registration-1',
      approvalFormUrl: 'https://example.com/form.pdf',
      approvalFormFilename: 'form.pdf',
      mentorName: null,
      mentorPhone: null,
      mentorEmail: null,
    })

    const response = await PATCH(patchRequest(completedMentorInformation))
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

  it('requires all three mentor fields', async () => {
    const response = await PATCH(patchRequest({ mentorName: 'Mentor Name' }))

    expect(response.status).toBe(400)
    expect(mocks.upsertAnnualInformation).not.toHaveBeenCalled()
  })
})
