import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool, canTakeSundaySchoolAttendance } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { normalizeSessionDate } from "@/lib/sunday-school-class"

// Sunday School mode: a session is one weekly meeting of one class.

// GET /api/sunday-school/sessions - List sessions
// Query params: ?classId=xxx  ?from=ISO  ?to=ISO
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const where: Record<string, unknown> = {}
    if (classId) where.classId = classId

    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) {
        const parsed = new Date(from)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 })
        }
        dateFilter.gte = parsed
      }
      if (to) {
        const parsed = new Date(to)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 })
        }
        dateFilter.lte = parsed
      }
      where.date = dateFilter
    }

    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds) {
      if (classId && !servantClassIds.includes(classId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      where.classId = classId ? classId : { in: servantClassIds }
    }

    const sessions = await prisma.sundaySchoolSession.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, level: true } },
        taker: { select: { id: true, name: true } },
        _count: { select: { attendance: true } },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(sessions)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/sunday-school/sessions - Create (or return the existing) session
// for a class on a given date. Body: { classId, date, topic?, notes? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canTakeSundaySchoolAttendance(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { classId, date, topic, notes } = body

    if (!classId || !date) {
      return NextResponse.json({ error: "classId and date are required" }, { status: 400 })
    }

    let sessionDate: Date
    try {
      sessionDate = normalizeSessionDate(date)
    } catch {
      return NextResponse.json({ error: "Invalid session date" }, { status: 400 })
    }

    const today = normalizeSessionDate(new Date())
    if (sessionDate > today) {
      return NextResponse.json(
        { error: "Cannot create a session for a future date" },
        { status: 400 }
      )
    }

    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds && !servantClassIds.includes(classId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sundaySchoolClass = await prisma.sundaySchoolClass.findUnique({
      where: { id: classId },
      select: { id: true },
    })
    if (!sundaySchoolClass) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    // Idempotent: opening the attendance page for a date that already has a
    // session should reuse it rather than fail on the unique constraint.
    const existing = await prisma.sundaySchoolSession.findUnique({
      where: { classId_date: { classId, date: sessionDate } },
      include: {
        class: { select: { id: true, name: true, level: true } },
        taker: { select: { id: true, name: true } },
      },
    })
    if (existing) {
      return NextResponse.json(existing)
    }

    const session = await prisma.sundaySchoolSession.create({
      data: {
        classId,
        date: sessionDate,
        topic: topic?.trim() || null,
        notes: notes?.trim() || null,
        takenBy: user.id,
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        taker: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
