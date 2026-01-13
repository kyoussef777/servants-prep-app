import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "./prisma"
import { requireAuth } from "./auth-helpers"

/**
 * Standard API error response handler
 * Provides consistent error formatting across all API routes
 */
export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error)

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (error.message === "Not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    // Return the error message for client-facing errors
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(searchParams: URLSearchParams) {
  const pageStr = searchParams.get('page')
  const limitStr = searchParams.get('limit')

  const page = pageStr ? parseInt(pageStr, 10) : null
  const limit = limitStr ? parseInt(limitStr, 10) : 50

  return {
    page,
    limit,
    skip: page !== null ? (page - 1) * limit : undefined,
    take: page !== null ? limit : undefined
  }
}

/**
 * Create a paginated response with metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Parse time string (HH:MM or HH:MM:SS) into a Date object
 * Returns null if invalid or empty
 */
export function parseTimeString(timeStr: string | null | undefined): Date | null {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
    return null
  }

  // Handle both HH:MM and HH:MM:SS formats
  const trimmed = timeStr.trim()
  const parsedDate = new Date(`1970-01-01T${trimmed}`)

  return !isNaN(parsedDate.getTime()) ? parsedDate : null
}

/**
 * Parse a date string or ISO timestamp into a Date object
 * Returns null if invalid or empty
 */
export function parseDateString(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) {
    return null
  }

  const parsedDate = new Date(dateStr.trim())
  return !isNaN(parsedDate.getTime()) ? parsedDate : null
}

/**
 * Get the list of student IDs that a mentor has access to
 * Returns undefined if user is not a mentor (meaning no filter needed)
 */
export async function getMentorStudentIds(userId: string, userRole: UserRole): Promise<string[] | undefined> {
  if (userRole !== UserRole.MENTOR) {
    return undefined
  }

  const mentees = await prisma.studentEnrollment.findMany({
    where: { mentorId: userId },
    select: { studentId: true }
  })

  return mentees.map(m => m.studentId)
}

/**
 * Create a Prisma where clause filter for mentor access
 * Returns a filter that limits results to mentor's assigned students
 */
export async function createMentorFilter(
  userId: string,
  userRole: UserRole,
  studentIdField: string = 'studentId'
): Promise<Record<string, { in: string[] }> | undefined> {
  const studentIds = await getMentorStudentIds(userId, userRole)

  if (studentIds === undefined) {
    return undefined
  }

  return { [studentIdField]: { in: studentIds } }
}

/**
 * Check if user has admin-level access (SUPER_ADMIN, PRIEST, or SERVANT_PREP)
 */
export function isAdminRole(role: UserRole): boolean {
  const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP]
  return adminRoles.includes(role)
}

/**
 * Wrapper for API route handlers with automatic error handling
 * Usage:
 * export const GET = withErrorHandler(async (request) => { ... })
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wrapper for API route handlers with authentication and error handling
 * Automatically injects the authenticated user as the first argument to the handler
 * Usage:
 * export const GET = withAuth(async (user, request) => { ... })
 */
export function withAuth<T extends unknown[]>(
  handler: (user: Awaited<ReturnType<typeof requireAuth>>, ...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const user = await requireAuth()
      return await handler(user, ...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wrapper for API route handlers with role-based authorization
 * Usage:
 * export const GET = withRole([UserRole.SUPER_ADMIN, UserRole.PRIEST], async (user, request) => { ... })
 */
export function withRole<T extends unknown[]>(
  allowedRoles: UserRole[],
  handler: (user: Awaited<ReturnType<typeof requireAuth>>, ...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const user = await requireAuth()
      if (!allowedRoles.includes(user.role)) {
        throw new Error("Forbidden")
      }
      return await handler(user, ...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Wrapper for API route handlers with admin-only access
 * Usage:
 * export const GET = withAdminAuth(async (user, request) => { ... })
 */
export function withAdminAuth<T extends unknown[]>(
  handler: (user: Awaited<ReturnType<typeof requireAuth>>, ...args: T) => Promise<NextResponse>
) {
  return withRole([UserRole.SUPER_ADMIN, UserRole.PRIEST, UserRole.SERVANT_PREP], handler)
}
