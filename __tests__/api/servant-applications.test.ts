import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findApplication: vi.fn(),
  findUser: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  createUser: vi.fn(),
  transaction: vi.fn(),
  notifyNewApplication: vi.fn(),
  notifyReviewedApplication: vi.fn(),
  hash: vi.fn(),
  generateTempPassword: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/notifications', () => ({
  notifyNewServantApplication: mocks.notifyNewApplication,
  notifyServantApplicationReviewed: mocks.notifyReviewedApplication,
}))
vi.mock('@/lib/registration-utils', () => ({
  generateTempPassword: mocks.generateTempPassword,
}))
vi.mock('bcryptjs', () => ({
  default: { hash: mocks.hash },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servantApplication: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}))

import { GET } from '@/app/api/servant-applications/route'
import { POST } from '@/app/api/servant-applications/submit/route'
import { POST as REVIEW } from '@/app/api/servant-applications/[id]/review/route'

function submissionRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/servant-applications/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('servant applications API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'admin-1', role: 'SUPER_ADMIN' })
    mocks.findMany.mockResolvedValue([])
    mocks.findFirst.mockResolvedValue(null)
    mocks.findApplication.mockResolvedValue({
      id: 'application-1',
      status: 'PENDING',
      email: 'servant@example.com',
      fullName: 'Sunday Servant',
      phone: '555-0100',
    })
    mocks.findUser.mockResolvedValue(null)
    mocks.createApplication.mockResolvedValue({ id: 'application-1' })
    mocks.createUser.mockResolvedValue({ id: 'servant-1' })
    mocks.updateApplication.mockResolvedValue({
      id: 'application-1',
      fullName: 'Sunday Servant',
      createdUser: { id: 'servant-1' },
    })
    mocks.notifyNewApplication.mockResolvedValue(undefined)
    mocks.notifyReviewedApplication.mockResolvedValue(undefined)
    mocks.hash.mockResolvedValue('hashed-password')
    mocks.generateTempPassword.mockReturnValue('Temporary1!')
    mocks.transaction.mockImplementation(async callback => callback({
      servantApplication: {
        findFirst: mocks.findFirst,
        findUnique: mocks.findApplication,
        create: mocks.createApplication,
        update: mocks.updateApplication,
      },
      user: {
        findUnique: mocks.findUser,
        create: mocks.createUser,
      },
    }))
  })

  it('requires the applicant current grade', async () => {
    const response = await POST(submissionRequest({
      email: 'servant@example.com',
      fullName: 'Sunday Servant',
      phone: '555-0100',
    }))

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('stores the four public fields and normalizes their values', async () => {
    const response = await POST(submissionRequest({
      email: '  SERVANT@example.com ',
      fullName: '  Sunday Servant ',
      phone: ' 555-0100 ',
      currentGrade: ' 3rd grade ',
    }))

    expect(response.status).toBe(201)
    expect(mocks.createApplication).toHaveBeenCalledWith({
      data: {
        status: 'PENDING',
        email: 'servant@example.com',
        fullName: 'Sunday Servant',
        phone: '555-0100',
        motivation: '3rd grade',
      },
    })
    expect(mocks.notifyNewApplication).toHaveBeenCalledWith({
      applicantName: 'Sunday Servant',
      applicationId: 'application-1',
    })
  })

  it('keeps the review queue restricted to Super Admins', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'prep-1', role: 'SERVANT_PREP' })

    const response = await GET(new Request('http://localhost/api/servant-applications'))

    expect(response.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('exposes the stored compatibility value as currentGrade', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'application-1',
      status: 'PENDING',
      email: 'servant@example.com',
      fullName: 'Sunday Servant',
      phone: '555-0100',
      motivation: '3rd grade',
      createdAt: new Date('2026-09-20T12:00:00Z'),
      reviewedAt: null,
      reviewNote: null,
      reviewer: null,
    }])

    const response = await GET(new Request('http://localhost/api/servant-applications'))
    const applications = await response.json()

    expect(response.status).toBe(200)
    expect(applications).toEqual([
      expect.objectContaining({
        id: 'application-1',
        currentGrade: '3rd grade',
      }),
    ])
    expect(applications[0]).not.toHaveProperty('motivation')
    expect(applications[0]).not.toHaveProperty('availability')
  })

  it('allows a Super Admin to approve and create the servant account', async () => {
    const request = new NextRequest(
      'http://localhost/api/servant-applications/application-1/review',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', note: 'Approved' }),
      }
    )

    const response = await REVIEW(request, {
      params: Promise.resolve({ id: 'application-1' }),
    })
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.createUser).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'servant@example.com',
        name: 'Sunday Servant',
        phone: '555-0100',
        password: 'hashed-password',
        role: 'SERVANT',
        mustChangePassword: true,
      }),
    })
    expect(mocks.updateApplication).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'application-1' },
      data: expect.objectContaining({
        status: 'APPROVED',
        reviewedBy: 'admin-1',
        createdUserId: 'servant-1',
      }),
    }))
    expect(result.tempPassword).toBe('Temporary1!')
    expect(mocks.notifyReviewedApplication).toHaveBeenCalledWith({
      userId: 'servant-1',
      status: 'APPROVED',
      applicantName: 'Sunday Servant',
    })
  })

  it('does not allow Servants Prep leaders to approve applications', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'prep-1', role: 'SERVANT_PREP' })
    const request = new NextRequest(
      'http://localhost/api/servant-applications/application-1/review',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      }
    )

    const response = await REVIEW(request, {
      params: Promise.resolve({ id: 'application-1' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
