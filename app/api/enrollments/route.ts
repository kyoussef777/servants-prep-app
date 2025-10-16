import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

import { isAdmin } from "@/lib/roles"

// GET /api/enrollments - List enrollments
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const mentorId = searchParams.get('mentorId')

    const where: any = {}
    if (studentId) where.studentId = studentId
    if (mentorId) where.mentorId = mentorId

    const enrollments = await prisma.studentEnrollment.findMany({
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
        }
      },
      orderBy: {
        enrolledAt: 'desc'
      }
    })

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
    const { studentId, yearLevel, mentorId, isActive } = body

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

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        studentId,
        yearLevel,
        mentorId: mentorId || null,
        isActive: isActive !== undefined ? isActive : true,
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
