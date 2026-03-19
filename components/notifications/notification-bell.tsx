'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, BellRing, Check, CheckCheck, ExternalLink } from 'lucide-react'
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

export function NotificationBell() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data, mutate } = useSWR<NotificationsResponse>(
    session?.user ? '/api/notifications?limit=15' : null,
    fetcher,
    { refreshInterval: 30000, dedupingInterval: 10000 }
  )

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        window.location.href = notification.url
      }
      setIsOpen(false)
    },
    [markRead]
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
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    !notification.isRead ? 'bg-accent/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(notification.createdAt)}
                        </span>
                        {notification.url && (
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markRead(notification.id)
                        }}
                        className="mt-1 rounded p-1 hover:bg-accent transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
