import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { isAdmin } from "@/lib/roles"
import { AttendanceStatus } from "@prisma/client"

interface AttendanceRecord {
  studentId: string
  status: 'PRESENT' | 'LATE' | 'ABSENT'
  arrivedAt?: string | null
  notes?: string | null
}

interface BatchRequest {
  lessonId: string
  records: AttendanceRecord[]
}

// POST /api/attendance/batch - Save multiple attendance records in one request
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    if (!isAdmin(user.role)) {
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

    // Get existing attendance records for this lesson
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { lessonId },
      select: { id: true, studentId: true }
    })

    const existingByStudent = new Map(
      existingRecords.map(r => [r.studentId, r.id])
    )

    // Separate into creates and updates
    const toCreate: Array<{
      lessonId: string
      studentId: string
      status: 'PRESENT' | 'LATE' | 'ABSENT'
      arrivedAt: Date | null
      notes: string | null
      recordedBy: string
    }> = []

    const toUpdate: Array<{
      id: string
      status: 'PRESENT' | 'LATE' | 'ABSENT'
      arrivedAt: Date | null
      notes: string | null
    }> = []

    for (const record of records) {
      const existingId = existingByStudent.get(record.studentId)
      // Validate arrivedAt - must be a non-empty string that creates a valid date
      let arrivedAt: Date | null = null
      if (record.arrivedAt && record.arrivedAt.trim()) {
        const parsedDate = new Date(`1970-01-01T${record.arrivedAt}`)
        // Only use the date if it's valid
        if (!isNaN(parsedDate.getTime())) {
          arrivedAt = parsedDate
        }
      }

      if (existingId) {
        toUpdate.push({
          id: existingId,
          status: record.status,
          arrivedAt,
          notes: record.notes || null
        })
      } else {
        toCreate.push({
          lessonId,
          studentId: record.studentId,
          status: record.status,
          arrivedAt,
          notes: record.notes || null,
          recordedBy: user.id
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
      // Group updates by status for better performance
      if (toUpdate.length > 0) {
        // Group updates that have the same status (most common case)
        const updateGroups = new Map<string, typeof toUpdate>()
        const complexUpdates: typeof toUpdate = []

        for (const update of toUpdate) {
          const key = `${update.status}_${update.arrivedAt}_${update.notes || ''}`
          if (update.arrivedAt === null && update.notes === null) {
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

        // Execute grouped updates
        for (const [status, records] of updateGroups) {
          if (records.length > 0) {
            await tx.attendanceRecord.updateMany({
              where: { id: { in: records.map(r => r.id) } },
              data: { status: status as AttendanceStatus }
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
              notes: update.notes
            }
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      created: toCreate.length,
      updated: toUpdate.length
    })
  } catch (error: unknown) {
    console.error('Batch attendance save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save attendance" },
      { status: 500 }
    )
  }
}
