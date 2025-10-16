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

interface Lesson {
  id: string
  title: string
  subtitle?: string
  description: string
  scheduledDate: string
  lessonNumber: number
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  cancellationReason?: string
  examSection: {
    id: string
    displayName: string
    name: string
  }
  _count: {
    attendanceRecords: number
  }
}

interface Section {
  id: string
  name: string
  displayName: string
}

export default function CurriculumPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [academicYearId, setAcademicYearId] = useState<string>('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Form state for add/edit
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    description: '',
    scheduledDate: '',
    examSectionId: '',
    status: 'SCHEDULED' as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    cancellationReason: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch academic year
        const yearsRes = await fetch('/api/academic-years')
        if (!yearsRes.ok) throw new Error('Failed to fetch years')
        const years = await yearsRes.json()
        const activeYear = Array.isArray(years) ? years.find((y: any) => y.isActive) : null

        if (activeYear) {
          setAcademicYearId(activeYear.id)

          // Fetch lessons
          const lessonsRes = await fetch(`/api/lessons?academicYearId=${activeYear.id}`)
          if (!lessonsRes.ok) {
            const errorData = await lessonsRes.json()
            throw new Error(errorData.error || 'Failed to fetch lessons')
          }
          const lessonsData = await lessonsRes.json()
          setLessons(Array.isArray(lessonsData) ? lessonsData : [])
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
        console.error('Failed to fetch data:', error)
        setLessons([])
        setSections([])
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [session])

  const handleEdit = (lesson: Lesson) => {
    setEditingId(lesson.id)
    setFormData({
      title: lesson.title,
      subtitle: lesson.subtitle || '',
      description: lesson.description,
      scheduledDate: new Date(lesson.scheduledDate).toISOString().slice(0, 16),
      examSectionId: lesson.examSection.id,
      status: lesson.status,
      cancellationReason: lesson.cancellationReason || ''
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
          cancellationReason: formData.status === 'CANCELLED' ? formData.cancellationReason : null
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
          academicYearId,
          lessonNumber: nextLessonNumber,
          status: 'SCHEDULED'
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
          cancellationReason: ''
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
          !lesson.description.toLowerCase().includes(searchTerm.toLowerCase())) {
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
          <Card className="bg-blue-50 border-blue-200">
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
                <div></div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Description</label>
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
                    cancellationReason: ''
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

                    return (
                      <tr key={lesson.id} className={`border-b hover:bg-gray-50 ${isPast ? 'opacity-60' : ''}`}>
                        <td className="p-2 text-gray-500">{index + 1}</td>
                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              type="datetime-local"
                              value={formData.scheduledDate}
                              onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                              className="w-full text-xs"
                            />
                          ) : (
                            <div>
                              <div className="font-medium">
                                {new Date(lesson.scheduledDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(lesson.scheduledDate).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                              className="w-full"
                            />
                          ) : (
                            <div className="font-medium">{lesson.title}</div>
                          )}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <Input
                              value={formData.subtitle}
                              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                              className="w-full"
                              placeholder="Optional"
                            />
                          ) : (
                            <div className="text-sm text-gray-600">{lesson.subtitle || '—'}</div>
                          )}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <Textarea
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              className="w-full text-sm"
                              rows={2}
                            />
                          ) : (
                            <div className="text-sm text-gray-600 max-w-md truncate">
                              {lesson.description}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {isEditing ? (
                            <select
                              value={formData.examSectionId}
                              onChange={(e) => setFormData({ ...formData, examSectionId: e.target.value })}
                              className="w-full h-8 rounded-md border text-xs px-2"
                            >
                              {sections.map(section => (
                                <option key={section.id} value={section.id}>
                                  {section.displayName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant="outline">{lesson.examSection.displayName}</Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {isEditing ? (
                            <select
                              value={formData.status}
                              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                              className="w-full h-8 rounded-md border text-xs px-2"
                            >
                              <option value="SCHEDULED">Scheduled</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          ) : (
                            <Badge
                              className={
                                lesson.status === 'COMPLETED' ? 'bg-green-500' :
                                lesson.status === 'CANCELLED' ? 'bg-red-500' :
                                'bg-blue-500'
                              }
                            >
                              {lesson.status}
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-gray-600">{lesson._count?.attendanceRecords || 0}</span>
                        </td>
                        {canEdit && (
                          <td className="p-2">
                            <div className="flex gap-1 justify-center">
                              {isEditing ? (
                                <>
                                  <Button size="sm" onClick={() => handleSave(lesson.id)}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
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
                              'bg-blue-500'
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
                          {new Date(lesson.scheduledDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {' at '}
                          {new Date(lesson.scheduledDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      {isEditing ? (
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-gray-600">{lesson.description}</p>
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
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full h-10 rounded-md border px-3"
                          >
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Attendance Count */}
                    {!isEditing && (
                      <div className="pt-2 border-t flex items-center justify-between">
                        <span className="text-sm text-gray-600">Attendance</span>
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
