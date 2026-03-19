import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { canManageUsers, canManageAllUsers } from '@/lib/roles'

/**
 * Tests for user role assignment logic in API routes.
 * Validates that SUPER_ADMIN can assign any role (including SUPER_ADMIN),
 * SERVANT_PREP can only assign STUDENT/MENTOR, and other roles cannot assign roles.
 */

// ---- Simulate the role assignment logic from PATCH /api/users/[id] ----

function simulateRoleChangeInPatch(
  currentUserRole: UserRole,
  targetUserRole: UserRole,
  requestedRole: UserRole,
  isSelf = false
): { allowed: boolean; newRole: UserRole | null; error?: string } {
  // Step 1: Check if current user can manage users at all (self-edit bypasses this)
  if (!isSelf && !canManageUsers(currentUserRole)) {
    return { allowed: false, newRole: null, error: 'Forbidden' }
  }

  // Step 2: SERVANT_PREP can only update STUDENT and MENTOR users
  if (currentUserRole === UserRole.SERVANT_PREP && targetUserRole !== UserRole.STUDENT && targetUserRole !== UserRole.MENTOR) {
    return { allowed: false, newRole: null, error: 'Servants Prep can only update Student and Mentor users' }
  }

  // Step 3: Role change permissions (mirrors lines 105-115 of PATCH handler)
  if (requestedRole) {
    if (canManageAllUsers(currentUserRole)) {
      // SUPER_ADMIN can change any role
      return { allowed: true, newRole: requestedRole }
    } else if (currentUserRole === UserRole.SERVANT_PREP) {
      // SERVANT_PREP can only set STUDENT or MENTOR roles
      if (requestedRole === UserRole.STUDENT || requestedRole === UserRole.MENTOR) {
        return { allowed: true, newRole: requestedRole }
      }
      // Silently ignored - role not changed
      return { allowed: true, newRole: null }
    }
  }

  return { allowed: true, newRole: null }
}

// ---- Simulate the role restriction logic from POST /api/users ----

function simulateRoleCheckInPost(
  currentUserRole: UserRole,
  requestedRole: UserRole
): { allowed: boolean; error?: string } {
  // Step 1: Check canManageUsers
  if (!canManageUsers(currentUserRole)) {
    return { allowed: false, error: 'Forbidden' }
  }

  // Step 2: SERVANT_PREP restriction
  if (currentUserRole === UserRole.SERVANT_PREP && requestedRole !== UserRole.STUDENT && requestedRole !== UserRole.MENTOR) {
    return { allowed: false, error: 'Servants Prep can only create Student and Mentor users' }
  }

  return { allowed: true }
}

// ---- Simulate frontend role options logic ----

function getRoleOptions(currentUserRole: string): UserRole[] {
  return currentUserRole === 'SERVANT_PREP'
    ? [UserRole.STUDENT, UserRole.MENTOR]
    : [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP, UserRole.MENTOR, UserRole.STUDENT]
}

