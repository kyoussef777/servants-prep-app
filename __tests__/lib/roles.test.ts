import { describe, it, expect } from 'vitest'
import {
  isAdmin,
  isSuperAdmin,
  isPriest,
  isServantPrep,
  isMentor,
  isStudent,
  canManageUsers,
  canManageStudents,
  canManageAllUsers,
  canAccessAdmin,
  canManageData,
  canManageCurriculum,
  canManageExams,
  canManageEnrollments,
  isReadOnlyAdmin,
  canAssignMentors,
  canSelfAssignMentees,
  canBeMentor,
  canViewStudents,
  canManageInviteCodes,
  canReviewRegistrations,
  canViewRegistrations,
  getRoleDisplayName,
} from '@/lib/roles'

// Mock UserRole enum since it comes from Prisma
const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PRIEST: 'PRIEST',
  SERVANT_PREP: 'SERVANT_PREP',
  MENTOR: 'MENTOR',
  STUDENT: 'STUDENT',
} as const

type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

describe('Role Helper Functions', () => {
  describe('isAdmin', () => {
    it('should return true for SUPER_ADMIN', () => {
      expect(isAdmin(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
    })

    it('should return true for PRIEST', () => {
      expect(isAdmin(UserRole.PRIEST as UserRoleType)).toBe(true)
    })

    it('should return true for SERVANT_PREP', () => {
      expect(isAdmin(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for MENTOR', () => {
      expect(isAdmin(UserRole.MENTOR as UserRoleType)).toBe(false)
    })

    it('should return false for STUDENT', () => {
      expect(isAdmin(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('isSuperAdmin', () => {
    it('should return true only for SUPER_ADMIN', () => {
      expect(isSuperAdmin(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(isSuperAdmin(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(isSuperAdmin(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
      expect(isSuperAdmin(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(isSuperAdmin(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('isPriest', () => {
    it('should return true only for PRIEST', () => {
      expect(isPriest(UserRole.PRIEST as UserRoleType)).toBe(true)
      expect(isPriest(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(isPriest(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
    })
  })

  describe('isServantPrep', () => {
    it('should return true only for SERVANT_PREP', () => {
      expect(isServantPrep(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
      expect(isServantPrep(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(isServantPrep(UserRole.PRIEST as UserRoleType)).toBe(false)
    })
  })

  describe('isMentor', () => {
    it('should return true only for MENTOR', () => {
      expect(isMentor(UserRole.MENTOR as UserRoleType)).toBe(true)
      expect(isMentor(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(isMentor(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('isStudent', () => {
    it('should return true only for STUDENT', () => {
      expect(isStudent(UserRole.STUDENT as UserRoleType)).toBe(true)
      expect(isStudent(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(isStudent(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
    })
  })

  describe('canManageUsers', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageUsers(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageUsers(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageUsers(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageUsers(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageUsers(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageStudents', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageStudents(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageStudents(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for other roles', () => {
      expect(canManageStudents(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageStudents(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageStudents(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageAllUsers', () => {
    it('should return true only for SUPER_ADMIN', () => {
      expect(canManageAllUsers(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
    })

    it('should return false for all other roles including SERVANT_PREP', () => {
      expect(canManageAllUsers(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageAllUsers(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
      expect(canManageAllUsers(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageAllUsers(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canAccessAdmin', () => {
    it('should return true for admin roles', () => {
      expect(canAccessAdmin(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canAccessAdmin(UserRole.PRIEST as UserRoleType)).toBe(true)
      expect(canAccessAdmin(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for non-admin roles', () => {
      expect(canAccessAdmin(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canAccessAdmin(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageData', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP (PRIEST is read-only)', () => {
      expect(canManageData(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageData(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageData(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageData(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageData(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canAssignMentors', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP (PRIEST is read-only)', () => {
      expect(canAssignMentors(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canAssignMentors(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canAssignMentors(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canAssignMentors(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canAssignMentors(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canSelfAssignMentees', () => {
    it('should return true only for MENTOR', () => {
      expect(canSelfAssignMentees(UserRole.MENTOR as UserRoleType)).toBe(true)
    })

    it('should return false for all other roles', () => {
      expect(canSelfAssignMentees(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(canSelfAssignMentees(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canSelfAssignMentees(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
      expect(canSelfAssignMentees(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canBeMentor', () => {
    it('should return true for SUPER_ADMIN, SERVANT_PREP, and MENTOR', () => {
      expect(canBeMentor(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canBeMentor(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
      expect(canBeMentor(UserRole.MENTOR as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST and STUDENT', () => {
      expect(canBeMentor(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canBeMentor(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canViewStudents', () => {
    it('should return true for SUPER_ADMIN, PRIEST, SERVANT_PREP, and MENTOR', () => {
      expect(canViewStudents(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canViewStudents(UserRole.PRIEST as UserRoleType)).toBe(true)
      expect(canViewStudents(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
      expect(canViewStudents(UserRole.MENTOR as UserRoleType)).toBe(true)
    })

    it('should return false for STUDENT', () => {
      expect(canViewStudents(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('getRoleDisplayName', () => {
    it('should return correct display names for all roles', () => {
      expect(getRoleDisplayName(UserRole.SUPER_ADMIN as UserRoleType)).toBe('Super Admin')
      expect(getRoleDisplayName(UserRole.PRIEST as UserRoleType)).toBe('Priest')
      expect(getRoleDisplayName(UserRole.SERVANT_PREP as UserRoleType)).toBe('Servants Prep Leader')
      expect(getRoleDisplayName(UserRole.MENTOR as UserRoleType)).toBe('Mentor')
      expect(getRoleDisplayName(UserRole.STUDENT as UserRoleType)).toBe('Student')
    })
  })

  describe('canManageCurriculum', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageCurriculum(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageCurriculum(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageCurriculum(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageCurriculum(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageCurriculum(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageExams', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageExams(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageExams(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageExams(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageExams(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageExams(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageEnrollments', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageEnrollments(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageEnrollments(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageEnrollments(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageEnrollments(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageEnrollments(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('isReadOnlyAdmin', () => {
    it('should return true only for PRIEST', () => {
      expect(isReadOnlyAdmin(UserRole.PRIEST as UserRoleType)).toBe(true)
    })

    it('should return false for all other roles', () => {
      expect(isReadOnlyAdmin(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(isReadOnlyAdmin(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
      expect(isReadOnlyAdmin(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(isReadOnlyAdmin(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageInviteCodes', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageInviteCodes(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageInviteCodes(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageInviteCodes(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageInviteCodes(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageInviteCodes(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canReviewRegistrations', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canReviewRegistrations(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canReviewRegistrations(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canReviewRegistrations(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canReviewRegistrations(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canReviewRegistrations(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canViewRegistrations', () => {
    it('should return true for SUPER_ADMIN, SERVANT_PREP, and PRIEST', () => {
      expect(canViewRegistrations(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canViewRegistrations(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
      expect(canViewRegistrations(UserRole.PRIEST as UserRoleType)).toBe(true)
    })

    it('should return false for MENTOR and STUDENT', () => {
      expect(canViewRegistrations(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canViewRegistrations(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })
})

describe('Role Permission Matrix', () => {
  // This tests the overall permission structure to ensure consistency

  it('SUPER_ADMIN should have the most permissions', () => {
    const role = UserRole.SUPER_ADMIN as UserRoleType
    expect(isAdmin(role)).toBe(true)
    expect(canManageUsers(role)).toBe(true)
    expect(canManageAllUsers(role)).toBe(true)
    expect(canManageData(role)).toBe(true)
    expect(canAssignMentors(role)).toBe(true)
    expect(canViewStudents(role)).toBe(true)
    expect(canBeMentor(role)).toBe(true)
  })

  it('PRIEST should have admin view access but be fully read-only', () => {
    const role = UserRole.PRIEST as UserRoleType
    expect(isAdmin(role)).toBe(true)
    expect(canManageUsers(role)).toBe(false)
    expect(canManageAllUsers(role)).toBe(false)
    expect(canManageData(role)).toBe(false) // PRIEST is read-only
    expect(canAssignMentors(role)).toBe(false) // PRIEST is read-only
    expect(canViewStudents(role)).toBe(true)
  })

  it('SERVANT_PREP should be able to manage users but not all users', () => {
    const role = UserRole.SERVANT_PREP as UserRoleType
    expect(isAdmin(role)).toBe(true)
    expect(canManageUsers(role)).toBe(true)
    expect(canManageAllUsers(role)).toBe(false) // Can't manage priests/admins
    expect(canManageData(role)).toBe(true)
    expect(canAssignMentors(role)).toBe(true)
  })

  it('MENTOR should only be able to view students', () => {
    const role = UserRole.MENTOR as UserRoleType
    expect(isAdmin(role)).toBe(false)
    expect(canManageUsers(role)).toBe(false)
    expect(canManageData(role)).toBe(false)
    expect(canViewStudents(role)).toBe(true) // Key permission
    expect(canSelfAssignMentees(role)).toBe(true)
  })

  it('STUDENT should have minimal permissions', () => {
    const role = UserRole.STUDENT as UserRoleType
    expect(isAdmin(role)).toBe(false)
    expect(canManageUsers(role)).toBe(false)
    expect(canManageData(role)).toBe(false)
    expect(canViewStudents(role)).toBe(false)
    expect(canAssignMentors(role)).toBe(false)
    expect(canBeMentor(role)).toBe(false)
  })
})
