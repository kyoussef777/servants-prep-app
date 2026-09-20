import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import { canServeClass, getSundaySchoolAccess } from "@/lib/sunday-school-access"

// Sunday School mode: edit or remove one weekly session.

/** Serving the session's class is what allows editing or deleting it. */
async function assertSessionAccess(sessionId: string, user: { id: string; role: UserRole }) {
  const session = await prisma.sundaySchoolSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true, class: { select: { academicYearId: true } } },
  })
  if (!session) {
    throw new Error("Not found")
  }

  const access = await getSundaySchoolAccess(user, session.class.academicYearId)
  if (!canServeClass(access, session.classId)) {
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

    await assertSessionAccess(id, user)

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

    await assertSessionAccess(id, user)

    await prisma.sundaySchoolSession.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
