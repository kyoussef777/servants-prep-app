'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Trash2,
  BookOpen,
  Calendar,
  CalendarX,
  UserCheck,
  ClipboardList,
  Megaphone,
  ShieldAlert,
  FileText,
  LockKeyhole,
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
    case 'PRIEST_NOTE_CREATED':
      return { icon: LockKeyhole, color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/40' }
    default:
      return { icon: Bell, color: 'text-gray-500 bg-gray-100 dark:bg-gray-800' }
  }
}

export function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  // Desktop dropdown anchor, measured from the bell when opened
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<NotificationsResponse>(
    session?.user ? '/api/notifications?limit=15' : null,
    fetcher,
    { refreshInterval: 30000, dedupingInterval: 10000 }
  )

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  const toggleOpen = () => {
    const rect = dropdownRef.current?.getBoundingClientRect()
    if (!isOpen && rect) {
      setAnchor({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    setIsOpen(!isOpen)
  }

  // Close on click outside or Escape. The panel is portaled, so check both refs.
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (!dropdownRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Lock body scroll only for the mobile bottom sheet
  useEffect(() => {
    if (!isOpen || window.innerWidth >= 640) return
    document.body.style.overflow = 'hidden'
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

  const dismissNotification = useCallback(
    async (id: string) => {
      mutate(
        (current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.filter((n) => n.id !== id),
                unreadCount: current.notifications.find((n) => n.id === id && !n.isRead)
                  ? current.unreadCount - 1
                  : current.unreadCount,
              }
            : current,
        false
      )
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      })
      mutate()
    },
    [mutate]
  )

  const clearAll = useCallback(async () => {
    mutate({ notifications: [], unreadCount: 0, nextCursor: null }, false)
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true }),
    })
    mutate()
  }, [mutate])

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
        onClick={toggleOpen}
        className={`relative rounded-md p-2 transition-colors duration-150 hover:bg-accent motion-reduce:transition-none ${
          isOpen ? 'bg-accent text-primary' : ''
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-controls="notifications-panel"
        aria-haspopup="dialog"
      >
        <Bell
          data-testid="notification-bell-icon"
          strokeWidth={2}
          className={`h-5 w-5 transition-[fill,color] duration-150 motion-reduce:transition-none ${
            isOpen ? 'fill-current text-primary' : ''
          }`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portaled to <body>: the navbar's blur/translate would otherwise become
          the containing block for these fixed elements and trap them in the navbar. */}
      {isOpen && createPortal(
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel — bottom sheet on mobile, dropdown on desktop */}
          <div
            ref={panelRef}
            id="notifications-panel"
            role="dialog"
            aria-label="Notifications"
            style={{ '--notif-top': `${anchor?.top ?? 88}px`, '--notif-right': `${anchor?.right ?? 16}px` } as React.CSSProperties}
            className="
            fixed bottom-0 left-0 right-0 z-[60]
            sm:bottom-auto sm:left-auto sm:right-[var(--notif-right)] sm:top-[var(--notif-top)] sm:w-96
            rounded-t-2xl sm:rounded-lg
            border bg-popover text-popover-foreground shadow-xl
            flex flex-col
            max-h-[85vh] sm:max-h-[520px]
            animate-in fade-in-0 slide-in-from-bottom-4 duration-200 motion-reduce:animate-none
            sm:slide-in-from-top-2 sm:zoom-in-95
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
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-accent"
                    title="Clear all notifications"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clear all</span>
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
                    <div
                      key={notification.id}
                      className={`group relative w-full border-b last:border-b-0 transition-colors ${
                        !notification.isRead ? 'bg-accent/20' : ''
                      } hover:bg-accent/50`}
                    >
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className="w-full text-left px-4 py-3.5 pr-10"
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
                        </div>
                      </button>
                      {/* Row actions: always visible on touch, on hover/focus on desktop */}
                      <div className="absolute top-2 right-2 flex flex-col items-center gap-1">
                        <button
                          onClick={() => dismissNotification(notification.id)}
                          className="rounded p-1 hover:bg-accent transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                        {!notification.isRead && (
                          <button
                            onClick={() => markRead(notification.id)}
                            className="rounded p-1 hover:bg-accent transition-colors"
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Bottom safe area for mobile */}
            <div className="sm:hidden flex-shrink-0 h-4" />
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
