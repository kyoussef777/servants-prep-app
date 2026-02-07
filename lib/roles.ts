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

// Can access admin dashboard (view-only for PRIEST)
export const canAccessAdmin = (role: UserRole) => {
  return isAdmin(role)
}

// Can take attendance and enter scores (PRIEST is read-only)
export const canManageData = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can create/edit curriculum and lessons (PRIEST is read-only)
export const canManageCurriculum = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can create/edit exams and scores (PRIEST is read-only)
export const canManageExams = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can create/edit enrollments (PRIEST is read-only)
export const canManageEnrollments = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Has read-only admin access (PRIEST)
export const isReadOnlyAdmin = (role: UserRole) => {
  return role === UserRole.PRIEST
}

// Can assign mentors to students (PRIEST is read-only)
export const canAssignMentors = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
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

// Can review async note submissions (approve/reject/revert)
export const canReviewAsyncNotes = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can generate/manage Sunday School codes and manage assignments
export const canManageSundaySchool = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can excuse/manually approve/reject Sunday School attendance
export const canManageSundaySchoolAttendance = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can set async student status on enrollments
export const canSetAsyncStatus = (role: UserRole) => {
  return role === UserRole.SUPER_ADMIN || role === UserRole.SERVANT_PREP
}

// Can submit async notes and log Sunday School (must also be async student)
export const canSubmitAsyncContent = (role: UserRole) => {
  return role === UserRole.STUDENT
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
