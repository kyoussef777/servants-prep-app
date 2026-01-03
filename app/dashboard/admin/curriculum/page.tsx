'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isAdmin } from '@/lib/roles'
import { toast } from 'sonner'
import { formatDateUTC } from '@/lib/utils'

interface LessonResource {
  id: string
  title: string
  url: string
  type?: string
}

interface Lesson {
  id: string
  title: string
  subtitle?: string
  description?: string
  scheduledDate: string
  lessonNumber: number
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  cancellationReason?: string
  isExamDay: boolean
  examSection: {
    id: string
    displayName: string
    name: string
  }
  resources: LessonResource[]
  _count: {
    attendanceRecords: number
  }
}

interface Section {
  id: string
  name: string
  displayName: string
}

interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

export default function CurriculumPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formAcademicYearId, setFormAcademicYearId] = useState<string>('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    scheduledDate: '',
    examSectionId: '',
    status: 'SCHEDULED' as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    cancellationReason: '',
    isExamDay: false,
    resources: [] as { title: string; url: string; type?: string }[]
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Fetch academic years and sections on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch academic years
        const yearsRes = await fetch('/api/academic-years')
        if (!yearsRes.ok) throw new Error('Failed to fetch years')
        const years = await yearsRes.json()
        const yearsArray = Array.isArray(years) ? years : []
        setAcademicYears(yearsArray)

        // Default to active year for filtering, but show "all" initially
        const activeYear = yearsArray.find((y: AcademicYear) => y.isActive)
        if (activeYear) {
          setSelectedYearId('all') // Show all years by default
          setFormAcademicYearId(activeYear.id) // Default new lessons to active year
        }

        // Fetch sections
        const sectionsRes = await fetch('/api/exam-sections')
        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json()
          setSections(Array.isArray(sectionsData) ? sectionsData : [])
          if (sectionsData.length > 0) {
            setFormData(prev => ({ ...prev, examSectionId: sectionsData[0].id }))
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

  const handleEdit = (lesson: Lesson) => {
    setEditingId(lesson.id)
    // Fix timezone issue: Keep the date in local timezone instead of converting to UTC
    const localDate = new Date(lesson.scheduledDate)
    const year = localDate.getFullYear()
    const month = String(localDate.getMonth() + 1).padStart(2, '0')
    const day = String(localDate.getDate()).padStart(2, '0')
    const hours = String(localDate.getHours()).padStart(2, '0')
    const minutes = String(localDate.getMinutes()).padStart(2, '0')
    const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`

    setFormData({
      title: lesson.title,
      subtitle: lesson.subtitle || '',
      description: lesson.description || '',
      scheduledDate: formattedDate,
      examSectionId: lesson.examSection.id,
      status: lesson.status,
      cancellationReason: lesson.cancellationReason || '',
      isExamDay: lesson.isExamDay || false,
      resources: lesson.resources?.map(r => ({ title: r.title, url: r.url, type: r.type })) || []
    })
  }

  const handleSave = async (lessonId: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          subtitle: formData.subtitle || null,
          description: formData.description,
          scheduledDate: new Date(formData.scheduledDate).toISOString(),
          examSectionId: formData.examSectionId,
          status: formData.status,
          cancellationReason: formData.status === 'CANCELLED' ? formData.cancellationReason : null,
          isExamDay: formData.isExamDay,
          resources: formData.resources.filter(r => r.title && r.url)
        })
      })

      if (res.ok) {
        const updated = await res.json()
        setLessons(lessons.map(l => l.id === lessonId ? updated : l))
        setEditingId(null)
        const now = new Date()
        setLastSaved(now)
        toast.success('Lesson updated successfully!', {
          description: now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        })
      } else {
        toast.error('Failed to update lesson')
      }
    } catch (error) {
      console.error('Failed to update lesson:', error)
      toast.error('Failed to update lesson')
    }
  }

  const handleAdd = async () => {
    if (!formAcademicYearId) {
      toast.error('Please select an academic year')
      return
    }

    try {
      const nextLessonNumber = lessons.length > 0
        ? Math.max(...lessons.map(l => l.lessonNumber)) + 1
        : 1

      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          subtitle: formData.subtitle || null,
          description: formData.description,
          scheduledDate: new Date(formData.scheduledDate).toISOString(),
          examSectionId: formData.examSectionId,
          academicYearId: formAcademicYearId,
          lessonNumber: nextLessonNumber,
          status: 'SCHEDULED',
          isExamDay: formData.isExamDay,
          resources: formData.resources.filter(r => r.title && r.url)
        })
      })

      if (res.ok) {
        const newLesson = await res.json()
        setLessons([...lessons, newLesson])
        setShowAddForm(false)
        setFormData({
          title: '',
          subtitle: '',
          description: '',
          scheduledDate: '',
          examSectionId: sections[0]?.id || '',
          status: 'SCHEDULED',
          cancellationReason: '',
          isExamDay: false,
          resources: []
        })
        const now = new Date()
        setLastSaved(now)
        toast.success('Lesson created successfully!', {
          description: now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        })
      } else {
        toast.error('Failed to create lesson')
      }
    } catch (error) {
      console.error('Failed to create lesson:', error)
      toast.error('Failed to create lesson')
    }
  }

  const handleDelete = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return

    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setLessons(lessons.filter(l => l.id !== lessonId))
        const now = new Date()
        setLastSaved(now)
        toast.success('Lesson deleted successfully!', {
          description: now.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        })
      } else {
        toast.error('Failed to delete lesson')
      }
    } catch (error) {
      console.error('Failed to delete lesson:', error)
      toast.error('Failed to delete lesson')
    }
  }

  const filteredLessons = lessons
    .filter(lesson => {
      if (searchTerm && !lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(lesson.description || '').toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      if (filterSection !== 'all' && lesson.examSection.name !== filterSection) {
        return false
      }
      return true
    })
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const canEdit = session?.user?.role && isAdmin(session.user.role)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Curriculum</h1>
            <p className="text-sm text-gray-600">Manage lesson schedule and curriculum</p>
            {lastSaved && (
              <p className="text-xs text-gray-500 mt-1">
                Last saved {lastSaved.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
          {canEdit && (
            <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
              + Add Lesson
            </Button>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && canEdit && (
          <Card className="bg-maroon-50 border-maroon-200">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Lesson title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Subtitle (optional)</label>
                  <Input
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="Lesson subtitle"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Date & Time</label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Academic Year</label>
                  <select
                    value={formAcademicYearId}
                    onChange={(e) => setFormAcademicYearId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {academicYears.map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Speaker, topic details, etc."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Section</label>
                  <select
                    value={formData.examSectionId}
                    onChange={(e) => setFormData({ ...formData, examSectionId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isExamDay"
                    checked={formData.isExamDay}
                    onChange={(e) => setFormData({ ...formData, isExamDay: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="isExamDay" className="text-sm font-medium cursor-pointer">
                    Exam Day (attendance not counted)
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Resources (optional)</label>
                  <div className="space-y-2 mt-1">
                    {formData.resources.map((resource, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder="Title (e.g., PowerPoint)"
                          value={resource.title}
                          onChange={(e) => {
                            const newResources = [...formData.resources]
                            newResources[idx] = { ...newResources[idx], title: e.target.value }
                            setFormData({ ...formData, resources: newResources })
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="URL"
                          value={resource.url}
                          onChange={(e) => {
                            const newResources = [...formData.resources]
                            newResources[idx] = { ...newResources[idx], url: e.target.value }
                            setFormData({ ...formData, resources: newResources })
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newResources = formData.resources.filter((_, i) => i !== idx)
                            setFormData({ ...formData, resources: newResources })
                          }}
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({
                        ...formData,
                        resources: [...formData.resources, { title: '', url: '' }]
                      })}
                    >
                      + Add Resource
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleAdd}>Create Lesson</Button>
                <Button variant="outline" onClick={() => {
                  setShowAddForm(false)
                  setFormData({
                    title: '',
                    subtitle: '',
                    description: '',
                    scheduledDate: '',
                    examSectionId: sections[0]?.id || '',
                    status: 'SCHEDULED',
                    cancellationReason: '',
                    isExamDay: false,
                    resources: []
                  })
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <Input
                type="text"
                placeholder="Search lessons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Sections</option>
                {sections.map(section => (
                  <option key={section.id} value={section.name}>
                    {section.displayName}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Lessons Table - Desktop */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2 w-32">Date</th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Subtitle</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-center p-2 w-32">Section</th>
                    <th className="text-center p-2 w-24">Status</th>
                    <th className="text-center p-2 w-24">Attendance</th>
                    {canEdit && <th className="text-center p-2 w-48">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredLessons.map((lesson, index) => {
                    const isEditing = editingId === lesson.id
                    const isPast = new Date(lesson.scheduledDate) < new Date()

                    if (isEditing) {
                      // Expanded edit mode - spans all columns
                      return (
                        <tr key={lesson.id} className="border-b bg-blue-50">
                          <td colSpan={canEdit ? 9 : 8} className="p-4">
                            <div className="space-y-4">
                              {/* Row 1: Basic Info */}
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Title</label>
                                  <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Subtitle</label>
                                  <Input
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                    placeholder="Optional"
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Date & Time</label>
                                  <Input
                                    type="datetime-local"
                                    value={formData.scheduledDate}
                                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Section</label>
                                  <select
                                    value={formData.examSectionId}
                                    onChange={(e) => setFormData({ ...formData, examSectionId: e.target.value })}
                                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  >
                                    {sections.map(section => (
                                      <option key={section.id} value={section.id}>
                                        {section.displayName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Row 2: Description */}
                              <div>
                                <label className="text-sm font-medium text-gray-700">Description</label>
                                <Textarea
                                  value={formData.description}
                                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                  placeholder="Speaker, topic details, etc."
                                  rows={2}
                                  className="mt-1"
                                />
                              </div>

                              {/* Row 3: Status & Options */}
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Status</label>
                                  <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' })}
                                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  >
                                    <option value="SCHEDULED">Scheduled</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                  </select>
                                </div>
                                {formData.status === 'CANCELLED' && (
                                  <div className="col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Cancellation Reason</label>
                                    <Input
                                      value={formData.cancellationReason}
                                      onChange={(e) => setFormData({ ...formData, cancellationReason: e.target.value })}
                                      placeholder="Reason for cancellation"
                                      className="mt-1"
                                    />
                                  </div>
                                )}
                                <div className="flex items-end">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={formData.isExamDay}
                                      onChange={(e) => setFormData({ ...formData, isExamDay: e.target.checked })}
                                      className="h-4 w-4"
                                    />
                                    <span className="text-sm font-medium">Exam Day (no attendance)</span>
                                  </label>
                                </div>
                              </div>

                              {/* Row 4: Resources */}
                              <div>
                                <label className="text-sm font-medium text-gray-700">Resources</label>
                                <div className="space-y-2 mt-1">
                                  {formData.resources.map((resource, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                      <Input
                                        placeholder="Title (e.g., PowerPoint)"
                                        value={resource.title}
                                        onChange={(e) => {
                                          const newResources = [...formData.resources]
                                          newResources[idx] = { ...newResources[idx], title: e.target.value }
                                          setFormData({ ...formData, resources: newResources })
                                        }}
                                        className="flex-1"
                                      />
                                      <Input
                                        placeholder="URL"
                                        value={resource.url}
                                        onChange={(e) => {
                                          const newResources = [...formData.resources]
                                          newResources[idx] = { ...newResources[idx], url: e.target.value }
                                          setFormData({ ...formData, resources: newResources })
                                        }}
                                        className="flex-1"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const newResources = formData.resources.filter((_, i) => i !== idx)
                                          setFormData({ ...formData, resources: newResources })
                                        }}
                                        className="text-red-600"
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFormData({
                                      ...formData,
                                      resources: [...formData.resources, { title: '', url: '' }]
                                    })}
                                  >
                                    + Add Resource
                                  </Button>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-2 border-t">
                                <Button onClick={() => handleSave(lesson.id)}>
                                  Save Changes
                                </Button>
                                <Button variant="outline" onClick={() => setEditingId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    // Normal view mode row
                    return (
                      <tr key={lesson.id} className={`border-b hover:bg-gray-50 ${isPast ? 'opacity-60' : ''}`}>
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2">
                          <div>
                            <div className="font-medium">
                              {formatDateUTC(lesson.scheduledDate, {
                                weekday: undefined,
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="font-medium">
                            {lesson.title}
                            {lesson.isExamDay && (
                              <Badge variant="outline" className="ml-2 text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                Exam Day
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm text-gray-600">{lesson.subtitle || '—'}</div>
                        </td>
                        <td className="p-2">
                          <div className="text-sm text-gray-600 max-w-md truncate">
                            {lesson.description || '—'}
                          </div>
                          {lesson.resources && lesson.resources.length > 0 && (
                            <div className="flex gap-2 mt-1">
                              {lesson.resources.map((r, idx) => (
                                <a
                                  key={idx}
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {r.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant="outline">{lesson.examSection.displayName}</Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge
                            className={
                              lesson.status === 'COMPLETED' ? 'bg-green-500' :
                              lesson.status === 'CANCELLED' ? 'bg-red-500' :
                              'bg-maroon-500'
                            }
                          >
                            {lesson.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-gray-600">{lesson._count?.attendanceRecords || 0}</span>
                        </td>
                        {canEdit && (
                          <td className="p-2">
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(lesson)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(lesson.id)}
                                disabled={(lesson._count?.attendanceRecords || 0) > 0}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {filteredLessons.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No lessons found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {filteredLessons.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No lessons found
              </CardContent>
            </Card>
          ) : (
            filteredLessons.map((lesson, index) => {
              const isEditing = editingId === lesson.id
              const isPast = new Date(lesson.scheduledDate) < new Date()

              return (
                <Card key={lesson.id} className={isPast ? 'opacity-60' : ''}>
                  <CardContent className="p-4 space-y-3">
                    {/* Lesson Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-500">#{index + 1}</span>
                          <Badge
                            className={
                              lesson.status === 'COMPLETED' ? 'bg-green-500' :
                              lesson.status === 'CANCELLED' ? 'bg-red-500' :
                              'bg-maroon-500'
                            }
                          >
                            {lesson.status}
                          </Badge>
                        </div>
                        <h3 className="font-semibold">{isEditing ? (
                          <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="mt-1"
                            placeholder="Lesson title"
                          />
                        ) : lesson.title}</h3>
                        {!isEditing && lesson.subtitle && (
                          <p className="text-sm text-gray-600 mt-1">{lesson.subtitle}</p>
                        )}
                        {isEditing && (
                          <Input
                            value={formData.subtitle}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            className="mt-1"
                            placeholder="Subtitle (optional)"
                          />
                        )}
                      </div>
                      <Badge variant="outline">{lesson.examSection.displayName}</Badge>
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Date & Time</label>
                      {isEditing ? (
                        <Input
                          type="datetime-local"
                          value={formData.scheduledDate}
                          onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                          className="w-full"
                        />
                      ) : (
                        <div className="text-sm">
                          {formatDateUTC(lesson.scheduledDate, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Description (optional)</label>
                      {isEditing ? (
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-gray-600">{lesson.description || '—'}</p>
                      )}
                    </div>

                    {/* Section & Status (only in edit mode) */}
                    {isEditing && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Section</label>
                          <select
                            value={formData.examSectionId}
                            onChange={(e) => setFormData({ ...formData, examSectionId: e.target.value })}
                            className="w-full h-10 rounded-md border px-3"
                          >
                            {sections.map(section => (
                              <option key={section.id} value={section.id}>
                                {section.displayName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Status</label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' })}
                            className="w-full h-10 rounded-md border px-3"
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="isExamDayMobile"
                            checked={formData.isExamDay}
                            onChange={(e) => setFormData({ ...formData, isExamDay: e.target.checked })}
                            className="h-4 w-4"
                          />
                          <label htmlFor="isExamDayMobile" className="text-sm font-medium cursor-pointer">
                            Exam Day (attendance not counted)
                          </label>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Resources</label>
                          <div className="space-y-2">
                            {formData.resources.map((resource, idx) => (
                              <div key={idx} className="space-y-2 p-2 bg-gray-50 rounded">
                                <Input
                                  placeholder="Title (e.g., PowerPoint)"
                                  value={resource.title}
                                  onChange={(e) => {
                                    const newResources = [...formData.resources]
                                    newResources[idx] = { ...newResources[idx], title: e.target.value }
                                    setFormData({ ...formData, resources: newResources })
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="URL"
                                    value={resource.url}
                                    onChange={(e) => {
                                      const newResources = [...formData.resources]
                                      newResources[idx] = { ...newResources[idx], url: e.target.value }
                                      setFormData({ ...formData, resources: newResources })
                                    }}
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newResources = formData.resources.filter((_, i) => i !== idx)
                                      setFormData({ ...formData, resources: newResources })
                                    }}
                                    className="text-red-600"
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setFormData({
                                ...formData,
                                resources: [...formData.resources, { title: '', url: '' }]
                              })}
                            >
                              + Add Resource
                            </Button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Resources in view mode */}
                    {!isEditing && lesson.resources && lesson.resources.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-gray-700">Resources</span>
                        <div className="flex flex-wrap gap-2">
                          {lesson.resources.map((r, idx) => (
                            <a
                              key={idx}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {r.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attendance Count & Exam Day badge */}
                    {!isEditing && (
                      <div className="pt-2 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Attendance</span>
                          {lesson.isExamDay && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                              Exam Day
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline">{lesson._count?.attendanceRecords || 0} students</Badge>
                      </div>
                    )}

                    {/* Actions */}
                    {canEdit && (
                      <div className="flex gap-2 pt-2 border-t">
                        {isEditing ? (
                          <>
                            <Button onClick={() => handleSave(lesson.id)} className="flex-1">
                              Save Changes
                            </Button>
                            <Button variant="outline" onClick={() => setEditingId(null)} className="flex-1">
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" onClick={() => handleEdit(lesson)} className="flex-1">
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleDelete(lesson.id)}
                              disabled={(lesson._count?.attendanceRecords || 0) > 0}
                              className="flex-1"
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
