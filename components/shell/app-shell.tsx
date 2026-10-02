'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getRoleDisplayName, isAdmin } from '@/lib/roles'
import {
  availableMinistries,
  currentNavLabel,
  navigationFor,
  prepHome,
  resolveMinistry,
} from '@/lib/navigation'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { MobileAppBar, MobileTabBar } from './mobile-nav'

const RAIL_KEY = 'sidebar-rail'

/** Signed-in areas get the shell; sign-in, sign-up and legal pages stand alone. */
export function usesAppShell(pathname: string) {
  return pathname.startsWith('/dashboard') || pathname === '/settings'
}

/**
 * Sidebar + fluid content on desktop, a 64px rail on tablets, app bar + tab
 * bar on phones (design system §07). One shell for every ministry; only the
 * nav groups and the accent change.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [rail, setRail] = useState(false)

  useEffect(() => {
    try {
      setRail(window.localStorage.getItem(RAIL_KEY) === '1')
    } catch {
      // Storage can be unavailable (private mode); the sidebar just starts open.
    }
  }, [])

  const toggleRail = useCallback(() => {
    setRail((current) => {
      const next = !current
      try {
        window.localStorage.setItem(RAIL_KEY, next ? '1' : '0')
      } catch {
        // Not persisted; fine.
      }
      return next
    })
  }, [])

  const user = session?.user
  const ministries = useMemo(() => (user ? availableMinistries(user) : []), [user])

  // ⌘1–⌘9 switch ministries in menu order.
  useEffect(() => {
    if (ministries.length < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const index = Number(e.key) - 1
      if (!Number.isInteger(index) || index < 0 || index >= ministries.length) return
      e.preventDefault()
      router.push(ministries[index].href)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ministries, router])

  if (!usesAppShell(pathname) || status === 'unauthenticated') {
    return <>{children}</>
  }

  if (!user) {
    // Session still loading: hold the frame so the page doesn't jump when it arrives.
    return (
      <div className="flex min-h-dvh">
        <div data-sidebar className="hidden shrink-0 border-r border-line bg-sidebar-bg md:block" />
        <main id="main" className="min-w-0 flex-1">{children}</main>
      </div>
    )
  }

  const ministry = resolveMinistry(user, pathname)
  const groups = navigationFor(user, ministry)
  const page = currentNavLabel(groups, pathname)
  const roleLabel = `${getRoleDisplayName(user.role)}${user.isAsyncStudent ? ' · Async' : ''}`
  const shellUser = { name: user.name, role: user.role, roleLabel, imageUrl: user.profileImageUrl ?? user.image }
  const homeHref = ministry === 'sunday-school' ? (user.role === 'PARENT' ? '/dashboard/parent' : '/dashboard/servants') : prepHome(user.role)
  const showYear = ministry === 'prep' && user.role !== 'PARENT'

  return (
    <div data-ministry={ministry} className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar
        ministry={ministry}
        ministries={ministries}
        groups={groups}
        pathname={pathname}
        search=""
        user={shellUser}
        rail={rail}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileAppBar ministry={ministry} ministries={ministries} />
        <TopBar
          ministry={ministry}
          homeHref={homeHref}
          page={page}
          onToggleRail={toggleRail}
          railCollapsed={rail}
          showYear={showYear}
          yearHref={isAdmin(user.role) ? '/dashboard/admin/settings' : undefined}
        />
        <main
          id="main"
          className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-[calc(56px+env(safe-area-inset-bottom)+24px)] md:px-7 md:pt-6 md:pb-7 print:p-0"
        >
          {children}
        </main>
      </div>
      <MobileTabBar
        ministry={ministry}
        ministries={ministries}
        groups={groups}
        pathname={pathname}
        search=""
        user={shellUser}
      />
    </div>
  )
}
