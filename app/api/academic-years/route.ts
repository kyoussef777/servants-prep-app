import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

import { isAdmin } from "@/lib/roles"

// GET /api/academic-years - List all academic years
// All authenticated users can view academic years (needed for dashboard display)
export async function GET() {
  try {
    await requireAuth()

    // All authenticated users can read academic years
    const academicYears = await prisma.academicYear.findMany({
      orderBy: {
        startDate: 'desc'
      },
      include: {
        _count: {
          select: {
            lessons: true,
            exams: true
          }
        }
      }
    })

    return NextResponse.json(academicYears)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch academic years" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/academic-years - Create a new academic year (Admin only)
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
    const { name, startDate, endDate, isActive } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // If setting as active, deactivate all others
    if (isActive) {
      await prisma.academicYear.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      })
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive || false,
      }
    })

    return NextResponse.json(academicYear, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create academic year" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
