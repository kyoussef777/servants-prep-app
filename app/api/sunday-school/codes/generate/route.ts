import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { SundaySchoolGrade } from "@prisma/client"
import { canManageSundaySchool } from "@/lib/roles"
import { generateCode, getCodeValidUntil } from "@/lib/sunday-school-utils"

const ALL_GRADES: SundaySchoolGrade[] = [
  SundaySchoolGrade.PRE_K,
  SundaySchoolGrade.KINDERGARTEN,
  SundaySchoolGrade.GRADE_1,
  SundaySchoolGrade.GRADE_2,
  SundaySchoolGrade.GRADE_3,
  SundaySchoolGrade.GRADE_4,
  SundaySchoolGrade.GRADE_5,
  SundaySchoolGrade.GRADE_6_PLUS,
]

// POST /api/sunday-school/codes/generate - Generate weekly codes for all 8 grades
// Body: { weekOf: string } (ISO date, should be a Sunday)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { weekOf } = body

    if (!weekOf) {
      return NextResponse.json(
        { error: "Missing required field: weekOf" },
        { status: 400 }
      )
    }

    const weekOfDate = new Date(weekOf)
    if (isNaN(weekOfDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for weekOf" },
        { status: 400 }
      )
    }

    // Normalize to start of day
    weekOfDate.setHours(0, 0, 0, 0)

    const validUntil = getCodeValidUntil(weekOfDate)

    // Find grades that already have codes for this week
    const existingCodes = await prisma.sundaySchoolCode.findMany({
      where: { weekOf: weekOfDate },
      select: { grade: true },
    })

    const existingGrades = new Set(existingCodes.map((c) => c.grade))

    // Generate codes for grades that do not have one yet
    const gradesToGenerate = ALL_GRADES.filter((g) => !existingGrades.has(g))

    if (gradesToGenerate.length === 0) {
      return NextResponse.json({
        message: "All grades already have codes for this week",
        generated: [],
      })
    }

    const generatedCodes = await prisma.$transaction(
      gradesToGenerate.map((grade) =>
        prisma.sundaySchoolCode.create({
          data: {
            code: generateCode(grade),
            grade,
            weekOf: weekOfDate,
            validUntil,
            generatedBy: user.id,
          },
        })
      )
    )

    return NextResponse.json({
      message: `Generated codes for ${generatedCodes.length} grade(s)`,
      generated: generatedCodes,
    }, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate codes" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