describe('User Role Assignment - PATCH /api/users/[id]', () => {
  describe('SUPER_ADMIN role changes', () => {
    const currentRole = UserRole.SUPER_ADMIN

    it('SUPER_ADMIN can promote a STUDENT to SUPER_ADMIN', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.STUDENT, UserRole.SUPER_ADMIN)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.SUPER_ADMIN)
    })

    it('SUPER_ADMIN can promote a MENTOR to SUPER_ADMIN', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.MENTOR, UserRole.SUPER_ADMIN)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.SUPER_ADMIN)
    })

    it('SUPER_ADMIN can promote a SERVANT_PREP to SUPER_ADMIN', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.SERVANT_PREP, UserRole.SUPER_ADMIN)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.SUPER_ADMIN)
    })

    it('SUPER_ADMIN can promote a PRIEST to SUPER_ADMIN', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.PRIEST, UserRole.SUPER_ADMIN)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.SUPER_ADMIN)
    })

    it('SUPER_ADMIN can change another SUPER_ADMIN to any role', () => {
      const roles = [UserRole.PRIEST, UserRole.SERVANT_PREP, UserRole.MENTOR, UserRole.STUDENT]
      for (const targetRole of roles) {
        const result = simulateRoleChangeInPatch(currentRole, UserRole.SUPER_ADMIN, targetRole)
        expect(result.allowed).toBe(true)
        expect(result.newRole).toBe(targetRole)
      }
    })

    it('SUPER_ADMIN can assign any role to any user', () => {
      const allRoles = [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP, UserRole.MENTOR, UserRole.STUDENT]

      for (const targetCurrentRole of allRoles) {
        for (const requestedRole of allRoles) {
          const result = simulateRoleChangeInPatch(currentRole, targetCurrentRole, requestedRole)
          expect(result.allowed).toBe(true)
          expect(result.newRole).toBe(requestedRole)
        }
      }
    })
  })

  describe('SERVANT_PREP role changes', () => {
    const currentRole = UserRole.SERVANT_PREP

    it('SERVANT_PREP can change STUDENT to MENTOR', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.STUDENT, UserRole.MENTOR)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.MENTOR)
    })

    it('SERVANT_PREP can change MENTOR to STUDENT', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.MENTOR, UserRole.STUDENT)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBe(UserRole.STUDENT)
    })

    it('SERVANT_PREP cannot promote STUDENT to SUPER_ADMIN', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.STUDENT, UserRole.SUPER_ADMIN)
      // The API silently ignores invalid role changes for SERVANT_PREP
      expect(result.newRole).toBeNull()
    })

    it('SERVANT_PREP cannot promote STUDENT to PRIEST', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.STUDENT, UserRole.PRIEST)
      expect(result.newRole).toBeNull()
    })

    it('SERVANT_PREP cannot promote STUDENT to SERVANT_PREP', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.STUDENT, UserRole.SERVANT_PREP)
      expect(result.newRole).toBeNull()
    })

    it('SERVANT_PREP cannot update SUPER_ADMIN users', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.SUPER_ADMIN, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
      expect(result.error).toContain('Servants Prep')
    })

    it('SERVANT_PREP cannot update PRIEST users', () => {
      const result = simulateRoleChangeInPatch(currentRole, UserRole.PRIEST, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
      expect(result.error).toContain('Servants Prep')
    })
  })

  describe('Other roles cannot change roles', () => {
    it('PRIEST cannot change any roles', () => {
      const result = simulateRoleChangeInPatch(UserRole.PRIEST, UserRole.STUDENT, UserRole.MENTOR)
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Forbidden')
    })

    it('MENTOR cannot change any roles', () => {
      const result = simulateRoleChangeInPatch(UserRole.MENTOR, UserRole.STUDENT, UserRole.MENTOR)
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Forbidden')
    })

    it('STUDENT cannot change any roles on other users', () => {
      const result = simulateRoleChangeInPatch(UserRole.STUDENT, UserRole.MENTOR, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Forbidden')
    })

    it('STUDENT self-edit role change is silently ignored', () => {
      // A STUDENT can self-edit (name, email), but role changes are ignored
      // because they don't pass canManageAllUsers or SERVANT_PREP checks
      const result = simulateRoleChangeInPatch(UserRole.STUDENT, UserRole.STUDENT, UserRole.SUPER_ADMIN, true)
      expect(result.allowed).toBe(true)
      expect(result.newRole).toBeNull() // Role change silently ignored
    })
  })
})

