'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { canManageCurriculum } from '@/lib/roles'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PageLoading } from '@/components/ui/page-loading'
import { PageHeader } from '@/components/admin/page-header'
import { SortableRow } from '@/components/curriculum/sortable-row'
import { MobileLessonCard } from '@/components/curriculum/mobile-lesson-card'
import type { Lesson, Section, LessonEdits } from '@/components/curriculum/types'
import type { AcademicYear } from '@/lib/types'

export default function CurriculumPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Track edited fields per lesson
  const [editedLessons, setEditedLessons] = useState<Map<string, LessonEdits>>(new Map())
  const hasUnsavedChanges = editedLessons.size > 0

  // Add lesson form
  const [showAddRow, setShowAddRow] = useState(false)
  const [newLesson, setNewLesson] = useState({
    title: '',
    speaker: '',
    scheduledDate: '',
    examSectionId: '',
    isExamDay: false,
    subtitle: '',
    description: '',
  })
  const [formAcademicYearId, setFormAcademicYearId] = useState<string>('')

  // Refs for event handlers that need access to latest state
  const hasUnsavedRef = useRef(false)
  hasUnsavedRef.current = hasUnsavedChanges
  const saveRef = useRef<() => void>(() => {})

  // Warn about unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedRef.current) {
          saveRef.current()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch academic years and sections on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const yearsRes = await fetch('/api/academic-years')
        if (!yearsRes.ok) throw new Error('Failed to fetch years')
        const years = await yearsRes.json()
        const yearsArray = Array.isArray(years) ? years : []
        setAcademicYears(yearsArray)

        const activeYear = yearsArray.find((y: AcademicYear) => y.isActive)
        if (activeYear) {
          setSelectedYearId('all')
          setFormAcademicYearId(activeYear.id)
        }

        const sectionsRes = await fetch('/api/exam-sections')
        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json()
          setSections(Array.isArray(sectionsData) ? sectionsData : [])
          if (sectionsData.length > 0) {
            setNewLesson(prev => ({ ...prev, examSectionId: sectionsData[0].id }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      }
    }

    if (session?.user) {
      fetchInitialData()
    }
  }, [session])

  // Fetch lessons when selected year changes
  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedYearId) return

      setLoading(true)
      try {
        const url = selectedYearId && selectedYearId !== 'all'
          ? `/api/lessons?academicYearId=${selectedYearId}`
          : '/api/lessons'

        const lessonsRes = await fetch(url)
        if (!lessonsRes.ok) {
          const errorData = await lessonsRes.json()
          throw new Error(errorData.error || 'Failed to fetch lessons')
        }
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
        setEditedLessons(new Map())
      } catch (error) {
        console.error('Failed to fetch lessons:', error)
        setLessons([])
      } finally {
        setLoading(false)
      }
    }

    if (session?.user && selectedYearId) {
      fetchLessons()
    }
  }, [session, selectedYearId])

  const handleEdit = useCallback((id: string, field: keyof LessonEdits, value: string | boolean) => {
    setEditedLessons(prev => {
      const next = new Map(prev)
      const existing = next.get(id) || {}
      next.set(id, { ...existing, [field]: value })
      return next
    })
  }, [])

  const handleEditResources = useCallback((id: string, resources: { title: string; url: string }[]) => {
    setEditedLessons(prev => {
      const next = new Map(prev)
      const existing = next.get(id) || {}
      next.set(id, { ...existing, resources })
      return next
    })
  }, [])

  const handleDuplicate = async (lessonId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: new Date().toISOString() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to duplicate lesson')
      }

      const duplicated = await res.json()
      setLessons(prev => [...prev, duplicated])
      toast.success('Lesson duplicated', {
        description: `"${duplicated.title}" created`,
      })
    } catch (error) {
      console.error('Failed to duplicate lesson:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate lesson')
    }
  }

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const fetchLessonsUrl = () =>
    selectedYearId && selectedYearId !== 'all'
      ? `/api/lessons?academicYearId=${selectedYearId}`
      : '/api/lessons'

  const refetchLessons = async () => {
    const lessonsRes = await fetch(fetchLessonsUrl())
    if (lessonsRes.ok) {
      const lessonsData = await lessonsRes.json()
      setLessons(Array.isArray(lessonsData) ? lessonsData : [])
    }
  }

  const handleSaveAll = async () => {
    if (editedLessons.size === 0) return
    setSaving(true)

    try {
      const updates = Array.from(editedLessons.entries()).map(([id, edits]) => ({
        id,
        ...edits,
      }))

      const res = await fetch('/api/lessons/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: updates }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      await refetchLessons()
      setEditedLessons(new Map())
      const now = new Date()
      setLastSaved(now)
      toast.success(`Saved ${updates.length} lesson${updates.length > 1 ? 's' : ''}`, {
        description: now.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }),
      })
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }
  saveRef.current = handleSaveAll

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentFiltered = lessons
      .filter(lesson => {
        if (searchTerm) {
          const term = searchTerm.toLowerCase()
          if (!lesson.title.toLowerCase().includes(term) &&
              !(lesson.speaker || '').toLowerCase().includes(term) &&
              !(lesson.description || '').toLowerCase().includes(term)) return false
        }
        if (filterSection !== 'all' && lesson.examSection.name !== filterSection) return false
        return true
      })
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())

    const oldIndex = currentFiltered.findIndex(l => l.id === active.id)
    const newIndex = currentFiltered.findIndex(l => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reorderedFiltered = arrayMove(currentFiltered, oldIndex, newIndex)

    setReordering(true)
    try {
      const res = await fetch('/api/lessons/batch/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonIds: reorderedFiltered.map(l => l.id) }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reorder')
      }

      await refetchLessons()
      toast.success('Lessons reordered')
    } catch (error) {
      console.error('Failed to reorder:', error)
      toast.error('Failed to reorder lessons')
      await refetchLessons()
    } finally {
      setReordering(false)
    }
  }

  const handleAddLesson = async () => {
    if (!newLesson.title || !newLesson.scheduledDate || !formAcademicYearId) {
      toast.error('Title and date are required')
      return
    }

    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newLesson.title,
          speaker: newLesson.speaker || null,
          subtitle: newLesson.subtitle || null,
          description: newLesson.description || null,
          scheduledDate: new Date(newLesson.scheduledDate).toISOString(),
          examSectionId: newLesson.examSectionId,
          academicYearId: formAcademicYearId,
          isExamDay: newLesson.isExamDay,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create lesson')
      }

      const created = await res.json()
      setLessons(prev => [...prev, created])
      setShowAddRow(false)
      setNewLesson({
        title: '',
        speaker: '',
        scheduledDate: '',
        examSectionId: sections[0]?.id || '',
        isExamDay: false,
        subtitle: '',
        description: '',
      })
      const now = new Date()
      setLastSaved(now)
      toast.success('Lesson created', {
        description: now.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }),
      })
    } catch (error) {
      console.error('Failed to create lesson:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create lesson')
    }
  }

  const handleDelete = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      setLessons(prev => prev.filter(l => l.id !== lessonId))
      setEditedLessons(prev => {
        const next = new Map(prev)
        next.delete(lessonId)
        return next
      })
      toast.success('Lesson deleted')
    } catch (error) {
      console.error('Failed to delete lesson:', error)
      toast.error('Failed to delete lesson')
    }
  }

  const handleDiscardChanges = () => {
    if (editedLessons.size > 0 && confirm('Discard all unsaved changes?')) {
      setEditedLessons(new Map())
    }
  }

  const handleMobileMove = async (lessonId: string, direction: 'up' | 'down') => {
    const idx = filteredLessons.findIndex(l => l.id === lessonId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= filteredLessons.length) return

    const reordered = [...filteredLessons]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

    setReordering(true)
    try {
      const res = await fetch('/api/lessons/batch/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonIds: reordered.map(l => l.id) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reorder')
      }

      await refetchLessons()
      toast.success('Lesson moved')
    } catch (error) {
      console.error('Failed to move lesson:', error)
      toast.error('Failed to move lesson')
    } finally {
      setReordering(false)
    }
  }

  const filtersActive = searchTerm !== '' || filterSection !== 'all'

  const filteredLessons = lessons
    .filter(lesson => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchTitle = lesson.title.toLowerCase().includes(term)
        const matchSpeaker = (lesson.speaker || '').toLowerCase().includes(term)
        const matchDesc = (lesson.description || '').toLowerCase().includes(term)
        if (!matchTitle && !matchSpeaker && !matchDesc) return false
      }
      if (filterSection !== 'all' && lesson.examSection.name !== filterSection) {
        return false
      }
      return true
    })
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())

  if (loading || status === 'loading') {
    return <PageLoading />
  }

  const canEdit = session?.user?.role && canManageCurriculum(session.user.role)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <PageHeader
          title="Curriculum"
          description={canEdit ? 'Edit lessons inline, drag to reorder, save all at once' : 'Lesson schedule and curriculum'}
          lastSaved={lastSaved}
          actions={canEdit && hasUnsavedChanges ? (
            <>
              <span className="text-sm text-amber-600 font-medium">
                {editedLessons.size} unsaved change{editedLessons.size > 1 ? 's' : ''}
              </span>
              <Button variant="outline" size="sm" onClick={handleDiscardChanges}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSaveAll} disabled={saving}>
                {saving ? 'Saving...' : 'Save All Changes'}
              </Button>
            </>
          ) : undefined}
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap items-center">
              <Input
                type="text"
                placeholder="Search topics, speakers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
              >
                <option value="all">All Academic Years</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name} {year.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
              >
                <option value="all">All Sections</option>
                {sections.map(section => (
                  <option key={section.id} value={section.name}>
                    {section.displayName}
                  </option>
                ))}
              </select>
              {canEdit && !showAddRow && (
                <Button
                  size="sm"
                  className="ml-auto bg-maroon-600 hover:bg-maroon-700 text-white"
                  onClick={() => setShowAddRow(true)}
                >
                  + Add Lesson
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Desktop: Spreadsheet Table */}
        <Card className="hidden md:block relative">
          {reordering && (
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
                Reordering...
              </div>
            </div>
          )}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                autoScroll={false}
              >
                <table className="w-full text-sm" style={{ minWidth: canEdit ? 820 : 640 }}>
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {canEdit && <th className="p-1 w-8"></th>}
                      <th className="text-center p-2 w-8">#</th>
                      <th className="text-left p-2 w-32">Date</th>
                      <th className="text-left p-2">Topic</th>
                      <th className="text-left p-2 w-32">Speaker</th>
                      <th className="text-left p-2 w-36">Section</th>
                      <th className="text-center p-2 w-14">Exam</th>
                      <th className="text-center p-2 w-20">Status</th>
                      <th className="text-center p-2 w-20"></th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={filteredLessons.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {canEdit && showAddRow && (
                        <tr className="border-b bg-green-50 dark:bg-green-900/20">
                          <td colSpan={9} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Add New Lesson</h3>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAddRow(false)}>
                                ✕ Cancel
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500">Title *</label>
                                <Input value={newLesson.title} onChange={(e) => setNewLesson(prev => ({ ...prev, title: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Topic title" autoFocus />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Speaker</label>
                                <Input value={newLesson.speaker} onChange={(e) => setNewLesson(prev => ({ ...prev, speaker: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Speaker name" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Date *</label>
                                <Input type="date" value={newLesson.scheduledDate} onChange={(e) => setNewLesson(prev => ({ ...prev, scheduledDate: e.target.value }))} className="h-8 text-sm mt-0.5" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Section</label>
                                <select value={newLesson.examSectionId} onChange={(e) => setNewLesson(prev => ({ ...prev, examSectionId: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600">
                                  {sections.map(section => (<option key={section.id} value={section.id}>{section.displayName}</option>))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Subtitle</label>
                                <Input value={newLesson.subtitle} onChange={(e) => setNewLesson(prev => ({ ...prev, subtitle: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Subtitle (optional)" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Description</label>
                                <Input value={newLesson.description} onChange={(e) => setNewLesson(prev => ({ ...prev, description: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Description (optional)" />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Academic Year</label>
                                <select value={formAcademicYearId} onChange={(e) => setFormAcademicYearId(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600">
                                  {academicYears.map(year => (<option key={year.id} value={year.id}>{year.name} {year.isActive ? '(Active)' : ''}</option>))}
                                </select>
                              </div>
                              <div className="flex items-end gap-3">
                                <label className="flex items-center gap-1.5 cursor-pointer pb-1.5">
                                  <input type="checkbox" checked={newLesson.isExamDay} onChange={(e) => setNewLesson(prev => ({ ...prev, isExamDay: e.target.checked }))} className="h-4 w-4" />
                                  <span className="text-xs">Exam Day</span>
                                </label>
                                <Button size="sm" className="h-8 px-4 text-xs" onClick={handleAddLesson}>Create Lesson</Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {filteredLessons.map((lesson, index) => (
                        <SortableRow
                          key={lesson.id}
                          lesson={lesson}
                          index={index}
                          canEdit={!!canEdit}
                          canDrag={!!canEdit && !filtersActive}
                          sections={sections}
                          edits={editedLessons.get(lesson.id)}
                          onEdit={handleEdit}
                          onEditResources={handleEditResources}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onToggleExpand={handleToggleExpand}
                          isExpanded={expandedIds.has(lesson.id)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>

              {filteredLessons.length === 0 && !showAddRow && (
                <div className="text-center py-8 text-gray-500">No lessons found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile: Card Layout */}
        <div className="md:hidden space-y-3">
          {reordering && (
            <Card className="bg-gray-50 border-gray-200 sticky top-0 z-10">
              <CardContent className="p-3 flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Reordering...</span>
              </CardContent>
            </Card>
          )}
          {canEdit && hasUnsavedChanges && (
            <Card className="bg-amber-50 border-amber-200 sticky top-0 z-10">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-amber-700 font-medium">
                  {editedLessons.size} unsaved change{editedLessons.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDiscardChanges}>Discard</Button>
                  <Button size="sm" onClick={handleSaveAll} disabled={saving}>{saving ? 'Saving...' : 'Save All'}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {canEdit && showAddRow && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Add New Lesson</h3>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAddRow(false)}>✕ Cancel</Button>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Topic *</label>
                  <Input value={newLesson.title} onChange={(e) => setNewLesson(prev => ({ ...prev, title: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Topic title" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Speaker</label>
                  <Input value={newLesson.speaker} onChange={(e) => setNewLesson(prev => ({ ...prev, speaker: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Speaker name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Date *</label>
                  <Input type="date" value={newLesson.scheduledDate} onChange={(e) => setNewLesson(prev => ({ ...prev, scheduledDate: e.target.value }))} className="h-8 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Section</label>
                  <select value={newLesson.examSectionId} onChange={(e) => setNewLesson(prev => ({ ...prev, examSectionId: e.target.value }))} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600">
                    {sections.map(section => (<option key={section.id} value={section.id}>{section.displayName}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Academic Year</label>
                  <select value={formAcademicYearId} onChange={(e) => setFormAcademicYearId(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600">
                    {academicYears.map(year => (<option key={year.id} value={year.id}>{year.name} {year.isActive ? '(Active)' : ''}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Subtitle</label>
                  <Input value={newLesson.subtitle} onChange={(e) => setNewLesson(prev => ({ ...prev, subtitle: e.target.value }))} className="h-8 text-sm mt-0.5" placeholder="Subtitle (optional)" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Description</label>
                  <Textarea value={newLesson.description} onChange={(e) => setNewLesson(prev => ({ ...prev, description: e.target.value }))} className="text-sm mt-0.5 min-h-[60px]" placeholder="Description (optional)" />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={newLesson.isExamDay} onChange={(e) => setNewLesson(prev => ({ ...prev, isExamDay: e.target.checked }))} className="h-4 w-4" />
                  <span className="text-xs">Exam Day</span>
                </label>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={handleAddLesson}>Create Lesson</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowAddRow(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredLessons.length === 0 && !showAddRow ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">No lessons found</CardContent>
            </Card>
          ) : (
            filteredLessons.map((lesson, index) => (
              <MobileLessonCard
                key={lesson.id}
                lesson={lesson}
                index={index}
                totalCount={filteredLessons.length}
                canEdit={!!canEdit}
                canReorder={!filtersActive}
                isReordering={reordering}
                sections={sections}
                edits={editedLessons.get(lesson.id)}
                onEdit={handleEdit}
                onEditResources={handleEditResources}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onMoveUp={(id) => handleMobileMove(id, 'up')}
                onMoveDown={(id) => handleMobileMove(id, 'down')}
                isExpanded={expandedIds.has(lesson.id)}
                onToggleExpand={handleToggleExpand}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
