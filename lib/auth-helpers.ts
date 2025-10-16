import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { UserRole } from "@prisma/client"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden")
  }
  return user
}

export async function isPriest() {
  const user = await getCurrentUser()
  return user?.role === UserRole.PRIEST
}

export async function isServant() {
  const user = await getCurrentUser()
  return user?.role === UserRole.SERVANT
}

export async function isStudent() {
  const user = await getCurrentUser()
  return user?.role === UserRole.STUDENT
}
