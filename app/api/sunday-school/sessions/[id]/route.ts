import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canTakeSundaySchoolAttendance } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"

// Sunday School mode: edit or remove one weekly session.

async function assertSessionAccess(
  sessionId: string,
  userId: string,
  role: Parameters<typeof getServantClassIds>[1]
) {
  const session = await prisma.sundaySchoolSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true },
  })
  if (!session) {
    throw new Error("Not found")
  }

  const servantClassIds = await getServantClassIds(userId, role)
  if (servantClassIds && !servantClassIds.includes(session.classId)) {
    throw new Error("Forbidden")
  }

  return session
}

// PATCH /api/sunday-school/sessions/[id] - Update topic/notes
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canTakeSundaySchoolAttendance(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await assertSessionAccess(id, user.id, user.role)

    const body = await request.json()
    const { topic, notes } = body

    const updateData: Record<string, unknown> = {}
    if (topic !== undefined) updateData.topic = topic?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const updated = await prisma.sundaySchoolSession.update({
      where: { id },
      data: updateData,
      include: {
        class: { select: { id: true, name: true, level: true } },
        taker: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// DELETE /api/sunday-school/sessions/[id] - Delete a session and its attendance
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canTakeSundaySchoolAttendance(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await assertSessionAccess(id, user.id, user.role)

    await prisma.sundaySchoolSession.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
