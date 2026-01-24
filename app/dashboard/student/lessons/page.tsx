'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDateUTC } from '@/lib/utils'
import {
  extractGoogleDriveFileId,
  getGoogleDriveThumbnail,
  getGoogleDriveFileIcon,
  isGoogleDriveLink,
  extractDomain,
  getTitleFromUrl
} from '@/lib/link-metadata'
import { Check, Clock, X, Shield, Calendar, BookOpen, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

interface LessonResource {
  id: string
  title: string
  url: string
  type: string | null
}

interface Lesson {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  scheduledDate: string
  lessonNumber: number
  status: string
  examSection: {
    id: string
    name: string
    displayName: string
  }
  academicYear: {
    id: string
    name: string
    isActive: boolean
  }
  resources: LessonResource[]
  attendance: {
    id: string
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
    arrivedAt: string | null
    notes: string | null
  } | null
}

export default function StudentLessonsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [filterAttendance, setFilterAttendance] = useState<string>('all')
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'STUDENT') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const fetchLessons = async () => {
      if (!session?.user?.id) return

      try {
        const res = await fetch(`/api/students/${session.user.id}/lessons`)
        if (res.ok) {
          const data = await res.json()
          setLessons(data)
        }
      } catch (error) {
        console.error('Failed to fetch lessons:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchLessons()
    }
  }, [session?.user?.id])

  // Get unique sections for filter
  const sections = Array.from(new Set(lessons.map(l => l.examSection.displayName)))

  // Filter lessons
  const filteredLessons = lessons.filter(lesson => {
    if (searchTerm && !lesson.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !lesson.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    if (filterSection !== 'all' && lesson.examSection.displayName !== filterSection) {
      return false
    }

    if (filterAttendance !== 'all') {
      if (filterAttendance === 'present' && lesson.attendance?.status !== 'PRESENT') return false
      if (filterAttendance === 'absent' && (!lesson.attendance || lesson.attendance.status === 'ABSENT')) return false
      if (filterAttendance === 'late' && lesson.attendance?.status !== 'LATE') return false
    }

    return true
  })

  const getAttendanceIcon = (attendance: Lesson['attendance']) => {
    if (!attendance) return <X className="h-4 w-4 text-gray-400" />

    switch (attendance.status) {
      case 'PRESENT':
        return <Check className="h-4 w-4 text-green-600" />
      case 'LATE':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'ABSENT':
        return <X className="h-4 w-4 text-red-600" />
      case 'EXCUSED':
        return <Shield className="h-4 w-4 text-blue-600" />
    }
  }

  const getAttendanceBadge = (attendance: Lesson['attendance']) => {
    if (!attendance) return <Badge variant="outline" className="text-xs">No Record</Badge>

    switch (attendance.status) {
      case 'PRESENT':
        return <Badge className="bg-green-100 text-green-800 text-xs">Present</Badge>
      case 'LATE':
        return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Late</Badge>
      case 'ABSENT':
        return <Badge className="bg-red-100 text-red-800 text-xs">Absent</Badge>
      case 'EXCUSED':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Excused</Badge>
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold dark:text-white">My Lessons</h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            View your lessons, resources, and attendance
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search lessons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 sm:h-10 text-xs sm:text-sm w-full sm:max-w-xs"
              />
              <select
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">All Sections</option>
                {sections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
              <select
                className="h-8 sm:h-10 px-2 sm:px-3 rounded-md border border-input bg-background text-xs sm:text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600"
                value={filterAttendance}
                onChange={(e) => setFilterAttendance(e.target.value)}
              >
                <option value="all">All Attendance</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Lessons</div>
              <div className="text-xl sm:text-2xl font-bold dark:text-white">{lessons.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Present</div>
              <div className="text-xl sm:text-2xl font-bold text-green-700">
                {lessons.filter(l => l.attendance?.status === 'PRESENT').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Late</div>
              <div className="text-xl sm:text-2xl font-bold text-yellow-700">
                {lessons.filter(l => l.attendance?.status === 'LATE').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Absent</div>
              <div className="text-xl sm:text-2xl font-bold text-red-700">
                {lessons.filter(l => l.attendance?.status === 'ABSENT').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lessons List */}
        <div className="space-y-2 sm:space-y-3">
          {filteredLessons.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                No lessons found
              </CardContent>
            </Card>
          ) : (
            filteredLessons.map(lesson => {
              const isExpanded = expandedLesson === lesson.id

              return (
                <Card key={lesson.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Lesson Header - Always Visible */}
                    <button
                      onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                      className="w-full p-3 sm:p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        {/* Attendance Icon */}
                        <div className="shrink-0 mt-1">
                          {getAttendanceIcon(lesson.attendance)}
                        </div>

                        {/* Lesson Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-sm sm:text-base dark:text-white">
                                  L{lesson.lessonNumber}: {lesson.title}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                  {lesson.examSection.displayName}
                                </Badge>
                              </div>
                              {lesson.subtitle && (
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {lesson.subtitle}
                                </p>
                              )}
                              <div className="flex items-center gap-2 sm:gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDateUTC(lesson.scheduledDate, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                                {lesson.resources.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {lesson.resources.length} resource{lesson.resources.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Attendance Badge & Expand Icon */}
                            <div className="flex items-center gap-2 shrink-0">
                              {getAttendanceBadge(lesson.attendance)}
                              {isExpanded ?
                                <ChevronDown className="h-4 w-4 text-gray-400" /> :
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t dark:border-gray-700 p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-800/50">
                        {/* Description */}
                        {lesson.description && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 dark:text-white">Description</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {lesson.description}
                            </p>
                          </div>
                        )}

                        {/* Resources */}
                        {lesson.resources.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 dark:text-white">Resources</h4>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {lesson.resources.map(resource => {
                                const isDrive = isGoogleDriveLink(resource.url)
                                const fileId = isDrive ? extractGoogleDriveFileId(resource.url) : null
                                const icon = isDrive ? getGoogleDriveFileIcon(resource.url) : '🔗'

                                return (
                                  <a
                                    key={resource.id}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm transition-all group"
                                  >
                                    {/* Thumbnail or Icon */}
                                    {isDrive && fileId ? (
                                      <div className="shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                        <img
                                          src={getGoogleDriveThumbnail(fileId)}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            // Fallback to icon if thumbnail fails
                                            e.currentTarget.style.display = 'none'
                                            e.currentTarget.parentElement!.innerHTML = `<span class="text-2xl">${icon}</span>`
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="shrink-0 w-12 h-12 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">
                                        {icon}
                                      </div>
                                    )}

                                    {/* Resource Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                        {resource.title}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {isDrive ? 'Google Drive' : extractDomain(resource.url)}
                                      </div>
                                    </div>

                                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Attendance Notes */}
                        {lesson.attendance?.notes && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 dark:text-white">Attendance Notes</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                              {lesson.attendance.notes}
                            </p>
                          </div>
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
