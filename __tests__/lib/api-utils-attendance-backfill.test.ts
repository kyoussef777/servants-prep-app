import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { backfillAttendanceForStudents } from '@/lib/api-utils'

describe('attendance backfill for promoted students', () => {
  it('creates only missing active-year records and leaves existing history untouched', async () => {
    const tx = {
      lesson: {
        findMany: vi.fn().mockResolvedValue([{ id: 'lesson-1' }, { id: 'lesson-2' }]),
      },
      attendanceRecord: {
        findMany: vi.fn().mockResolvedValue([
          { studentId: 'student-1', lessonId: 'lesson-1' },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
    }

    const created = await backfillAttendanceForStudents(
      ['student-1', 'student-2', 'student-2'],
      'active-year',
      tx as never
    )

    expect(created).toBe(3)
    expect(tx.lesson.findMany).toHaveBeenCalledWith({
      where: {
        academicYearId: 'active-year',
        status: { notIn: ['CANCELLED', 'NO_CLASS'] },
        isExamDay: false,
        attendanceRecords: { some: {} },
      },
      select: { id: true },
    })
    expect(tx.attendanceRecord.createMany).toHaveBeenCalledWith({
      data: [
        { lessonId: 'lesson-2', studentId: 'student-1', status: 'ABSENT', recordedBy: null },
        { lessonId: 'lesson-1', studentId: 'student-2', status: 'ABSENT', recordedBy: null },
        { lessonId: 'lesson-2', studentId: 'student-2', status: 'ABSENT', recordedBy: null },
      ],
      skipDuplicates: true,
    })
  })

  it('does nothing when there is no target academic year', async () => {
    const tx = {
      lesson: { findMany: vi.fn() },
      attendanceRecord: { findMany: vi.fn(), createMany: vi.fn() },
    }

    await expect(
      backfillAttendanceForStudents(['student-1'], null, tx as never)
    ).resolves.toBe(0)
    expect(tx.lesson.findMany).not.toHaveBeenCalled()
  })
})
