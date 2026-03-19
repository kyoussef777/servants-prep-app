import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { canManageData } from "@/lib/roles"
import { AttendanceStatus } from "@prisma/client"
import { parseTimeString, handleApiError } from "@/lib/api-utils"
import { notifyAttendanceRecorded, notifyConductRemoval } from "@/lib/notifications"

interface AttendanceRecord {
  studentId: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  arrivedAt?: string | null
  notes?: string | null
  conductRemoval?: boolean
  conductNote?: string | null
}

interface BatchRequest {
  lessonId: string
  records: AttendanceRecord[]
}

// POST /api/attendance/batch - Save multiple attendance records in one request
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // PRIEST is read-only, only SUPER_ADMIN and SERVANT_PREP can manage attendance
    if (!canManageData(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body: BatchRequest = await request.json()
    const { lessonId, records } = body

    if (!lessonId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Missing lessonId or records array" },
        { status: 400 }
      )
    }

    // Verify lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId }
    })

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      )
    }

    // Prevent editing attendance for future lessons
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lessonDate = new Date(lesson.scheduledDate)
    lessonDate.setHours(0, 0, 0, 0)
    if (lessonDate > today) {
      return NextResponse.json(
        { error: "Cannot edit attendance before the lesson date" },
        { status: 400 }
      )
    }

    // Get existing attendance records for this lesson
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { lessonId },
      select: { id: true, studentId: true }
    })

    const existingByStudent = new Map(
      existingRecords.map(r => [r.studentId, r.id])
    )

    // Validate conduct removals: must have a non-empty note
    for (const record of records) {
      if (record.conductRemoval === true && (!record.conductNote || !record.conductNote.trim())) {
        return NextResponse.json(
          { error: `A reason is required when removing a student from a lesson` },
          { status: 400 }
        )
      }
    }

    // Separate into creates and updates
    const toCreate: Array<{
      lessonId: string
      studentId: string
      status: 'PRESENT' | 'LATE' | 'ABSENT'
      arrivedAt: Date | null
      notes: string | null
      recordedBy: string
      conductRemoval: boolean
      conductNote: string | null
    }> = []

    const toUpdate: Array<{
      id: string
      status: 'PRESENT' | 'LATE' | 'ABSENT'
      arrivedAt: Date | null
      notes: string | null
      conductRemoval: boolean
      conductNote: string | null
    }> = []

    for (const record of records) {
      const existingId = existingByStudent.get(record.studentId)
      // Parse arrivedAt using utility function
      const arrivedAt = parseTimeString(record.arrivedAt)
      const conductRemoval = record.conductRemoval === true
      const conductNote = conductRemoval ? (record.conductNote || null) : null

      if (existingId) {
        toUpdate.push({
          id: existingId,
          status: record.status,
          arrivedAt,
          notes: record.notes || null,
          conductRemoval,
          conductNote,
        })
      } else {
        toCreate.push({
          lessonId,
          studentId: record.studentId,
          status: record.status,
          arrivedAt,
          notes: record.notes || null,
          recordedBy: user.id,
          conductRemoval,
          conductNote,
        })
      }
    }

    // Execute batch operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Batch create new records
      if (toCreate.length > 0) {
        await tx.attendanceRecord.createMany({
          data: toCreate
        })
      }

      // Batch update existing records
      if (toUpdate.length > 0) {
        // Group simple status-only updates (no arrivedAt, notes, or conductRemoval)
        const updateGroups = new Map<string, typeof toUpdate>()
        const complexUpdates: typeof toUpdate = []

        for (const update of toUpdate) {
          if (update.arrivedAt === null && update.notes === null && !update.conductRemoval) {
            // Simple status-only updates can be grouped
            if (!updateGroups.has(update.status)) {
              updateGroups.set(update.status, [])
            }
            updateGroups.get(update.status)!.push(update)
          } else {
            // Complex updates need individual handling
            complexUpdates.push(update)
          }
        }

        // Execute grouped updates (clears conduct removal when not flagged)
        for (const [status, groupedRecords] of updateGroups) {
          if (groupedRecords.length > 0) {
            await tx.attendanceRecord.updateMany({
              where: { id: { in: groupedRecords.map(r => r.id) } },
              data: { status: status as AttendanceStatus, conductRemoval: false, conductNote: null }
            })
          }
        }

        // Execute individual complex updates
        for (const update of complexUpdates) {
          await tx.attendanceRecord.update({
            where: { id: update.id },
            data: {
              status: update.status,
              arrivedAt: update.arrivedAt,
              notes: update.notes,
              conductRemoval: update.conductRemoval,
              conductNote: update.conductNote,
            }
          })
        }
      }
    })

    // Send notifications to mentors (non-blocking)
    const studentIds = records.map((r: AttendanceRecord) => r.studentId)
    const conductRemovals = records.filter((r: AttendanceRecord) => r.conductRemoval === true)
    prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    }).then(async (students) => {
      const studentRecords = records.map((r: AttendanceRecord) => ({
        studentId: r.studentId,
        studentName: students.find((s) => s.id === r.studentId)?.name || 'Student',
        status: r.status,
      }))
      const lessonDate = lesson.scheduledDate
        ? new Date(lesson.scheduledDate).toLocaleDateString()
        : 'N/A'
      await notifyAttendanceRecorded({
        lessonTitle: lesson.title,
        lessonDate,
        studentRecords,
      }).catch(() => {})

      // Notify mentors for each conduct removal (non-blocking)
      const removedByName = user.name || 'Admin'
      for (const removal of conductRemovals) {
        const studentName = students.find((s) => s.id === removal.studentId)?.name || 'Student'
        notifyConductRemoval({
          studentId: removal.studentId,
          studentName,
          lessonTitle: lesson.title,
          conductNote: removal.conductNote || '',
          removedByName,
        }).catch(() => {})
      }
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      created: toCreate.length,
      updated: toUpdate.length
    })
  } catch (error: unknown) {
    console.error('Batch attendance save error:', error)
    return handleApiError(error)
  }
}
