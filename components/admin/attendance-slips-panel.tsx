'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Trash2, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateUTC, formatToastTimestamp } from '@/lib/utils'
import { fetcher, defaultSWRConfig, staticDataConfig } from '@/lib/swr'
import type { AcademicYear } from '@/lib/types'
import { uploadSlip, deleteSlip, isPdf, useSlips } from '@/lib/slips-client'

export interface SlipEnrollment {
  studentId: string
  isAsyncStudent: boolean
  asyncReason: string | null
  student: { id: string; name: string }
}

interface Lesson {
  id: string
  title: string
  lessonNumber: number
  scheduledDate: string
}

interface AttendanceSlip {
  id: string
  studentId: string
  imageUrl: string
  createdAt: string
  uploader: { name: string } | null
  attendanceRecords: { lesson: Lesson }[]
}

/**
 * Async students' signed attendance slips. Uploading a slip marks the lessons it
 * covers Present. Pass `enrollment` to show just that student (student details
 * modal); otherwise all active students are loaded.
 */
export function AttendanceSlipsPanel({ enrollment, canEdit, onChange }: {
  enrollment?: SlipEnrollment
  canEdit: boolean
  onChange?: () => void
}) {
  const { data: fetched, error } = useSWR<SlipEnrollment[]>(
    enrollment ? null : '/api/enrollments?status=ACTIVE',
    fetcher,
    defaultSWRConfig
  )
  const { data: slips = [], mutate: mutateSlips } = useSlips<AttendanceSlip>('ATTENDANCE', enrollment?.studentId)

  const [uploadFor, setUploadFor] = useState<SlipEnrollment | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Lessons are only needed once the upload dialog is open
  const { data: years = [] } = useSWR<AcademicYear[]>('/api/academic-years', fetcher, staticDataConfig)
  const activeYearId = years.find(y => y.isActive)?.id
  const { data: lessons = [] } = useSWR<Lesson[]>(
    uploadFor && activeYearId ? `/api/lessons?forAttendance=true&academicYearId=${activeYearId}` : null,
    fetcher,
    defaultSWRConfig
  )

  const slipsByStudent = useMemo(() => {
    const map = new Map<string, AttendanceSlip[]>()
    for (const slip of slips) map.set(slip.studentId, [...(map.get(slip.studentId) ?? []), slip])
    return map
  }, [slips])

  // Students who stopped being async still show if they have slips, so those can be removed
  const students = useMemo(() => (enrollment ? [enrollment] : fetched ?? [])
    .filter(e => e.isAsyncStudent || slipsByStudent.has(e.studentId))
    .sort((a, b) => a.student.name.localeCompare(b.student.name)),
  [enrollment, fetched, slipsByStudent])

  // Only lessons that have already happened can be on a signed slip
  const pastLessons = useMemo(
    () => lessons.filter(l => new Date(l.scheduledDate) <= new Date()).reverse(),
    [lessons]
  )

  const coveredLessonIds = useMemo(() => new Set(
    (uploadFor ? slipsByStudent.get(uploadFor.studentId) ?? [] : []).flatMap(s => s.attendanceRecords.map(r => r.lesson.id))
  ), [slipsByStudent, uploadFor])

  const openUpload = (student: SlipEnrollment) => {
    setUploadFor(student)
    setFile(null)
    setSelected(new Set())
  }

  const toggleLesson = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleSave = async () => {
    if (!uploadFor || !file || selected.size === 0) return
    setSaving(true)
    try {
      const { marked, skipped } = await uploadSlip(file, {
        studentId: uploadFor.studentId,
        type: 'ATTENDANCE',
        lessonIds: JSON.stringify([...selected]),
      })
      toast.success(`Marked ${marked} lesson${marked === 1 ? '' : 's'} Present`, {
        description: `${uploadFor.student.name}${skipped ? ` · ${skipped} already counted, left as is` : ''}`,
      })
      setUploadFor(null)
      await mutateSlips()
      onChange?.()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (slip: AttendanceSlip) => {
    if (!confirm('Remove this slip? The lessons it covers will go back to Absent.')) return
    try {
      await deleteSlip(slip.id)
      toast.success('Attendance slip removed')
      await mutateSlips()
      onChange?.()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove slip')
    }
  }

  if (error) return <EmptyState message="Failed to load attendance slips" />
  if (!enrollment && !fetched) return <TableSkeleton />
  // In a student's modal, stay out of the way unless they're async or have slips
  if (enrollment && students.length === 0) return null

  return (
    <div className="space-y-4">
      {!enrollment && (
        <p className="text-sm text-muted-foreground">
          Async students print an attendance slip from their portal and get each lesson signed.
          Upload a photo of the signed slip to mark those lessons Present.
        </p>
      )}

      {students.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState message="No async students. Mark a student as async from Students → Edit → Profile, or from the Roster." />
          </CardContent>
        </Card>
      ) : students.map(student => {
        const studentSlips = slipsByStudent.get(student.studentId) ?? []
        return (
          <Card key={student.studentId}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="text-base">{enrollment ? 'Attendance Slips' : student.student.name}</CardTitle>
                {!student.isAsyncStudent ? (
                  <p className="text-xs text-amber-700">No longer async — remove slips uploaded in error</p>
                ) : student.asyncReason && <p className="text-xs text-gray-500 truncate">{student.asyncReason}</p>}
              </div>
              {canEdit && student.isAsyncStudent && (
                <Button size="sm" onClick={() => openUpload(student)} className="gap-1 shrink-0">
                  <Upload className="h-4 w-4" />
                  Upload slip
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {studentSlips.length === 0 ? (
                <p className="text-sm text-gray-500">No slips uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {studentSlips.map(slip => (
                    <li key={slip.id} className="flex items-start gap-3 p-2 border rounded-md">
                      <a href={slip.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Open slip">
                        {isPdf(slip.imageUrl) ? (
                          <div className="h-16 w-16 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-medium">PDF</div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Vercel Blob URL
                          <img src={slip.imageUrl} alt="Signed attendance slip" className="h-16 w-16 rounded object-cover border" />
                        )}
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          {slip.attendanceRecords.map(({ lesson }) => (
                            <Badge key={lesson.id} variant="outline" className="text-xs font-normal">
                              #{lesson.lessonNumber} {lesson.title}
                            </Badge>
                          ))}
                          {slip.attendanceRecords.length === 0 && (
                            <span className="text-xs text-gray-500">No lessons linked</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded {formatToastTimestamp(new Date(slip.createdAt))}{slip.uploader && ` by ${slip.uploader.name}`}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(slip)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 shrink-0"
                          aria-label="Remove slip"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={!!uploadFor} onOpenChange={(open) => !open && setUploadFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload attendance slip</DialogTitle>
            <DialogDescription>
              {uploadFor?.student.name} — the lessons you check will be marked Present.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendance-slip-file">Photo of the signed slip</Label>
              <Input
                id="attendance-slip-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Lessons on this slip ({selected.size} selected)</Label>
              {pastLessons.length === 0 ? (
                <p className="text-sm text-gray-500">No past lessons in the active academic year.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto border rounded-md divide-y dark:divide-gray-800">
                  {pastLessons.map(lesson => (
                    <label key={lesson.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
                      <input
                        type="checkbox"
                        checked={selected.has(lesson.id)}
                        disabled={coveredLessonIds.has(lesson.id)}
                        onChange={() => toggleLesson(lesson.id)}
                        className="h-4 w-4 rounded shrink-0"
                      />
                      <span className="flex-1 min-w-0 truncate">#{lesson.lessonNumber} {lesson.title}</span>
                      {coveredLessonIds.has(lesson.id) && (
                        <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0 shrink-0">On a slip</Badge>
                      )}
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatDateUTC(lesson.scheduledDate, { weekday: undefined, year: undefined })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadFor(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !file || selected.size === 0}>
              {saving ? 'Uploading…' : `Mark ${selected.size} Present`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
