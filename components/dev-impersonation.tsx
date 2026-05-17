'use client'

/**
 * Dev-only UI for SUPER_ADMINs to view the site as any user.
 * - Renders only when NODE_ENV !== 'production'.
 * - Shows a persistent top banner when impersonating with a one-click "stop".
 * - Shows a floating "View as user" button that opens a search dialog.
 * - The server-side gate lives in lib/auth.ts (jwt callback); this UI just
 *   triggers session.update({ impersonate: <userId | null> }).
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { Eye, EyeOff, Search, User as UserIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  isDisabled?: boolean
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRIEST: 'Priest',
  SERVANT_PREP: 'Servant Prep',
  MENTOR: 'Mentor',
  STUDENT: 'Student',
}

export function DevImpersonation() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Lazy-fetch users when the dialog is open (hook must run unconditionally)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('limit', '20')
        if (query.trim()) params.set('search', query.trim())
        const res = await fetch(`/api/users?${params.toString()}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const list: UserRow[] = Array.isArray(data) ? data : data.users ?? data.data ?? []
          setUsers(list.filter(u => !u.isDisabled))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(fetchUsers, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, query])

  if (process.env.NODE_ENV === 'production') return null
  if (!session?.user) return null

  const impersonating = session.impersonating ?? null
  const isAdminBase = session.user.role === 'SUPER_ADMIN' || !!impersonating
  if (!isAdminBase) return null

  const pick = async (userId: string) => {
    setBusy(true)
    try {
      await update({ impersonate: userId })
      setOpen(false)
      setQuery('')
      router.refresh()
      setTimeout(() => window.location.reload(), 50)
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      await update({ impersonate: null })
      router.refresh()
      setTimeout(() => window.location.reload(), 50)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {impersonating && <ImpersonationBanner session={session} busy={busy} onStop={stop} />}
      <FloatingTrigger
        onClick={() => setOpen(true)}
        impersonating={impersonating}
        onStop={stop}
        busy={busy}
      />
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        query={query}
        setQuery={setQuery}
        users={users}
        loading={loading}
        busy={busy}
        currentUserId={session.user.id}
        onPick={pick}
      />
    </>
  )
}

function ImpersonationBanner({
  session,
  busy,
  onStop,
}: {
  session: { user?: { name?: string | null; email?: string | null; role: UserRole } | null; impersonating?: { originalName: string | null; originalEmail: string | null } | null }
  busy: boolean
  onStop: () => void
}) {
  // Non-sticky: scrolls with the page so it doesn't fight the sticky navbar.
  // The floating bottom-right button stays as the persistent indicator.
  return (
    <div className="bg-amber-500 text-amber-950 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">Viewing as </span>
            <strong>{session.user?.name ?? session.user?.email}</strong>
            <span className="opacity-80"> ({ROLE_LABEL[session.user?.role ?? ''] ?? session.user?.role})</span>
            <span className="hidden md:inline opacity-80">
              {' '}— originally {session.impersonating?.originalName ?? session.impersonating?.originalEmail}
            </span>
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onStop}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 font-medium disabled:opacity-50"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </div>
    </div>
  )
}

function FloatingTrigger({
  onClick,
  impersonating,
  onStop,
  busy,
}: {
  onClick: () => void
  impersonating: { originalName: string | null; originalEmail: string | null } | null
  onStop: () => void
  busy: boolean
}) {
  if (impersonating) {
    return (
      <div className="fixed bottom-4 right-4 z-[55] flex items-center gap-1.5 rounded-full bg-amber-500 text-amber-950 px-1.5 py-1 shadow-lg border-2 border-amber-600">
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-2 rounded-full hover:bg-amber-400 px-2.5 py-1 text-xs font-semibold transition-colors"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Switch user</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStop}
          aria-label="Stop impersonating"
          className="inline-flex items-center gap-1 rounded-full bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      aria-label="View as another user (dev)"
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[55] inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs font-medium shadow-lg hover:bg-amber-100 hover:shadow-xl transition-all"
    >
      <Eye className="h-4 w-4" />
      <span className="hidden sm:inline">View as user</span>
      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold">DEV</span>
    </button>
  )
}

function PickerDialog({
  open,
  onOpenChange,
  query,
  setQuery,
  users,
  loading,
  busy,
  currentUserId,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  setQuery: (q: string) => void
  users: UserRow[]
  loading: boolean
  busy: boolean
  currentUserId: string
  onPick: (id: string) => void
}) {
  const grouped = users.reduce<Record<string, UserRow[]>>((acc, u) => {
    const key = u.role
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {})
  const groupOrder: UserRole[] = ['SUPER_ADMIN', 'PRIEST', 'SERVANT_PREP', 'MENTOR', 'STUDENT']

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 z-50 w-full -translate-x-1/2 px-3 sm:px-4',
            'top-3 sm:top-[12%] max-w-[640px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DialogPrimitive.Title className="sr-only">View as another user</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Dev-only: pick a user to impersonate
          </DialogPrimitive.Description>
          <Command
            className="overflow-hidden rounded-xl border bg-white dark:bg-gray-900 shadow-2xl"
            label="View as user"
          >
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50 px-3">
              <Eye className="h-4 w-4 text-amber-700 shrink-0" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Search users to view as…"
                className="h-12 flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-amber-700/50 text-amber-950 dark:text-amber-100"
              />
              <span className="text-[10px] font-bold rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">DEV</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-700 hover:bg-amber-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Command.List className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="py-6 text-center text-sm text-gray-500">
                {loading ? 'Searching…' : 'No users found.'}
              </Command.Empty>
              {groupOrder.map(role => {
                const rows = grouped[role]
                if (!rows || rows.length === 0) return null
                return (
                  <Command.Group
                    key={role}
                    heading={ROLE_LABEL[role]}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                  >
                    {rows.map(u => {
                      const isCurrent = u.id === currentUserId
                      return (
                        <Command.Item
                          key={u.id}
                          value={`${u.name} ${u.email}`}
                          disabled={busy || isCurrent}
                          onSelect={() => onPick(u.id)}
                          className="flex items-center gap-3 rounded-md px-2 py-2.5 sm:py-2 text-sm cursor-pointer aria-selected:bg-amber-50 dark:aria-selected:bg-amber-900/30 active:bg-amber-100 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                        >
                          <UserIcon className="h-4 w-4 text-gray-500" />
                          <span className="flex-1 truncate">{u.name}</span>
                          <span className="text-xs text-gray-400 truncate max-w-[180px]">{u.email}</span>
                          {isCurrent && <span className="text-[10px] uppercase font-bold text-amber-700">current</span>}
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )
              })}
            </Command.List>
            <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-gray-500 dark:border-gray-800">
              <span className="flex items-center gap-1.5">
                <Search className="h-3 w-3" /> Dev-only tool · disabled in production
              </span>
              <span className="hidden sm:inline">
                <kbd className="rounded border bg-gray-50 dark:bg-gray-800 px-1 font-mono">↵</kbd> select
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
