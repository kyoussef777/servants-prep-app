import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RoleGrantSource,
  RoleTag,
  SundaySchoolAuthority,
  UserRole,
} from '@prisma/client'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  canCoordinateClass: vi.fn(),
  year: vi.fn(),
  class: vi.fn(),
  ageGroup: vi.fn(),
  user: vi.fn(),
  existingAssignment: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  grantRoleTag: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: mocks.auth }))
vi.mock('@/lib/sunday-school-access', () => ({
  getSundaySchoolAccess: mocks.access,
  canCoordinateClass: mocks.canCoordinateClass,
  canCoordinateAgeGroup: vi.fn(),
  visibleClassFilter: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    academicYear: { findFirst: mocks.year },
    sundaySchoolClass: { findUnique: mocks.class },
    sundaySchoolAgeGroup: { findUnique: mocks.ageGroup },
    user: { findUnique: mocks.user },
    sundaySchoolServantAssignment: {
      findFirst: mocks.existingAssignment,
    },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/sunday-school/servant-assignments/route'

const tx = {
  userRoleAssignment: { createMany: mocks.grantRoleTag },
  sundaySchoolServantAssignment: {
    create: mocks.createAssignment,
    update: mocks.updateAssignment,
  },
}

function assignmentRequest(
  authority: SundaySchoolAuthority = SundaySchoolAuthority.SERVANT
) {
  return new Request('http://localhost/api/sunday-school/servant-assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'mentor-1',
      classId: 'class-1',
      authority,
    }),
  })
}

describe('Sunday School servant assignments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ id: 'admin-1', role: UserRole.SUPER_ADMIN })
    mocks.year.mockResolvedValue({ id: 'academic-year' })
    mocks.access.mockResolvedValue({ isAdmin: true })
    mocks.canCoordinateClass.mockReturnValue(true)
    mocks.class.mockResolvedValue({
      id: 'class-1',
      academicYearId: 'academic-year',
      sundaySchoolYearId: 'sunday-school-year',
      status: 'ACTIVE',
    })
    mocks.user.mockResolvedValue({
      id: 'mentor-1',
      role: UserRole.MENTOR,
      isDisabled: false,
    })
    mocks.existingAssignment.mockResolvedValue(null)
    mocks.grantRoleTag.mockResolvedValue({ count: 1 })
    mocks.createAssignment.mockResolvedValue({ id: 'assignment-1' })
    mocks.updateAssignment.mockResolvedValue({ id: 'old-assignment' })
    mocks.transaction.mockImplementation(async callback => callback(tx))
  })

  it('grants the Sunday School Servant tag in the assignment transaction', async () => {
    const response = await POST(assignmentRequest())

    expect(response.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.grantRoleTag).toHaveBeenCalledWith({
      data: [{
        userId: 'mentor-1',
        tag: RoleTag.SUNDAY_SCHOOL_SERVANT,
        source: RoleGrantSource.SYSTEM,
        grantedById: 'admin-1',
        note: 'Granted automatically with a Sunday School servant assignment',
      }],
      skipDuplicates: true,
    })
    expect(mocks.createAssignment).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'mentor-1',
        classId: 'class-1',
        sundaySchoolYearId: 'sunday-school-year',
      }),
    }))
  })

  it('repairs a missing tag when changing assignment authority', async () => {
    mocks.existingAssignment.mockResolvedValue({
      id: 'old-assignment',
      authority: SundaySchoolAuthority.SERVANT,
    })

    const response = await POST(assignmentRequest(SundaySchoolAuthority.COORDINATOR))

    expect(response.status).toBe(200)
    expect(mocks.updateAssignment).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-assignment' },
    }))
    expect(mocks.grantRoleTag).toHaveBeenCalledOnce()
    expect(mocks.createAssignment).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ authority: SundaySchoolAuthority.COORDINATOR }),
    }))
  })
})
