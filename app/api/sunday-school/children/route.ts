import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canAccessSundaySchool, canManageSundaySchoolChildren } from "@/lib/roles"
import { getServantClassIds, handleApiError } from "@/lib/api-utils"
import { isValidLevel } from "@/lib/sunday-school-class"
import { SundaySchoolLevel } from "@prisma/client"

// Sunday School mode: the children enrolled in the Sunday School classes.
//
// Guardian contact belongs to minors, so it is only ever returned here — to a
// servant of the child's class or to an admin — and never from the dashboard
// summary route or the command palette.

// GET /api/sunday-school/children - List children
// Query params: ?classId=xxx  ?level=GRADE_3  ?isActive=true  ?search=name
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    if (!canAccessSundaySchool(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const level = searchParams.get("level")
    const isActive = searchParams.get("isActive")
    const search = searchParams.get("search")

    const where: Record<string, unknown> = {}
    if (classId) where.classId = classId
    if (level) where.level = level as SundaySchoolLevel
    if (isActive !== null && isActive !== undefined) where.isActive = isActive === "true"
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ]
    }

    // A servant only sees children in the classes they serve. Unassigned
    // children (no class) are admin-only.
    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds) {
      if (classId && !servantClassIds.includes(classId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      where.classId = classId ? classId : { in: servantClassIds }
    }

    const children = await prisma.sundaySchoolChild.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    })

    return NextResponse.json(children)
  } catch (error: unknown) {
    return handleApiError(error)
  }
}

// POST /api/sunday-school/children - Add a child to the roster
// Body: { firstName, lastName, level, classId?, birthDate?, guardianName?,
//         guardianPhone?, guardianEmail?, notes? }
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!canManageSundaySchoolChildren(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      level,
      classId,
      birthDate,
      guardianName,
      guardianPhone,
      guardianEmail,
      notes,
    } = body

    if (!firstName || !String(firstName).trim()) {
      return NextResponse.json({ error: "First name is required" }, { status: 400 })
    }
    if (!lastName || !String(lastName).trim()) {
      return NextResponse.json({ error: "Last name is required" }, { status: 400 })
    }
    if (!isValidLevel(level)) {
      return NextResponse.json({ error: "A valid grade level is required" }, { status: 400 })
    }

    // Servants can only add children to a class they serve
    const servantClassIds = await getServantClassIds(user.id, user.role)
    if (servantClassIds) {
      if (!classId || !servantClassIds.includes(classId)) {
        return NextResponse.json(
          { error: "You can only add children to a class you serve" },
          { status: 403 }
        )
      }
    }

    let parsedBirthDate: Date | null = null
    if (birthDate) {
      parsedBirthDate = new Date(birthDate)
      if (isNaN(parsedBirthDate.getTime())) {
        return NextResponse.json({ error: "Invalid birth date" }, { status: 400 })
      }
    }

    const child = await prisma.sundaySchoolChild.create({
      data: {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        level,
        classId: classId || null,
        birthDate: parsedBirthDate,
        guardianName: guardianName?.trim() || null,
        guardianPhone: guardianPhone?.trim() || null,
        guardianEmail: guardianEmail?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
    })

    return NextResponse.json(child, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
