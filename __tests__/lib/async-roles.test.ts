import { describe, it, expect } from 'vitest'
import {
  canReviewAsyncNotes,
  canManageSundaySchool,
  canManageSundaySchoolAttendance,
  canSetAsyncStatus,
  canSubmitAsyncContent,
} from '@/lib/roles'

const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PRIEST: 'PRIEST',
  SERVANT_PREP: 'SERVANT_PREP',
  MENTOR: 'MENTOR',
  STUDENT: 'STUDENT',
} as const

type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

describe('Async Student Permission Helpers', () => {
  describe('canReviewAsyncNotes', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canReviewAsyncNotes(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canReviewAsyncNotes(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canReviewAsyncNotes(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canReviewAsyncNotes(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canReviewAsyncNotes(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageSundaySchool', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageSundaySchool(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageSundaySchool(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canManageSundaySchool(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageSundaySchool(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageSundaySchool(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canManageSundaySchoolAttendance', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canManageSundaySchoolAttendance(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canManageSundaySchoolAttendance(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for other roles', () => {
      expect(canManageSundaySchoolAttendance(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canManageSundaySchoolAttendance(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canManageSundaySchoolAttendance(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canSetAsyncStatus', () => {
    it('should return true for SUPER_ADMIN and SERVANT_PREP', () => {
      expect(canSetAsyncStatus(UserRole.SUPER_ADMIN as UserRoleType)).toBe(true)
      expect(canSetAsyncStatus(UserRole.SERVANT_PREP as UserRoleType)).toBe(true)
    })

    it('should return false for PRIEST, MENTOR, and STUDENT', () => {
      expect(canSetAsyncStatus(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canSetAsyncStatus(UserRole.MENTOR as UserRoleType)).toBe(false)
      expect(canSetAsyncStatus(UserRole.STUDENT as UserRoleType)).toBe(false)
    })
  })

  describe('canSubmitAsyncContent', () => {
    it('should return true only for STUDENT', () => {
      expect(canSubmitAsyncContent(UserRole.STUDENT as UserRoleType)).toBe(true)
    })

    it('should return false for all other roles', () => {
      expect(canSubmitAsyncContent(UserRole.SUPER_ADMIN as UserRoleType)).toBe(false)
      expect(canSubmitAsyncContent(UserRole.PRIEST as UserRoleType)).toBe(false)
      expect(canSubmitAsyncContent(UserRole.SERVANT_PREP as UserRoleType)).toBe(false)
      expect(canSubmitAsyncContent(UserRole.MENTOR as UserRoleType)).toBe(false)
    })
  })
})
