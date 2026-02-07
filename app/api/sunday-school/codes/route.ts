import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { SundaySchoolGrade } from "@prisma/client"
import { canManageSundaySchool } from "@/lib/roles"

// GET /api/sunday-school/codes - List codes with filters
// Query params:
//   ?weekOf=2025-01-05 - filter by week
//   ?grade=GRADE_1 - filter by grade
//   ?isActive=true - filter by active status
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const weekOf = searchParams.get("weekOf")
    const grade = searchParams.get("grade")
    const isActive = searchParams.get("isActive")

    const where: Record<string, unknown> = {}
    if (weekOf) where.weekOf = new Date(weekOf)
    if (grade) where.grade = grade as SundaySchoolGrade
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true"

    const codes = await prisma.sundaySchoolCode.findMany({
      where,
      include: {
        generator: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: [{ weekOf: "desc" }, { grade: "asc" }],
    })

    return NextResponse.json(codes)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch codes" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
