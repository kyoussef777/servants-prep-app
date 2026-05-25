import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"
import { checkLoginRateLimit, resetLoginRateLimit } from "./rate-limit"

async function getUserSessionData(user: { id: string; role: UserRole }) {
  let isAsyncStudent = false
  if (user.role === UserRole.STUDENT) {
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { studentId: user.id },
      select: { isAsyncStudent: true }
    })
    isAsyncStudent = enrollment?.isAsyncStudent ?? false
  }
  return { isAsyncStudent }
}

// Re-validate token against the current DB state at most once per this window.
// Keeps the blast radius for disabled accounts / role demotions to ~1 minute
// without paying a DB lookup on every authenticated request.
const TOKEN_REVALIDATE_INTERVAL_MS = 60 * 1000

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as unknown as NextAuthOptions['adapter'],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Do NOT auto-link Google accounts to existing credentials accounts by
      // matching email - that would let anyone who can change a victim's
      // email address take the account over via "Sign in with Google".
      allowDangerousEmailAccountLinking: false,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        // Rate limit check
        const rateLimit = checkLoginRateLimit(credentials.email)
        if (!rateLimit.allowed) {
          throw new Error(`Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`)
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        // Check if user is disabled
        if (user.isDisabled) {
          throw new Error("Your account has been disabled. Please contact an administrator.")
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials")
        }

        // Successful login - reset rate limit
        resetLoginRateLimit(credentials.email)

        const { isAsyncStudent } = await getUserSessionData(user)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          isAsyncStudent,
          profileImageUrl: user.profileImageUrl,
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in, only allow existing users
      if (account?.provider === "google") {
        if (!user.email) return false

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email }
        })

        if (!existingUser || existingUser.isDisabled) {
          return "/login?error=GoogleSignInFailed"
        }

        return true
      }

      return true
    },
    async jwt({ token, user, account, trigger, session }) {
      // Credentials sign-in: user object has all our custom fields
      if (user && account?.provider === "credentials") {
        token.role = user.role
        token.id = user.id
        token.mustChangePassword = user.mustChangePassword
        token.isAsyncStudent = user.isAsyncStudent ?? false
        token.profileImageUrl = user.profileImageUrl ?? null
        token.validatedAt = Date.now()
      }

      // Google sign-in: look up user from database
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email }
        })

        if (dbUser) {
          const { isAsyncStudent } = await getUserSessionData(dbUser)
          token.id = dbUser.id
          token.role = dbUser.role
          token.mustChangePassword = dbUser.mustChangePassword
          token.isAsyncStudent = isAsyncStudent
          token.profileImageUrl = dbUser.profileImageUrl ?? null
          token.validatedAt = Date.now()
        }
      }

      // Handle session update (e.g., after password change, profile pic, name)
      if (trigger === 'update' && session) {
        if (session.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword
        }
        if (session.profileImageUrl !== undefined) {
          token.profileImageUrl = session.profileImageUrl
        }
        if (session.name !== undefined) {
          token.name = session.name
        }

        // Dev-only: SUPER_ADMIN impersonation via session.update()
        if (process.env.NODE_ENV !== 'production' && 'impersonate' in (session as Record<string, unknown>)) {
          const impersonateId = (session as { impersonate?: string | null }).impersonate

          if (impersonateId) {
            // Starting impersonation. The acting user must be a SUPER_ADMIN
            // (either currently, or already impersonating from a SUPER_ADMIN base).
            const isAdminBase = token.role === UserRole.SUPER_ADMIN || !!token.originalId
            if (isAdminBase) {
              const target = await prisma.user.findUnique({
                where: { id: impersonateId as string }
              })
              if (target && !target.isDisabled) {
                // Capture original identity on first hop
                if (!token.originalId) {
                  token.originalId = token.id
                  token.originalName = token.name ?? null
                  token.originalEmail = token.email ?? null
                }
                const { isAsyncStudent } = await getUserSessionData(target)
                token.id = target.id
                token.role = target.role
                token.name = target.name
                token.email = target.email
                token.mustChangePassword = false
                token.isAsyncStudent = isAsyncStudent
                token.profileImageUrl = target.profileImageUrl ?? null
                token.validatedAt = Date.now()
              }
            }
          } else {
            // Stop impersonating - restore original identity
            if (token.originalId) {
              const original = await prisma.user.findUnique({
                where: { id: token.originalId }
              })
              if (original) {
                const { isAsyncStudent } = await getUserSessionData(original)
                token.id = original.id
                token.role = original.role
                token.name = original.name
                token.email = original.email
                token.mustChangePassword = original.mustChangePassword
                token.isAsyncStudent = isAsyncStudent
                token.profileImageUrl = original.profileImageUrl ?? null
              }
              token.originalId = undefined
              token.originalName = undefined
              token.originalEmail = undefined
              token.validatedAt = Date.now()
            }
          }
        }
      }

      // Periodically re-check the user against the DB so that disabling an
      // account or changing its role takes effect without waiting for the
      // 30-day JWT to expire. Skip while impersonating - the impersonated
      // identity is intentionally divergent from a "real" login.
      const validatedAt = (token.validatedAt as number | undefined) ?? 0
      if (!token.originalId && token.id && Date.now() - validatedAt > TOKEN_REVALIDATE_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true, role: true, isDisabled: true, mustChangePassword: true }
        })

        if (!dbUser || dbUser.isDisabled) {
          token.invalidated = true
        } else {
          token.role = dbUser.role
          token.mustChangePassword = dbUser.mustChangePassword
          token.validatedAt = Date.now()
        }
      }

      return token
    },
    async session({ session, token }) {
      // Token was invalidated by the jwt callback (account disabled or deleted).
      // Strip the user so requireAuth() / getCurrentUser() treat it as anonymous.
      if (token.invalidated) {
        return { ...session, user: undefined } as unknown as typeof session
      }

      if (session.user) {
        session.user.role = token.role as UserRole
        session.user.id = token.id as string
        session.user.mustChangePassword = token.mustChangePassword as boolean
        session.user.isAsyncStudent = (token.isAsyncStudent as boolean) ?? false
        session.user.profileImageUrl = (token.profileImageUrl as string | null) ?? null
      }
      // Surface impersonation state to the client (dev only)
      if (process.env.NODE_ENV !== 'production' && token.originalId) {
        session.impersonating = {
          originalId: token.originalId as string,
          originalName: (token.originalName as string | null) ?? null,
          originalEmail: (token.originalEmail as string | null) ?? null,
        }
      } else {
        session.impersonating = null
      }
      return session
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 24 * 60 * 60, // 60 days
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
