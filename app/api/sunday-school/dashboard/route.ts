import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { handleApiError } from "@/lib/api-utils"
import {
  canCoordinateClass,
  canServeClass,
  getSundaySchoolAccess,
  visibleClassFilter,
} from "@/lib/sunday-school-access"
import { calculateAttendanceStats } from "@/lib/attendance"
import { findAgeGroupForLevel, getMostRecentSunday } from "@/lib/sunday-school-class"

// Sunday School mode: summary for the mode's landing page.
// Deliberately returns no guardian contact — that stays on the child routes.

// GET /api/sunday-school/dashboard
export async function GET() {
  try {
    const user = await requireAuth()

    const access = await getSundaySchoolAccess(user)
    if (!access.canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const allowedClassIds = visibleClassFilter(access)

    const [classes, ageGroups] = await Promise.all([
      prisma.sundaySchoolClass.findMany({
        where: {
          isActive: true,
          ...(allowedClassIds ? { id: { in: allowedClassIds } } : {}),
        },
        include: {
          assignments: {
            include: { user: { select: { id: true, name: true, profileImageUrl: true } } },
          },
          _count: { select: { children: true } },
          sessions: {
            orderBy: { date: "desc" },
            take: 1,
            select: { id: true, date: true, topic: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.sundaySchoolAgeGroup.findMany({
        where: { isActive: true },
        select: { id: true, name: true, levels: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ])

    const classIds = classes.map(c => c.id)

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
      const band = findAgeGroupForLevel(cls.level, ageGroups)

      return {
        id: cls.id,
        name: cls.name,
        level: cls.level,
        ageGroup: band ? { id: band.id, name: band.name } : null,
        childCount: cls._count.children,
        sessionCount: sessionCountByClass.get(cls.id) ?? 0,
        attendancePercentage: stats.percentage,
        latestSession,
        attendanceTakenThisWeek: latestSession
          ? new Date(latestSession.date).getTime() >= thisSunday.getTime()
          : false,
        canServe: canServeClass(access, cls.id),
        canCoordinate: canCoordinateClass(access, cls.id),
        servants: cls.assignments
          .filter(a => a.classId === cls.id)
          .map(a => ({
            id: a.user.id,
            name: a.user.name,
            profileImageUrl: a.user.profileImageUrl,
            isCoordinator: a.authority === "COORDINATOR",
          })),
      }
    })

    return NextResponse.json({
      classes: summaries,
      ageGroups: ageGroups.map(group => ({
        id: group.id,
        name: group.name,
        levels: group.levels,
        canCoordinate: access.isAdmin || access.coordinatorAgeGroupIds.has(group.id),
      })),
      totals: {
        classes: summaries.length,
        children: summaries.reduce((sum, c) => sum + c.childCount, 0),
        classesNeedingAttendance: summaries.filter(c => !c.attendanceTakenThisWeek).length,
      },
      standing: {
        isAdmin: access.isAdmin,
        readOnly: access.readOnly,
        coordinatesAnyAgeGroup: access.coordinatorAgeGroupIds.size > 0,
      },
      weekOf: thisSunday,
    })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
