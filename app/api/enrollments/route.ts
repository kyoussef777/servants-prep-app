import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import { isAdmin } from "@/lib/roles"

// GET /api/enrollments - List enrollments
// Query params:
//   ?studentId=xxx - filter by student
//   ?mentorId=xxx - filter by mentor (also works for MENTOR role to get their mentees)
//   ?isActive=true - filter by active status
//   ?yearLevel=YEAR_1 - filter by year level
//   ?academicYearId=xxx - filter by academic year (enrollment year)
//   ?status=ACTIVE|GRADUATED|WITHDRAWN - filter by enrollment status
//   ?page=1&limit=50 - pagination (default: all results for backwards compatibility)
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const mentorId = searchParams.get('mentorId')
    const isActive = searchParams.get('isActive')
    const yearLevel = searchParams.get('yearLevel')
    const academicYearId = searchParams.get('academicYearId')
    const status = searchParams.get('status')
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : null
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    // MENTOR role can only view their own mentees
    // SUPER_ADMIN and SERVANT_PREP can view all or their own mentees
    if (user.role === UserRole.MENTOR) {
      if (mentorId && mentorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Can only view your own mentees" },
          { status: 403 }
        )
      }
    } else if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const where: Record<string, unknown> = {}
    if (studentId) where.studentId = studentId
    if (mentorId) where.mentorId = mentorId
    if (isActive !== null) where.isActive = isActive === 'true'
    if (yearLevel) where.yearLevel = yearLevel
    if (academicYearId) where.academicYearId = academicYearId
    if (status) where.status = status

    // For MENTOR role (not admins), always filter by their ID when no mentorId is specified
    if (user.role === UserRole.MENTOR && !mentorId) {
      where.mentorId = user.id
    }

    const queryOptions: {
      where: Record<string, unknown>
      include: Record<string, unknown>
      orderBy: { enrolledAt: 'desc' }
      skip?: number
      take?: number
    } = {
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        academicYear: {
          select: {
            id: true,
            name: true,
          }
        },
        graduatedAcademicYear: {
          select: {
            id: true,
            name: true,
          }
        },
        fatherOfConfession: {
          select: {
            id: true,
            name: true,
            phone: true,
            church: true,
          }
        }
      },
      orderBy: {
        enrolledAt: 'desc'
      }
    }

    // Add pagination if requested
    if (page !== null) {
      queryOptions.skip = (page - 1) * limit
      queryOptions.take = limit

      const [enrollments, total] = await Promise.all([
        prisma.studentEnrollment.findMany(queryOptions),
        prisma.studentEnrollment.count({ where })
      ])

      return NextResponse.json({
        data: enrollments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }

    // No pagination - return all (backwards compatible)
    const enrollments = await prisma.studentEnrollment.findMany(queryOptions)
    return NextResponse.json(enrollments)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch enrollments" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/enrollments - Create a new enrollment (Admin only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { studentId, yearLevel, mentorId, isActive, academicYearId } = body

    if (!studentId || !yearLevel) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if enrollment already exists
    const existing = await prisma.studentEnrollment.findUnique({
      where: { studentId }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Student is already enrolled" },
        { status: 400 }
      )
    }

    // If no academicYearId provided, use the active academic year
    let enrollmentAcademicYearId = academicYearId
    if (!enrollmentAcademicYearId) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { isActive: true }
      })
      if (activeYear) {
        enrollmentAcademicYearId = activeYear.id
      }
    }

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        studentId,
        yearLevel,
        mentorId: mentorId || null,
        isActive: isActive !== undefined ? isActive : true,
        academicYearId: enrollmentAcademicYearId || null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        mentor: {
          select: {
            id: true,
            name: true,
          }
        },
        academicYear: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create enrollment" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
