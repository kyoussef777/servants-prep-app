'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  X,
  BookOpen,
  Calendar,
  CalendarX,
  UserCheck,
  ClipboardList,
  Megaphone,
  ShieldAlert,
  FileText,
  Star,
} from 'lucide-react'
import { formatDistanceToNow } from '@/lib/format-date'
import useSWR from 'swr'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  url: string | null
  isRead: boolean
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
  nextCursor: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function getNotificationMeta(type: string): { icon: React.ElementType; color: string } {
  switch (type) {
    case 'GRADE_POSTED':
      return { icon: Star, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40' }
    case 'ATTENDANCE_RECORDED':
      return { icon: Calendar, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' }
    case 'LESSON_SCHEDULED':
      return { icon: BookOpen, color: 'text-green-600 bg-green-100 dark:bg-green-900/40' }
    case 'LESSON_CANCELLED':
      return { icon: CalendarX, color: 'text-red-600 bg-red-100 dark:bg-red-900/40' }
    case 'REGISTRATION_RECEIVED':
      return { icon: ClipboardList, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40' }
    case 'REGISTRATION_APPROVED':
      return { icon: UserCheck, color: 'text-green-600 bg-green-100 dark:bg-green-900/40' }
    case 'REGISTRATION_REJECTED':
      return { icon: ShieldAlert, color: 'text-red-600 bg-red-100 dark:bg-red-900/40' }
    case 'ASYNC_NOTE_REVIEWED':
      return { icon: FileText, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40' }
    case 'MENTOR_ASSIGNED':
      return { icon: UserCheck, color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/40' }
    case 'ANNOUNCEMENT':
      return { icon: Megaphone, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40' }
    case 'CONDUCT_REMOVAL':
      return { icon: ShieldAlert, color: 'text-red-600 bg-red-100 dark:bg-red-900/40' }
    default:
      return { icon: Bell, color: 'text-gray-500 bg-gray-100 dark:bg-gray-800' }
  }
}

export function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<NotificationsResponse>(
    session?.user ? '/api/notifications?limit=15' : null,
    fetcher,
    { refreshInterval: 30000, dedupingInterval: 10000 }
  )

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  // Close on click outside (desktop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const markAllRead = useCallback(async () => {
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    mutate()
  }, [mutate])

  const markRead = useCallback(
    async (id: string) => {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      })
      mutate()
    },
    [mutate]
  )

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) {
        markRead(notification.id)
      }
      if (notification.url) {
        router.push(notification.url)
      }
      setIsOpen(false)
    },
    [markRead, router]
  )

  if (!session?.user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-2 hover:bg-accent transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel — bottom sheet on mobile, dropdown on desktop */}
          <div className="
            fixed bottom-0 left-0 right-0 z-50
            sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96
            rounded-t-2xl sm:rounded-lg
            border bg-popover text-popover-foreground shadow-xl
            flex flex-col
            max-h-[85vh] sm:max-h-[520px]
          ">
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({unreadCount} unread)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden rounded p-1 hover:bg-accent transition-colors ml-1"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-3 opacity-25" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => {
                  const { icon: Icon, color } = getNotificationMeta(notification.type)
                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-left px-4 py-3.5 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                        !notification.isRead ? 'bg-accent/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type icon */}
                        <div className={`flex-shrink-0 rounded-full p-2 mt-0.5 ${color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate leading-tight">
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {notification.body}
                          </p>
                          <span className="text-[10px] text-muted-foreground mt-1 block">
                            {formatDistanceToNow(notification.createdAt)}
                          </span>
                        </div>

                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markRead(notification.id)
                            }}
                            className="flex-shrink-0 mt-1 rounded p-1 hover:bg-accent transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Bottom safe area for mobile */}
            <div className="sm:hidden flex-shrink-0 h-4" />
          </div>
        </>
      )}
    </div>
  )
}
