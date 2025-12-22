import { UserRole } from "@prisma/client"

// Role hierarchy and permissions

export const isAdmin = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.PRIEST || role === UserRole.SERVANT_PREP
}

export const isSuperAdmin = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN
}

export const isPriest = (role: UserRole) => {
  return role === UserRole.PRIEST
}

export const isServantPrep = (role: UserRole) => {
  return role === UserRole.SERVANT_PREP
}

export const isMentor = (role: UserRole) => {
  return role === UserRole.MENTOR
}

export const isStudent = (role: UserRole) => {
  return role === UserRole.STUDENT
}

// Can manage users (create, edit, delete)
export const canManageUsers = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can manage only students (SERVANT_PREP limitation)
export const canManageStudents = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can manage all user types (only SUPER_ADMIN)
export const canManageAllUsers = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN
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
  return role === UserRole.SUPER_ADMIN || role === UserRole.PRIEST || role === UserRole.SERVANT_PREP
}

// Can self-assign mentees (mentors)
export const canSelfAssignMentees = (role: UserRole) => {
  return role === UserRole.MENTOR
}

// Can be assigned as a mentor (have mentees)
export const canBeMentor = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP || role === UserRole.MENTOR
}

// Can view students (admins and mentors)
export const canViewStudents = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.PRIEST || role === UserRole.SERVANT_PREP || role === UserRole.MENTOR
}

// Display names for roles
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    PRIEST: 'Priest',
    SERVANT_PREP: 'Servants Prep Leader',
    MENTOR: 'Mentor',
    STUDENT: 'Student'
  }
  return displayNames[role]
}