describe('User Role Assignment - POST /api/users', () => {
  describe('SUPER_ADMIN can create users with any role', () => {
    const allRoles = [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP, UserRole.MENTOR, UserRole.STUDENT]

    for (const role of allRoles) {
      it(`SUPER_ADMIN can create a ${role} user`, () => {
        const result = simulateRoleCheckInPost(UserRole.SUPER_ADMIN, role)
        expect(result.allowed).toBe(true)
        expect(result.error).toBeUndefined()
      })
    }
  })

  describe('SERVANT_PREP creation restrictions', () => {
    it('SERVANT_PREP can create STUDENT users', () => {
      const result = simulateRoleCheckInPost(UserRole.SERVANT_PREP, UserRole.STUDENT)
      expect(result.allowed).toBe(true)
    })

    it('SERVANT_PREP can create MENTOR users', () => {
      const result = simulateRoleCheckInPost(UserRole.SERVANT_PREP, UserRole.MENTOR)
      expect(result.allowed).toBe(true)
    })

    it('SERVANT_PREP cannot create SUPER_ADMIN users', () => {
      const result = simulateRoleCheckInPost(UserRole.SERVANT_PREP, UserRole.SUPER_ADMIN)
      expect(result.allowed).toBe(false)
      expect(result.error).toContain('Servants Prep')
    })

    it('SERVANT_PREP cannot create PRIEST users', () => {
      const result = simulateRoleCheckInPost(UserRole.SERVANT_PREP, UserRole.PRIEST)
      expect(result.allowed).toBe(false)
    })

    it('SERVANT_PREP cannot create SERVANT_PREP users', () => {
      const result = simulateRoleCheckInPost(UserRole.SERVANT_PREP, UserRole.SERVANT_PREP)
      expect(result.allowed).toBe(false)
    })
  })

  describe('Non-managing roles cannot create users', () => {
    it('PRIEST cannot create users', () => {
      const result = simulateRoleCheckInPost(UserRole.PRIEST, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
    })

    it('MENTOR cannot create users', () => {
      const result = simulateRoleCheckInPost(UserRole.MENTOR, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
    })

    it('STUDENT cannot create users', () => {
      const result = simulateRoleCheckInPost(UserRole.STUDENT, UserRole.STUDENT)
      expect(result.allowed).toBe(false)
    })
  })
})

describe('Frontend Role Options', () => {
  it('SUPER_ADMIN sees all roles in dropdown including SUPER_ADMIN', () => {
    const options = getRoleOptions('SUPER_ADMIN')
    expect(options).toContain(UserRole.SUPER_ADMIN)
    expect(options).toContain(UserRole.PRIEST)
    expect(options).toContain(UserRole.SERVANT_PREP)
    expect(options).toContain(UserRole.MENTOR)
    expect(options).toContain(UserRole.STUDENT)
    expect(options).toHaveLength(5)
  })

  it('PRIEST sees all roles in dropdown (same as SUPER_ADMIN)', () => {
    const options = getRoleOptions('PRIEST')
    expect(options).toContain(UserRole.SUPER_ADMIN)
    expect(options).toHaveLength(5)
  })

  it('SERVANT_PREP only sees STUDENT and MENTOR in dropdown', () => {
    const options = getRoleOptions('SERVANT_PREP')
    expect(options).toContain(UserRole.STUDENT)
    expect(options).toContain(UserRole.MENTOR)
    expect(options).not.toContain(UserRole.SUPER_ADMIN)
    expect(options).not.toContain(UserRole.PRIEST)
    expect(options).not.toContain(UserRole.SERVANT_PREP)
    expect(options).toHaveLength(2)
  })
})

describe('Role Permission Helpers - Role Assignment', () => {
  it('canManageAllUsers returns true ONLY for SUPER_ADMIN', () => {
    expect(canManageAllUsers(UserRole.SUPER_ADMIN)).toBe(true)
    expect(canManageAllUsers(UserRole.PRIEST)).toBe(false)
    expect(canManageAllUsers(UserRole.SERVANT_PREP)).toBe(false)
    expect(canManageAllUsers(UserRole.MENTOR)).toBe(false)
    expect(canManageAllUsers(UserRole.STUDENT)).toBe(false)
  })

  it('canManageUsers returns true for SUPER_ADMIN and SERVANT_PREP', () => {
    expect(canManageUsers(UserRole.SUPER_ADMIN)).toBe(true)
    expect(canManageUsers(UserRole.SERVANT_PREP)).toBe(true)
    expect(canManageUsers(UserRole.PRIEST)).toBe(false)
    expect(canManageUsers(UserRole.MENTOR)).toBe(false)
    expect(canManageUsers(UserRole.STUDENT)).toBe(false)
  })
})
