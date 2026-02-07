import { UserRole } from "@prisma/client"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      mustChangePassword: boolean
      isAsyncStudent: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    mustChangePassword: boolean
    isAsyncStudent: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole
    id: string
    mustChangePassword: boolean
    isAsyncStudent: boolean
  }
}
