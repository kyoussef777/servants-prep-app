import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"

// DELETE /api/student-notes/[id] - Delete a note (author or admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: noteId } = await params

    // Get the note
    const note = await prisma.studentNote.findUnique({
      where: { id: noteId }
    })

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      )
    }

    // Only the author or an admin can delete
    if (note.authorId !== user.id && !isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only the author or an admin can delete this note" },
        { status: 403 }
      )
    }

    await prisma.studentNote.delete({
      where: { id: noteId }
    })

    return NextResponse.json({ message: "Note deleted successfully" })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete note" },
      { status: 500 }
    )
  }
}

// PATCH /api/student-notes/[id] - Update a note (author only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: noteId } = await params

    // Get the note
    const note = await prisma.studentNote.findUnique({
      where: { id: noteId }
    })

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      )
    }

    // Only the author can edit their own note
    if (note.authorId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: Only the author can edit this note" },
        { status: 403 }
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

    const updatedNote = await prisma.studentNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
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

    return NextResponse.json(updatedNote)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update note" },
      { status: 500 }
    )
  }
}
