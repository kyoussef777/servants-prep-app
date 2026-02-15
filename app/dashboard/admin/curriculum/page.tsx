'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { canManageCurriculum } from '@/lib/roles'
import { toast } from 'sonner'
import { formatDateUTC } from '@/lib/utils'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  speaker?: string
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
  academicYear?: {
    id: string
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

// Track edits per lesson
interface LessonEdits {
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

// ─── Editable Expanded Details (shared by desktop and mobile) ───────────────

function ExpandedEditableDetails({
  lesson,
  edits,
  onEdit,
  onEditResources,
}: {
  lesson: Lesson
  edits: LessonEdits | undefined
  onEdit: (id: string, field: keyof LessonEdits, value: string | boolean) => void
  onEditResources: (id: string, resources: { title: string; url: string }[]) => void
}) {
  const currentSubtitle = edits?.subtitle ?? lesson.subtitle ?? ''
  const currentDescription = edits?.description ?? lesson.description ?? ''
  const currentCancellationReason = edits?.cancellationReason ?? lesson.cancellationReason ?? ''
  const currentStatus = (edits?.status ?? lesson.status) as Lesson['status']
  const currentResources: { title: string; url: string }[] = edits?.resources ?? lesson.resources.map(r => ({ title: r.title, url: r.url }))

  const handleResourceChange = (idx: number, field: 'title' | 'url', value: string) => {
    const updated = [...currentResources]
    updated[idx] = { ...updated[idx], [field]: value }
    onEditResources(lesson.id, updated)
  }

  const handleRemoveResource = (idx: number) => {
    const updated = currentResources.filter((_, i) => i !== idx)
    onEditResources(lesson.id, updated)
  }

  const handleAddResource = () => {
    onEditResources(lesson.id, [...currentResources, { title: '', url: '' }])
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      {/* Subtitle */}
      <div>
        <label className="text-xs font-medium text-gray-500">Subtitle</label>
        <Input
          value={currentSubtitle}
          onChange={(e) => onEdit(lesson.id, 'subtitle', e.target.value)}
          className="h-8 text-sm mt-0.5"
          placeholder="Subtitle (optional)"
        />
      </div>

      {/* Cancellation reason - only when CANCELLED */}
      {currentStatus === 'CANCELLED' && (
        <div>
          <label className="text-xs font-medium text-gray-500">Cancellation Reason</label>
          <Textarea
            value={currentCancellationReason}
            onChange={(e) => onEdit(lesson.id, 'cancellationReason', e.target.value)}
            className="text-sm mt-0.5 min-h-[60px]"
            placeholder="Reason for cancellation"
          />
        </div>
      )}

      {/* Description */}
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-gray-500">Description</label>
        <Textarea
          value={currentDescription}
          onChange={(e) => onEdit(lesson.id, 'description', e.target.value)}
          className="text-sm mt-0.5 min-h-[80px]"
          placeholder="Lesson description (optional)"
        />
      </div>

      {/* Resources */}
      <div className="md:col-span-2">
        <label className="text-xs font-medium text-gray-500">Resources</label>
        <div className="space-y-2 mt-1">
          {currentResources.map((resource, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                value={resource.title}
                onChange={(e) => handleResourceChange(idx, 'title', e.target.value)}
                className="h-8 text-sm flex-1"
                placeholder="Resource title"
              />
              <Input
                value={resource.url}
                onChange={(e) => handleResourceChange(idx, 'url', e.target.value)}
                className="h-8 text-sm flex-[2]"
                placeholder="https://..."
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-red-600 hover:text-red-700 shrink-0"
                onClick={() => handleRemoveResource(idx)}
                title="Remove resource"
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleAddResource}
          >
            + Add Resource
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable Table Row ─────────────────────────────────────────────────────

function SortableRow({
  lesson,
  index,
  canEdit,
  canDrag,
  sections,
  edits,
  onEdit,
  onEditResources,
  onDelete,
  onDuplicate,
  onToggleExpand,
  isExpanded,
}: {
  lesson: Lesson
  index: number
  canEdit: boolean
  canDrag: boolean
  sections: Section[]
  edits: LessonEdits | undefined
  onEdit: (id: string, field: keyof LessonEdits, value: string | boolean) => void
  onEditResources: (id: string, resources: { title: string; url: string }[]) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onToggleExpand: (id: string) => void
  isExpanded: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id, disabled: !canDrag })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isPast = new Date(lesson.scheduledDate) < new Date()
  const currentTitle = edits?.title ?? lesson.title
  const currentSpeaker = edits?.speaker ?? lesson.speaker ?? ''
  const currentSectionId = edits?.examSectionId ?? lesson.examSection.id
  const currentIsExamDay = edits?.isExamDay ?? lesson.isExamDay
  const currentStatus = (edits?.status ?? lesson.status) as Lesson['status']
  const hasAttendance = (lesson._count?.attendanceRecords || 0) > 0

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-b hover:bg-gray-50 ${isPast ? 'opacity-60' : ''} ${isDragging ? 'bg-blue-50 shadow-lg' : ''}`}
      >
        {/* Drag handle */}
        {canEdit && (
          <td
            className={`p-1 w-8 text-center ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            {...(canDrag ? { ...attributes, ...listeners } : {})}
          >
            <span className={`select-none ${canDrag ? 'text-gray-400' : 'text-gray-200 dark:text-gray-700'}`}>⠿</span>
          </td>
        )}
        {/* Lesson # */}
        <td className="p-2 text-gray-500 w-8 text-center">{index + 1}</td>
        {/* Date */}
        <td className="p-2 w-32">
          {canEdit ? (
            <Input
              type="date"
              value={edits?.scheduledDate ?? lesson.scheduledDate.slice(0, 10)}
              onChange={(e) => onEdit(lesson.id, 'scheduledDate', e.target.value)}
              className="h-8 text-xs"
            />
          ) : (
            <span className="text-sm">
              {formatDateUTC(lesson.scheduledDate, {
                weekday: undefined,
                month: 'short',
                day: 'numeric',
                year: undefined,
              })}
            </span>
          )}
        </td>
        {/* Topic */}
        <td className="p-2">
          {canEdit ? (
            <Input
              value={currentTitle}
              onChange={(e) => onEdit(lesson.id, 'title', e.target.value)}
              className="h-8 text-sm"
              placeholder="Topic title"
            />
          ) : (
            <span className="text-sm font-medium">{currentTitle}</span>
          )}
        </td>
        {/* Speaker */}
        <td className="p-2">
          {canEdit ? (
            <Input
              value={currentSpeaker}
              onChange={(e) => onEdit(lesson.id, 'speaker', e.target.value)}
              className="h-8 text-sm"
              placeholder="Speaker name"
            />
          ) : (
            <span className="text-sm text-gray-600">{currentSpeaker || '—'}</span>
          )}
        </td>
        {/* Section */}
        <td className="p-2">
          {canEdit ? (
            <select
              value={currentSectionId}
              onChange={(e) => onEdit(lesson.id, 'examSectionId', e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs dark:bg-gray-800 dark:text-white dark:border-gray-600"
            >
              {sections.map(section => (
                <option key={section.id} value={section.id}>
                  {section.displayName}
                </option>
              ))}
            </select>
          ) : (
            <Badge variant="outline" className="text-xs">{lesson.examSection.displayName}</Badge>
          )}
        </td>
        {/* Exam Day */}
        <td className="p-2 text-center">
          {canEdit ? (
            <input
              type="checkbox"
              checked={currentIsExamDay}
              onChange={(e) => onEdit(lesson.id, 'isExamDay', e.target.checked)}
              className="h-4 w-4"
            />
          ) : (
            currentIsExamDay && (
              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                Exam
              </Badge>
            )
          )}
        </td>
        {/* Status + Attendance */}
        <td className="p-2 text-center">
          <div className="flex items-center justify-center gap-1">
            {canEdit ? (
              <select
                value={currentStatus}
                onChange={(e) => onEdit(lesson.id, 'status', e.target.value)}
                className={`h-7 rounded-md border px-1 text-xs font-medium ${
                  currentStatus === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700' :
                  currentStatus === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700' :
                  'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            ) : (
              <Badge
                className={`text-xs ${
                  currentStatus === 'COMPLETED' ? 'bg-green-500' :
                  currentStatus === 'CANCELLED' ? 'bg-red-500' :
                  'bg-maroon-600'
                }`}
              >
                {currentStatus}
              </Badge>
            )}
            {hasAttendance && (
              <span className="text-xs text-gray-500">{lesson._count.attendanceRecords}</span>
            )}
          </div>
        </td>
        {/* Actions */}
        <td className="p-2 text-center">
          <div className="flex gap-1 justify-center">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onToggleExpand(lesson.id)}
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? '▲' : '▼'}
            </Button>
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => onDuplicate(lesson.id)}
                  title="Duplicate lesson"
                >
                  ⧉
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                  onClick={() => onDelete(lesson.id)}
                  disabled={hasAttendance}
                  title={hasAttendance ? 'Cannot delete: has attendance records' : 'Delete lesson'}
                >
                  ✕
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="border-b bg-gray-50 dark:bg-gray-900/40">
          <td colSpan={canEdit ? 9 : 8} className="p-4">
            {canEdit ? (
              <ExpandedEditableDetails
                lesson={lesson}
                edits={edits}
                onEdit={onEdit}
                onEditResources={onEditResources}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Subtitle:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{lesson.subtitle || '—'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                  <span className="ml-2">{lesson.status}</span>
                  {lesson.cancellationReason && (
                    <span className="ml-1 text-gray-500">({lesson.cancellationReason})</span>
                  )}
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{lesson.description || '—'}</p>
                </div>
                {lesson.resources && lesson.resources.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Resources:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
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
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Mobile Card Row ────────────────────────────────────────────────────────

function MobileLessonCard({
  lesson,
  index,
  totalCount,
  canEdit,
  canReorder,
  isReordering,
  sections,
  edits,
  onEdit,
  onEditResources,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isExpanded,
  onToggleExpand,
}: {
  lesson: Lesson
  index: number
  totalCount: number
  canEdit: boolean
  canReorder: boolean
  isReordering: boolean
  sections: Section[]
  edits: LessonEdits | undefined
  onEdit: (id: string, field: keyof LessonEdits, value: string | boolean) => void
  onEditResources: (id: string, resources: { title: string; url: string }[]) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
}) {
  const isPast = new Date(lesson.scheduledDate) < new Date()
  const currentTitle = edits?.title ?? lesson.title
  const currentSpeaker = edits?.speaker ?? lesson.speaker ?? ''
  const currentSectionId = edits?.examSectionId ?? lesson.examSection.id
  const currentIsExamDay = edits?.isExamDay ?? lesson.isExamDay
  const currentStatus = (edits?.status ?? lesson.status) as Lesson['status']
  const hasAttendance = (lesson._count?.attendanceRecords || 0) > 0

  return (
    <Card className={isPast ? 'opacity-60' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500">#{index + 1}</span>
              {canEdit ? (
                <select
                  value={currentStatus}
                  onChange={(e) => onEdit(lesson.id, 'status', e.target.value)}
                  className={`h-6 rounded border px-1 text-xs font-medium ${
                    currentStatus === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700' :
                    currentStatus === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700' :
                    'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              ) : (
                <Badge
                  className={`text-xs ${
                    currentStatus === 'COMPLETED' ? 'bg-green-500' :
                    currentStatus === 'CANCELLED' ? 'bg-red-500' :
                    'bg-maroon-600'
                  }`}
                >
                  {currentStatus}
                </Badge>
              )}
              {currentIsExamDay && (
                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                  Exam Day
                </Badge>
              )}
            </div>
            {/* Date - editable in edit mode */}
            {canEdit ? (
              <Input
                type="date"
                value={edits?.scheduledDate ?? lesson.scheduledDate.slice(0, 10)}
                onChange={(e) => onEdit(lesson.id, 'scheduledDate', e.target.value)}
                className="h-7 text-xs mt-0.5 w-40"
              />
            ) : (
              <div className="text-xs text-gray-500 mb-1">
                {formatDateUTC(lesson.scheduledDate, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasAttendance && (
              <Badge variant="outline" className="text-xs">{lesson._count.attendanceRecords} att.</Badge>
            )}
            {canEdit && canReorder && (
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
                  onClick={() => onMoveUp(lesson.id)}
                  disabled={index === 0 || isReordering}
                >
                  ▲
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700"
                  onClick={() => onMoveDown(lesson.id)}
                  disabled={index === totalCount - 1 || isReordering}
                >
                  ▼
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Topic */}
        <div>
          <label className="text-xs font-medium text-gray-500">Topic</label>
          {canEdit ? (
            <Input
              value={currentTitle}
              onChange={(e) => onEdit(lesson.id, 'title', e.target.value)}
              className="h-8 text-sm mt-0.5"
              placeholder="Topic title"
            />
          ) : (
            <p className="text-sm font-medium">{currentTitle}</p>
          )}
        </div>

        {/* Speaker */}
        <div>
          <label className="text-xs font-medium text-gray-500">Speaker</label>
          {canEdit ? (
            <Input
              value={currentSpeaker}
              onChange={(e) => onEdit(lesson.id, 'speaker', e.target.value)}
              className="h-8 text-sm mt-0.5"
              placeholder="Speaker name"
            />
          ) : (
            <p className="text-sm text-gray-600">{currentSpeaker || '—'}</p>
          )}
        </div>

        {/* Section + Exam Day */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500">Section</label>
            {canEdit ? (
              <select
                value={currentSectionId}
                onChange={(e) => onEdit(lesson.id, 'examSectionId', e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600"
              >
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm"><Badge variant="outline" className="text-xs">{lesson.examSection.displayName}</Badge></p>
            )}
          </div>
          {canEdit && (
            <label className="flex items-center gap-1.5 cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={currentIsExamDay}
                onChange={(e) => onEdit(lesson.id, 'isExamDay', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs">Exam Day</span>
            </label>
          )}
        </div>

        {/* Expand/Collapse toggle */}
        <div className="pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-gray-500 hover:text-gray-700 h-7"
            onClick={() => onToggleExpand(lesson.id)}
          >
            {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
          </Button>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="pt-2 border-t space-y-3">
            {canEdit ? (
              <ExpandedEditableDetails
                lesson={lesson}
                edits={edits}
                onEdit={onEdit}
                onEditResources={onEditResources}
              />
            ) : (
              <>
                {lesson.subtitle && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Subtitle</span>
                    <p className="text-sm text-gray-600">{lesson.subtitle}</p>
                  </div>
                )}
                {lesson.description && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Description</span>
                    <p className="text-sm text-gray-600">{lesson.description}</p>
                  </div>
                )}
                {lesson.cancellationReason && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Cancellation Reason</span>
                    <p className="text-sm text-gray-600">{lesson.cancellationReason}</p>
                  </div>
                )}
                {lesson.resources && lesson.resources.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">Resources</span>
                    <div className="flex flex-wrap gap-2 mt-1">
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
                  </div>
                )}
                {!lesson.subtitle && !lesson.description && (!lesson.resources || lesson.resources.length === 0) && (
                  <p className="text-xs text-gray-400 italic">No additional details</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Actions: Duplicate + Delete */}
        {canEdit && (
          <div className="pt-2 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onDuplicate(lesson.id)}
            >
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => onDelete(lesson.id)}
              disabled={hasAttendance}
            >
              {hasAttendance ? 'Cannot Delete' : 'Delete'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

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

  // DnD sensors — MouseSensor for desktop, TouchSensor (press-hold) for iPad/touch
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

  // Duplicate a lesson
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

  // Save all changes
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

      // Refetch lessons to get fresh data
      const url = selectedYearId && selectedYearId !== 'all'
        ? `/api/lessons?academicYearId=${selectedYearId}`
        : '/api/lessons'
      const lessonsRes = await fetch(url)
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      }

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

  // Handle drag-and-drop reorder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Use filteredLessons for index lookup - this matches the visual table order
    // (filteredLessons is sorted by lessonNumber, which is the displayed order)
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

    // Persist reorder via API - send only the visible lessons in new order
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

      // Refetch to get updated dates/numbers
      const url = selectedYearId && selectedYearId !== 'all'
        ? `/api/lessons?academicYearId=${selectedYearId}`
        : '/api/lessons'
      const lessonsRes = await fetch(url)
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      }

      toast.success('Lessons reordered')
    } catch (error) {
      console.error('Failed to reorder:', error)
      toast.error('Failed to reorder lessons')
      // Revert on failure
      const url = selectedYearId && selectedYearId !== 'all'
        ? `/api/lessons?academicYearId=${selectedYearId}`
        : '/api/lessons'
      const lessonsRes = await fetch(url)
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      }
    } finally {
      setReordering(false)
    }
  }

  // Add new lesson
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

  // Delete lesson
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

  // Discard changes
  const handleDiscardChanges = () => {
    if (editedLessons.size > 0 && confirm('Discard all unsaved changes?')) {
      setEditedLessons(new Map())
    }
  }

  // Mobile move up/down (swap two adjacent lessons)
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

      const url = selectedYearId && selectedYearId !== 'all'
        ? `/api/lessons?academicYearId=${selectedYearId}`
        : '/api/lessons'
      const lessonsRes = await fetch(url)
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json()
        setLessons(Array.isArray(lessonsData) ? lessonsData : [])
      }
      toast.success('Lesson moved')
    } catch (error) {
      console.error('Failed to move lesson:', error)
      toast.error('Failed to move lesson')
    } finally {
      setReordering(false)
    }
  }

  const filtersActive = searchTerm !== '' || filterSection !== 'all'

  // Filter lessons
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const canEdit = session?.user?.role && canManageCurriculum(session.user.role)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold">Curriculum</h1>
            <p className="text-sm text-gray-600">
              {canEdit ? 'Edit lessons inline, drag to reorder, save all at once' : 'Lesson schedule and curriculum'}
            </p>
            {lastSaved && (
              <p className="text-xs text-gray-500 mt-1">
                Last saved {lastSaved.toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
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
              )}
            </div>
          )}
        </div>

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
                      {/* Add New Lesson Row - Full-width grid layout */}
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
                              {/* Row 1: Title, Speaker, Date, Section */}
                              <div>
                                <label className="text-xs font-medium text-gray-500">Title *</label>
                                <Input
                                  value={newLesson.title}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, title: e.target.value }))}
                                  className="h-8 text-sm mt-0.5"
                                  placeholder="Topic title"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Speaker</label>
                                <Input
                                  value={newLesson.speaker}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, speaker: e.target.value }))}
                                  className="h-8 text-sm mt-0.5"
                                  placeholder="Speaker name"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Date *</label>
                                <Input
                                  type="date"
                                  value={newLesson.scheduledDate}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, scheduledDate: e.target.value }))}
                                  className="h-8 text-sm mt-0.5"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Section</label>
                                <select
                                  value={newLesson.examSectionId}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, examSectionId: e.target.value }))}
                                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                                >
                                  {sections.map(section => (
                                    <option key={section.id} value={section.id}>
                                      {section.displayName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {/* Row 2: Subtitle, Description, Academic Year + Exam Day, Actions */}
                              <div>
                                <label className="text-xs font-medium text-gray-500">Subtitle</label>
                                <Input
                                  value={newLesson.subtitle}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, subtitle: e.target.value }))}
                                  className="h-8 text-sm mt-0.5"
                                  placeholder="Subtitle (optional)"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Description</label>
                                <Input
                                  value={newLesson.description}
                                  onChange={(e) => setNewLesson(prev => ({ ...prev, description: e.target.value }))}
                                  className="h-8 text-sm mt-0.5"
                                  placeholder="Description (optional)"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500">Academic Year</label>
                                <select
                                  value={formAcademicYearId}
                                  onChange={(e) => setFormAcademicYearId(e.target.value)}
                                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                                >
                                  {academicYears.map(year => (
                                    <option key={year.id} value={year.id}>
                                      {year.name} {year.isActive ? '(Active)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-end gap-3">
                                <label className="flex items-center gap-1.5 cursor-pointer pb-1.5">
                                  <input
                                    type="checkbox"
                                    checked={newLesson.isExamDay}
                                    onChange={(e) => setNewLesson(prev => ({ ...prev, isExamDay: e.target.checked }))}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs">Exam Day</span>
                                </label>
                                <Button size="sm" className="h-8 px-4 text-xs" onClick={handleAddLesson}>
                                  Create Lesson
                                </Button>
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
                <div className="text-center py-8 text-gray-500">
                  No lessons found
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Mobile: Card Layout */}
        <div className="md:hidden space-y-3">
          {/* Reordering indicator for mobile */}
          {reordering && (
            <Card className="bg-gray-50 border-gray-200 sticky top-0 z-10">
              <CardContent className="p-3 flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Reordering...</span>
              </CardContent>
            </Card>
          )}
          {/* Unsaved changes bar for mobile */}
          {canEdit && hasUnsavedChanges && (
            <Card className="bg-amber-50 border-amber-200 sticky top-0 z-10">
              <CardContent className="p-3 flex items-center justify-between">
                <span className="text-sm text-amber-700 font-medium">
                  {editedLessons.size} unsaved change{editedLessons.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDiscardChanges}>
                    Discard
                  </Button>
                  <Button size="sm" onClick={handleSaveAll} disabled={saving}>
                    {saving ? 'Saving...' : 'Save All'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mobile Add Lesson */}
          {canEdit && showAddRow && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Add New Lesson</h3>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAddRow(false)}>
                    ✕ Cancel
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Topic *</label>
                  <Input
                    value={newLesson.title}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, title: e.target.value }))}
                    className="h-8 text-sm mt-0.5"
                    placeholder="Topic title"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Speaker</label>
                  <Input
                    value={newLesson.speaker}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, speaker: e.target.value }))}
                    className="h-8 text-sm mt-0.5"
                    placeholder="Speaker name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Date *</label>
                  <Input
                    type="date"
                    value={newLesson.scheduledDate}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="h-8 text-sm mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Section</label>
                  <select
                    value={newLesson.examSectionId}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, examSectionId: e.target.value }))}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    {sections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Academic Year</label>
                  <select
                    value={formAcademicYearId}
                    onChange={(e) => setFormAcademicYearId(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs mt-0.5 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    {academicYears.map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name} {year.isActive ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Subtitle</label>
                  <Input
                    value={newLesson.subtitle}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, subtitle: e.target.value }))}
                    className="h-8 text-sm mt-0.5"
                    placeholder="Subtitle (optional)"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Description</label>
                  <Textarea
                    value={newLesson.description}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, description: e.target.value }))}
                    className="text-sm mt-0.5 min-h-[60px]"
                    placeholder="Description (optional)"
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLesson.isExamDay}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, isExamDay: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-xs">Exam Day</span>
                </label>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={handleAddLesson}>
                    Create Lesson
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowAddRow(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredLessons.length === 0 && !showAddRow ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No lessons found
              </CardContent>
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
