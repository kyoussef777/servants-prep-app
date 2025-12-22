import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"
import { UserRole } from "@prisma/client"

// GET /api/students/[id]/notes - Get all notes for a student
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Check if user can view notes (admins or the student's mentor)
    if (!isAdmin(user.role) && user.role !== UserRole.MENTOR) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // If non-admin user, verify they are assigned as this student's mentor
    // Admins (SUPER_ADMIN, PRIEST, SERVANT_PREP) have access to all students
    if (!isAdmin(user.role) && user.role === UserRole.MENTOR) {
      const enrollment = await prisma.studentEnrollment.findUnique({
        where: { studentId },
        select: { mentorId: true }
      })

      if (enrollment?.mentorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: You are not this student's mentor" },
          { status: 403 }
        )
      }
    }

    const notes = await prisma.studentNote.findMany({
      where: { studentId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(notes)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notes" },
      { status: 500 }
    )
  }
}

// POST /api/students/[id]/notes - Add a new note for a student
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: studentId } = await params

    // Check if user can add notes (admins or the student's mentor)
    if (!isAdmin(user.role) && user.role !== UserRole.MENTOR) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // If non-admin user, verify they are assigned as this student's mentor
    // Admins (SUPER_ADMIN, PRIEST, SERVANT_PREP) have access to all students
    if (!isAdmin(user.role) && user.role === UserRole.MENTOR) {
      const enrollment = await prisma.studentEnrollment.findUnique({
        where: { studentId },
        select: { mentorId: true }
      })

      if (enrollment?.mentorId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: You are not this student's mentor" },
          { status: 403 }
        )
      }
    }

    // Verify student exists
    const student = await prisma.user.findUnique({
      where: { id: studentId, role: UserRole.STUDENT }
    })

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      )
    }

    const note = await prisma.studentNote.create({
      data: {
        studentId,
        authorId: user.id,
        content: content.trim()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      }
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create note" },
      { status: 500 }
    )
  }
}
