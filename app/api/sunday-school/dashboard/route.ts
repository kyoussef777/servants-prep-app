import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { calculateAttendanceStats } from "@/lib/attendance"
import { getMostRecentSunday } from "@/lib/sunday-school-class"

// Sunday School mode: summary for the mode's landing page.
// Deliberately returns no guardian contact — that stays on the child routes.

// GET /api/sunday-school/dashboard
export async function GET() {
  try {
    const user = await requireAuth()

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const servantClassIds = await getServantClassIds(user.id, user.role)

    const classes = await prisma.sundaySchoolClass.findMany({
      where: {
        isActive: true,
        ...(servantClassIds ? { id: { in: servantClassIds } } : {}),
      },
      include: {
        servants: {
          include: { servant: { select: { id: true, name: true, profileImageUrl: true } } },
        },
        _count: { select: { children: true } },
        sessions: {
          orderBy: { date: "desc" },
          take: 1,
          select: { id: true, date: true, topic: true },
        },
      },
      orderBy: { name: "asc" },
    })

    const classIds = classes.map(c => c.id)

    // All attendance for these classes, used for a simple per-class rate
    const attendance = classIds.length
      ? await prisma.sundaySchoolChildAttendance.findMany({
          where: { session: { classId: { in: classIds } } },
          select: { status: true, session: { select: { classId: true } } },
        })
      : []

    const sessionCounts = classIds.length
      ? await prisma.sundaySchoolSession.groupBy({
          by: ["classId"],
          where: { classId: { in: classIds } },
          _count: { _all: true },
        })
      : []
    const sessionCountByClass = new Map(sessionCounts.map(s => [s.classId, s._count._all]))

    const thisSunday = getMostRecentSunday()

    const summaries = classes.map(cls => {
      const classAttendance = attendance.filter(a => a.session.classId === cls.id)
      const sessionCount = sessionCountByClass.get(cls.id) ?? 0
      const childCount = cls._count.children

      // Attendance rate across the marks actually recorded. Basing the
      // denominator on recorded marks rather than sessions × children keeps a
      // child added mid-year from dragging the class rate down for the weeks
      // before they joined. Reuses the app-wide formula (late = half, excused
      // excluded); shown as a plain rate, with none of the graduation framing.
      const stats = calculateAttendanceStats(
        classAttendance.map(a => ({ status: a.status })),
        classAttendance.length
      )

      const latestSession = cls.sessions[0] ?? null
      const attendanceTakenThisWeek = latestSession
        ? new Date(latestSession.date).getTime() >= thisSunday.getTime()
        : false

      return {
        id: cls.id,
        name: cls.name,
        level: cls.level,
        childCount,
        sessionCount,
        attendancePercentage: stats.percentage,
        latestSession,
        attendanceTakenThisWeek,
        servants: cls.servants.map(s => ({
          id: s.servant.id,
          name: s.servant.name,
          profileImageUrl: s.servant.profileImageUrl,
          isLead: s.isLead,
        })),
      }
    })

    return NextResponse.json({
      classes: summaries,
      totals: {
        classes: summaries.length,
        children: summaries.reduce((sum, c) => sum + c.childCount, 0),
        classesNeedingAttendance: summaries.filter(c => !c.attendanceTakenThisWeek).length,
      },
      weekOf: thisSunday,
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
