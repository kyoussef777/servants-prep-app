import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as unknown as NextAuthOptions['adapter'],
  providers: [
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

        // Check if student is async
        let isAsyncStudent = false
        if (user.role === UserRole.STUDENT) {
          const enrollment = await prisma.studentEnrollment.findUnique({
            where: { studentId: user.id },
            select: { isAsyncStudent: true }
          })
          isAsyncStudent = enrollment?.isAsyncStudent ?? false
        }

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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.mustChangePassword = user.mustChangePassword
        token.isAsyncStudent = user.isAsyncStudent ?? false
        token.profileImageUrl = user.profileImageUrl ?? null
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
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole
        session.user.id = token.id as string
        session.user.mustChangePassword = token.mustChangePassword as boolean
        session.user.isAsyncStudent = (token.isAsyncStudent as boolean) ?? false
        session.user.profileImageUrl = (token.profileImageUrl as string | null) ?? null
      }
      return session
    }
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
