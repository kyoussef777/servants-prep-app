import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageSundaySchool } from "@/lib/roles"
import { getWeekStart } from "@/lib/sunday-school-utils"

// GET /api/sunday-school/codes/current - Get current week's codes
export async function GET() {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const currentWeekStart = getWeekStart(new Date())

    const codes = await prisma.sundaySchoolCode.findMany({
      where: { weekOf: currentWeekStart },
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
      orderBy: { grade: "asc" },
    })

    return NextResponse.json({
      weekOf: currentWeekStart,
      codes,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch current codes" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
