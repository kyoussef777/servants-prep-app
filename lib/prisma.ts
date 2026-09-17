import { PrismaClient } from '@prisma/client'

// Password hashes are never returned unless a query opts in with `omit: { password: false }`
const createPrismaClient = () => new PrismaClient({ omit: { user: { password: true } } })

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
