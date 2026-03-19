'use client'

import { Check, Clock, X, Shield } from 'lucide-react'

type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'

interface AttendanceStatusButtonsProps {
  currentStatus: AttendanceStatus
  onStatusChange: (status: AttendanceStatus) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: {
  status: AttendanceStatus
  icon: typeof Check
  title: string
  activeColor: string
  hoverColor: string
}[] = [
  { status: 'PRESENT', icon: Check, title: 'Present', activeColor: 'bg-green-500 text-white', hoverColor: 'hover:bg-green-100 hover:text-green-600' },
  { status: 'LATE', icon: Clock, title: 'Late', activeColor: 'bg-yellow-500 text-white', hoverColor: 'hover:bg-yellow-100 hover:text-yellow-600' },
  { status: 'ABSENT', icon: X, title: 'Absent', activeColor: 'bg-red-500 text-white', hoverColor: 'hover:bg-red-100 hover:text-red-600' },
  { status: 'EXCUSED', icon: Shield, title: 'Excused (not counted)', activeColor: 'bg-blue-500 text-white', hoverColor: 'hover:bg-blue-100 hover:text-blue-600' },
]

export function AttendanceStatusButtons({
  currentStatus,
  onStatusChange,
  disabled = false,
  size = 'md',
}: AttendanceStatusButtonsProps) {
  const sizeClasses = size === 'sm'
    ? 'h-8 w-8'
    : 'p-1.5'

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div className="flex">
      {STATUS_CONFIG.map(({ status, icon: Icon, title, activeColor, hoverColor }) => (
        <button
          key={status}
          type="button"
          onClick={() => onStatusChange(status)}
          disabled={disabled}
          className={`${sizeClasses} rounded flex items-center justify-center transition-colors ${
            currentStatus === status
              ? activeColor
              : `bg-gray-100 text-gray-400 ${hoverColor}`
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          title={title}
        >
          <Icon className={iconSize} />
        </button>
      ))}
    </div>
  )
}
