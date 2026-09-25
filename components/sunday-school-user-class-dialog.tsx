'use client'

import { useEffect, useMemo, useState } from 'react'
import { SundaySchoolAuthority } from '@prisma/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  compareClassesByLevelAndName,
  getLevelDisplayName,
} from '@/lib/sunday-school-class'
import type { SundaySchoolAssignmentSummary } from '@/lib/sunday-school-user-assignments'
import type { SundaySchoolClass } from '@/types/sunday-school'

interface AssignmentUser {
  id: string
  name: string
  sundaySchoolServing?: SundaySchoolAssignmentSummary[]
}

interface SundaySchoolUserClassDialogProps {
  user: AssignmentUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssignmentsChanged: () => Promise<void>
}

export function SundaySchoolUserClassDialog({
  user,
  open,
  onOpenChange,
  onAssignmentsChanged,
}: SundaySchoolUserClassDialogProps) {
  const [classes, setClasses] = useState<SundaySchoolClass[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingClassId, setPendingClassId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    fetch('/api/sunday-school/classes?isActive=true')
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load Sunday School classes')
        if (!cancelled) setClasses(body)
      })
      .catch(error => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load Sunday School classes')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const directAssignments = useMemo(
    () => new Map(
      (user?.sundaySchoolServing ?? [])
        .filter(assignment => assignment.classId && assignment.class)
        .map(assignment => [assignment.classId!, assignment])
    ),
    [user]
  )

  const sortedClasses = useMemo(
    () => [...classes].sort(compareClassesByLevelAndName),
    [classes]
  )

  const assign = async (classItem: SundaySchoolClass) => {
    if (!user) return

    setPendingClassId(classItem.id)
    try {
      const response = await fetch('/api/sunday-school/servant-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          classId: classItem.id,
          authority: SundaySchoolAuthority.SERVANT,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to assign the class')

      await onAssignmentsChanged()
      toast.success(`${user.name} assigned to ${classItem.name}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign the class')
    } finally {
      setPendingClassId(null)
    }
  }

  const remove = async (classItem: SundaySchoolClass, assignmentId: string) => {
    if (!user) return

    setPendingClassId(classItem.id)
    try {
      const response = await fetch(`/api/sunday-school/servant-assignments?id=${assignmentId}`, {
        method: 'DELETE',
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Failed to remove the class assignment')

      await onAssignmentsChanged()
      toast.success(`${user.name} removed from ${classItem.name}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove the class assignment')
    } finally {
      setPendingClassId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sunday School classes</DialogTitle>
          <DialogDescription>
            Assign {user?.name ?? 'this user'} to one or more classrooms. Class coordinator roles can still be managed from the class page.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading classes…</p>
        ) : sortedClasses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active Sunday School classes are available.
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {sortedClasses.map(classItem => {
              const assignment = directAssignments.get(classItem.id)
              const isPending = pendingClassId === classItem.id

              return (
                <div
                  key={classItem.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{classItem.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{getLevelDisplayName(classItem.level)}</Badge>
                      {assignment?.authority === SundaySchoolAuthority.COORDINATOR && (
                        <Badge className="bg-maroon-600">Coordinator</Badge>
                      )}
                    </div>
                  </div>
                  {assignment ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => remove(classItem, assignment.id)}
                    >
                      {isPending ? 'Removing…' : 'Remove'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => assign(classItem)}
                    >
                      {isPending ? 'Assigning…' : 'Assign'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
