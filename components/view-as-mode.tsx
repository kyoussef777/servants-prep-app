'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { Eye, EyeOff, Search, ShieldCheck, User as UserIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import type { RoleTag, UserRole } from '@prisma/client'

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  roleAssignments: { tag: RoleTag }[]
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRIEST: 'Priest',
  SERVANT_PREP: 'Servants Prep Leader',
  MENTOR: 'Mentor',
  STUDENT: 'Servants Prep Student',
  SERVANT: 'Sunday School Servant',
  PARENT: 'Parent',
}

const TAG_LABEL: Record<RoleTag, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRIEST: 'Priest',
  SERVANTS_PREP_SERVANT: 'SP Servant',
  SERVANTS_PREP_STUDENT: 'SP Student',
  SUNDAY_SCHOOL_SERVANT: 'SS Servant',
  SUNDAY_SCHOOL_STUDENT: 'SS Student',
  PARENT: 'Parent',
}

export function defaultDashboardPath(role: UserRole): string {
  switch (role) {
    case 'STUDENT':
      return '/dashboard/student'
    case 'MENTOR':
      return '/dashboard/mentor'
    case 'SERVANT':
      return '/dashboard/servants'
    case 'PARENT':
      return '/dashboard/parent'
    case 'SERVANT_PREP':
    case 'PRIEST':
    case 'SUPER_ADMIN':
      return '/dashboard/admin'
  }
}

