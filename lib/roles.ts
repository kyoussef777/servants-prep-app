import { UserRole } from "@prisma/client"

// Role hierarchy and permissions

export const isAdmin = (role: UserRole) => {
  return ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP'].includes(role)
}

export const isSuperAdmin = (role: UserRole) => {
  return role === 'SUPER_ADMIN'
}

export const isPriest = (role: UserRole) => {
  return role === 'PRIEST'
}

export const isServantPrep = (role: UserRole) => {
  return role === 'SERVANT_PREP'
}

export const isServant = (role: UserRole) => {
  return role === 'SERVANT'
}

export const isStudent = (role: UserRole) => {
  return role === 'STUDENT'
}

// Can manage users (create, edit, delete)
export const canManageUsers = (role: UserRole) => {
  return ['SUPER_ADMIN', 'SERVANT_PREP'].includes(role)
}

// Can manage only students (SERVANT_PREP limitation)
export const canManageStudents = (role: UserRole) => {
  return ['SUPER_ADMIN', 'SERVANT_PREP'].includes(role)
}

// Can manage all user types (only SUPER_ADMIN)
export const canManageAllUsers = (role: UserRole) => {
  return role === 'SUPER_ADMIN'
}

// Can access admin dashboard
export const canAccessAdmin = (role: UserRole) => {
  return isAdmin(role)
}

// Can take attendance and enter scores
export const canManageData = (role: UserRole) => {
  return isAdmin(role)
}

// Can assign mentors to students
export const canAssignMentors = (role: UserRole) => {
  return ['SUPER_ADMIN', 'PRIEST'].includes(role)
}

// Can self-assign mentees (regular servants)
export const canSelfAssignMentees = (role: UserRole) => {
  return role === 'SERVANT'
}

// Display names for roles
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    PRIEST: 'Priest',
    SERVANT_PREP: 'Servants Prep Servant',
    SERVANT: 'Servant',
    STUDENT: 'Student'
  }
  return displayNames[role]
}
