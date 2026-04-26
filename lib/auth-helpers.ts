import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { UserRole } from "@prisma/client"

export type RequireAuthOptions = {
  // Allow the request through even if the user still has mustChangePassword=true.
  // Only the password-change endpoint itself should set this.
  allowMustChangePassword?: boolean
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth(options: RequireAuthOptions = {}) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  if (user.mustChangePassword && !options.allowMustChangePassword) {
    throw new Error("PasswordChangeRequired")
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[], options: RequireAuthOptions = {}) {
  const user = await requireAuth(options)
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden")
  }
  return user
}

export async function isPriest() {
  const user = await getCurrentUser()
  return user?.role === UserRole.PRIEST
}

export async function isMentor() {
  const user = await getCurrentUser()
  return user?.role === UserRole.MENTOR
}

export async function isStudent() {
  const user = await getCurrentUser()
  return user?.role === UserRole.STUDENT
}