export function ViewAsMode() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const viewingAs = session?.impersonating ?? null
  const isSuperAdminActor = session?.user?.role === 'SUPER_ADMIN' || !!viewingAs

  useEffect(() => {
    if (!isSuperAdminActor) return

    const handleViewAsShortcut = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'q' &&
        !event.repeat
      ) {
        event.preventDefault()
        setOpen((currentlyOpen) => !currentlyOpen)
      }
    }

    window.addEventListener('keydown', handleViewAsShortcut)
    return () => window.removeEventListener('keydown', handleViewAsShortcut)
  }, [isSuperAdminActor])

  useEffect(() => {
    if (!open || !isSuperAdminActor) return
    let cancelled = false

    const fetchUsers = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '30' })
        if (query.trim()) params.set('search', query.trim())
        const response = await fetch(`/api/admin/view-as/users?${params.toString()}`)
        if (!response.ok) throw new Error('Unable to load users')
        const data = await response.json() as UserRow[]
        if (!cancelled) setUsers(data)
      } catch (error) {
        if (!cancelled) {
          setUsers([])
          toast.error(error instanceof Error ? error.message : 'Unable to load users')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timer = window.setTimeout(fetchUsers, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query, isSuperAdminActor])

  if (!session?.user || !isSuperAdminActor) return null

  const reloadForEffectiveIdentity = (destination?: string) => {
    // A full reload clears data cached for the previous effective identity.
    // When stopping View as, change the URL synchronously first so the reload
    // cannot leave the restored admin on the target user's current page.
    if (destination && window.location.pathname !== destination) {
      window.history.replaceState(window.history.state, '', destination)
    }
    router.refresh()
    window.setTimeout(() => window.location.reload(), 50)
  }

  const pick = async (userId: string) => {
    setBusy(true)
    try {
      const updated = await update({ impersonate: userId })
      if (!updated?.impersonating || updated.user?.id !== userId) {
        toast.error('View as could not be started. Confirm your Super Admin access and try again.')
        return
      }
      setOpen(false)
      setQuery('')
      reloadForEffectiveIdentity()
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      const updated = await update({ impersonate: null })
      if (updated?.impersonating || !updated?.user) {
        toast.error('View as could not be stopped. Sign out if the problem continues.')
        return
      }
      reloadForEffectiveIdentity(defaultDashboardPath(updated.user.role))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {viewingAs && <ViewAsBanner session={session} busy={busy} onStop={stop} />}
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        query={query}
        setQuery={setQuery}
        users={users}
        loading={loading}
        busy={busy}
        actorUserId={viewingAs?.originalId ?? session.user.id}
        effectiveUserId={session.user.id}
        onPick={pick}
      />
    </>
  )
}

function ViewAsBanner({
  session,
  busy,
  onStop,
}: {
  session: {
    user?: { name?: string | null; email?: string | null; role: UserRole } | null
    impersonating?: { originalName: string | null; originalEmail: string | null } | null
  }
  busy: boolean
  onStop: () => void
}) {
  return (
    <div className="bg-amber-500 text-amber-950 shadow-sm" role="status">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <strong>Read-only View as:</strong>{' '}
            {session.user?.name ?? session.user?.email}
            <span className="opacity-80"> ({ROLE_LABEL[session.user?.role ?? ''] ?? session.user?.role})</span>
            <span className="hidden md:inline opacity-80">
              {' '}— acting admin: {session.impersonating?.originalName ?? session.impersonating?.originalEmail}
            </span>
            <span className="hidden lg:inline opacity-80"> · Ctrl+Q to switch</span>
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onStop}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-2.5 py-1 font-medium disabled:opacity-50"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Stop
        </button>
      </div>
    </div>
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
  actorUserId,
  effectiveUserId,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  setQuery: (query: string) => void
  users: UserRow[]
  loading: boolean
  busy: boolean
  actorUserId: string
  effectiveUserId: string
  onPick: (id: string) => void
}) {
  const grouped = users.reduce<Record<string, UserRow[]>>((groups, user) => {
    if (!groups[user.role]) groups[user.role] = []
    groups[user.role].push(user)
    return groups
  }, {})
  const groupOrder: UserRole[] = ['PRIEST', 'SERVANT_PREP', 'MENTOR', 'SERVANT', 'PARENT', 'STUDENT', 'SUPER_ADMIN']

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-3 sm:top-[12%] z-50 w-full max-w-[680px] -translate-x-1/2 px-3 sm:px-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">View as another user</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Preview the application with another user&apos;s access. All changes are blocked.
          </DialogPrimitive.Description>
          <Command className="overflow-hidden rounded-xl border bg-white dark:bg-gray-900 shadow-2xl" label="View as user">
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50 px-3">
              <Eye className="h-4 w-4 text-amber-700 shrink-0" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Search users by name or email…"
                className="h-12 flex-1 bg-transparent text-base sm:text-sm outline-none placeholder:text-amber-700/50 text-amber-950 dark:text-amber-100"
              />
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold rounded bg-amber-200 px-1.5 py-0.5 text-amber-900">
                <ShieldCheck className="h-3 w-3" /> READ-ONLY
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-700 hover:bg-amber-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Command.List className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="py-6 text-center text-sm text-gray-500">
                {loading ? 'Searching…' : 'No users found.'}
              </Command.Empty>
              {groupOrder.map((role) => {
                const rows = grouped[role]
                if (!rows?.length) return null
                return (
                  <Command.Group
                    key={role}
                    heading={ROLE_LABEL[role]}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                  >
                    {rows.map((user) => {
                      const isActor = user.id === actorUserId
                      const isCurrent = user.id === effectiveUserId
                      return (
                        <Command.Item
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          disabled={busy || isActor || isCurrent}
                          onSelect={() => onPick(user.id)}
                          className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm cursor-pointer aria-selected:bg-amber-50 dark:aria-selected:bg-amber-900/30 active:bg-amber-100 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                        >
                          <UserIcon className="h-4 w-4 text-gray-500 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate normal-case font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
                            <span className="block truncate normal-case text-xs font-normal text-gray-500">{user.email}</span>
                          </span>
                          <span className="hidden md:flex max-w-[230px] flex-wrap justify-end gap-1 normal-case">
                            {user.roleAssignments.slice(0, 3).map(({ tag }) => (
                              <span key={tag} className="rounded border bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {TAG_LABEL[tag]}
                              </span>
                            ))}
                          </span>
                          {(isActor || isCurrent) && (
                            <span className="text-[10px] uppercase font-bold text-amber-700">
                              {isActor ? 'you' : 'current'}
                            </span>
                          )}
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )
              })}
            </Command.List>
            <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-gray-500 dark:border-gray-800">
              <span className="flex items-center gap-1.5">
                <Search className="h-3 w-3" /> Permissions and scope match the selected account
              </span>
              <span className="hidden sm:inline">
                <kbd className="rounded border bg-gray-50 dark:bg-gray-800 px-1 font-mono">Ctrl Q</kbd>
                {' '}close · expires after 30 minutes
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
