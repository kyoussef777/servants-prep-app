import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  updateSubmission: vi.fn(),
  updateEnrollment: vi.fn(),
  deleteNotifications: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    registrationSubmission: { findFirst: mocks.findFirst },
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

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/registration/completion', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('registration completion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'student-1', role: 'STUDENT' })
    mocks.findFirst.mockResolvedValue(incompleteSubmission)
    mocks.updateEnrollment.mockResolvedValue({ count: 1 })
    mocks.deleteNotifications.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (callback) => callback({
      registrationSubmission: { update: mocks.updateSubmission },
      studentEnrollment: { updateMany: mocks.updateEnrollment },
      notification: { deleteMany: mocks.deleteNotifications },
    }))
  })

  it('reports both missing registration sections', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual(['approvalForm', 'mentorInformation'])
  })

  it('keeps the reminder when only mentor information is completed', async () => {
    mocks.updateSubmission.mockResolvedValue({
      ...incompleteSubmission,
      mentorName: 'Mentor Name',
      mentorPhone: '555-0199',
      mentorEmail: 'mentor@example.com',
    })

    const response = await PATCH(patchRequest({
      mentorName: 'Mentor Name',
      mentorPhone: '555-0199',
      mentorEmail: 'mentor@example.com',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.complete).toBe(false)
    expect(body.missingDetails).toEqual(['approvalForm'])
    expect(mocks.deleteNotifications).not.toHaveBeenCalled()
  })

  it('clears the persistent reminder after every section is complete', async () => {
    mocks.findFirst.mockResolvedValue({
      ...incompleteSubmission,
      approvalFormUrl: 'https://example.com/form.pdf',
      approvalFormFilename: 'form.pdf',
    })
    mocks.updateSubmission.mockResolvedValue({
      id: 'registration-1',
      approvalFormUrl: 'https://example.com/form.pdf',
      approvalFormFilename: 'form.pdf',
      mentorName: 'Mentor Name',
      mentorPhone: '555-0199',
      mentorEmail: 'mentor@example.com',
    })

    const response = await PATCH(patchRequest({
      mentorName: 'Mentor Name',
      mentorPhone: '555-0199',
      mentorEmail: 'mentor@example.com',
    }))
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
})
