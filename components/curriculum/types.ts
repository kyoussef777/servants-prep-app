export interface LessonResource {
  id: string
  title: string
  url: string
  type?: string
}

export interface Lesson {
  id: string
  title: string
  subtitle?: string
  description?: string
  speaker?: string
  scheduledDate: string
  lessonNumber: number
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_CLASS'
  cancellationReason?: string
  isExamDay: boolean
  examSection: {
    id: string
    displayName: string
    name: string
  }
  academicYear?: {
    id: string
    name: string
  }
  resources: LessonResource[]
  _count: {
    attendanceRecords: number
  }
}

export interface Section {
  id: string
  name: string
  displayName: string
}

export interface LessonEdits {
  title?: string
  speaker?: string
  examSectionId?: string
  isExamDay?: boolean
  scheduledDate?: string
  status?: string
  subtitle?: string
  description?: string
  cancellationReason?: string
  resources?: { title: string; url: string }[]
}
