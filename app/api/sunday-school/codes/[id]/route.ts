import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageSundaySchool } from "@/lib/roles"

// PATCH /api/sunday-school/codes/[id] - Deactivate a code
// Body: { isActive: false }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canManageSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { isActive } = body

    if (isActive === undefined) {
      return NextResponse.json(
        { error: "Missing required field: isActive" },
        { status: 400 }
      )
    }

    const code = await prisma.sundaySchoolCode.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json(code)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update code" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
