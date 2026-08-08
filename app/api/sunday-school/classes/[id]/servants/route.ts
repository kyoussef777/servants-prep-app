import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageSundaySchoolClasses } from "@/lib/roles"
import { handleApiError } from "@/lib/api-utils"
import { UserRole } from "@prisma/client"

// Sunday School mode: which servants serve a given class.

// POST /api/sunday-school/classes/[id]/servants - Assign a servant to the class
// Body: { servantId, isLead? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: classId } = await params

    if (!canManageSundaySchoolClasses(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { servantId, isLead } = body

    if (!servantId) {
      return NextResponse.json({ error: "servantId is required" }, { status: 400 })
    }

    const sundaySchoolClass = await prisma.sundaySchoolClass.findUnique({
      where: { id: classId },
      select: { id: true },
    })
    if (!sundaySchoolClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    // Only SERVANT users can be assigned to a Sunday School class — this keeps
    // prep-side roles from picking up Sunday School access by assignment.
    const servant = await prisma.user.findUnique({
      where: { id: servantId },
      select: { id: true, role: true },
    })
    if (!servant) {
      return NextResponse.json({ error: "Servant not found" }, { status: 404 })
    }
    if (servant.role !== UserRole.SERVANT) {
      return NextResponse.json(
        { error: "Only users with the Sunday School Servant role can be assigned to a class" },
        { status: 400 }
      )
    }

    const existing = await prisma.sundaySchoolClassServant.findUnique({
      where: { classId_servantId: { classId, servantId } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This servant is already assigned to the class" },
        { status: 409 }
      )
    }

    const assignment = await prisma.sundaySchoolClassServant.create({
      data: {
        classId,
        servantId,
        isLead: isLead === true,
        assignedBy: user.id,
      },
      include: {
        servant: { select: { id: true, name: true, email: true, profileImageUrl: true } },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// DELETE /api/sunday-school/classes/[id]/servants?servantId=xxx - Unassign a servant
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: classId } = await params

    if (!canManageSundaySchoolClasses(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const servantId = searchParams.get("servantId")

    if (!servantId) {
      return NextResponse.json({ error: "servantId is required" }, { status: 400 })
    }

    await prisma.sundaySchoolClassServant.delete({
      where: { classId_servantId: { classId, servantId } },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
