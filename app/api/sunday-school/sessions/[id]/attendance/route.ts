import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"

// Sunday School mode: the roster + current marks for one session.
// This is what the attendance screen loads — every active child in the class,
// with their mark for this session if one has been saved.

// GET /api/sunday-school/sessions/[id]/attendance
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const session = await prisma.sundaySchoolSession.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true, level: true } },
        taker: { select: { id: true, name: true } },
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds && !servantClassIds.includes(session.classId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [children, records] = await Promise.all([
      prisma.sundaySchoolChild.findMany({
        where: { classId: session.classId, isActive: true },
        select: { id: true, firstName: true, lastName: true, level: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.sundaySchoolChildAttendance.findMany({
        where: { sessionId: id },
        select: { id: true, childId: true, status: true, notes: true },
      }),
    ])

    const recordByChild = new Map(records.map(r => [r.childId, r]))

    return NextResponse.json({
      session,
      roster: children.map(child => ({
        ...child,
        attendance: recordByChild.get(child.id) ?? null,
      })),
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
