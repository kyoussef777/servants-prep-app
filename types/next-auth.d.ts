import { UserRole } from "@prisma/client"
import { DefaultSession } from "next-auth"

/**
 * Coarse Sunday School standing, for rendering only. Which classes and what
 * authority is always re-derived server-side (lib/sunday-school-access.ts).
 */
export interface SundaySchoolStanding {
  hasAccess: boolean
  isCoordinator: boolean
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      mustChangePassword: boolean
      isAsyncStudent: boolean
      sundaySchool: SundaySchoolStanding
      profileImageUrl?: string | null
    } & DefaultSession["user"]
    // Dev-only: when SUPER_ADMIN is impersonating another user
    impersonating?: {
      originalId: string
      originalName: string | null
      originalEmail: string | null
    } | null
  }

  interface User {
    role: UserRole
    mustChangePassword: boolean
    isAsyncStudent: boolean
    sundaySchool?: SundaySchoolStanding
    profileImageUrl?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    id: string
    mustChangePassword: boolean
    isAsyncStudent: boolean
    sundaySchool?: SundaySchoolStanding
    profileImageUrl?: string | null
    validatedAt?: number
    invalidated?: boolean
    // Dev-only impersonation
    originalId?: string
    originalName?: string | null
    originalEmail?: string | null
  }
}
