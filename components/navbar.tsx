'use client'

import { useState, type MouseEvent } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleDisplayName, canManageUsers, canManageEnrollments, canViewRegistrations, isAdmin, canAdministerSundaySchool } from '@/lib/roles'
import { Menu, X, Moon, Sun, ChevronDown, Search } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/notification-bell'

interface NavLink {
  href: string
  label: string
}

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [switchingModes, setSwitchingModes] = useState(false)

  if (
    !session?.user ||
    pathname === '/login' ||
    pathname === '/change-password'
  ) {
    return null
  }

  const userInitials = session.user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || '??'

  const isActive = (path: string) => {
    // Exact match for the path
    if (pathname === path) return true

    // For sub-routes, check if pathname starts with path + '/'
    // but exclude the base dashboard path to prevent it from always being active
    if (
      path === '/dashboard/admin' ||
      path === '/dashboard/mentor' ||
      path === '/dashboard/student' ||
      path === '/dashboard/servants'
    ) {
      return pathname === path
    }

    return pathname.startsWith(path + '/')
  }

  // The app has two modes: the Servants Prep program and Sunday School.
  // Which one is showing is derived from the path — no extra state.
  const inSundaySchoolMode = pathname.startsWith('/dashboard/servants')
  // Sunday School access comes from assignments, not a role, so this reads the
  // standing the session carries. Someone with a foot in both modes — a prep
  // leader who also serves — gets the switcher; a SERVANT has only one mode.
  const hasSundaySchool = session.user.sundaySchool?.hasAccess ?? false
  const canSwitchModes = hasSundaySchool && isAdmin(session.user.role)
  const modeDestination = inSundaySchoolMode ? '/dashboard/admin' : '/dashboard/servants'
  const dashboardDestination = inSundaySchoolMode ? '/dashboard/servants' : '/dashboard'
  const accountDestination = inSundaySchoolMode ? '/dashboard/servants/account' : '/settings'

  const handleModeSwitch = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (switchingModes) return

    setMobileMenuOpen(false)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      router.push(modeDestination)
      return
    }

    setSwitchingModes(true)
    document.documentElement.dataset.modeTransition = inSundaySchoolMode
      ? 'to-servants-prep'
      : 'to-sunday-school'

    const waitForModeRoute = () =>
      new Promise<void>((resolve) => {
        const startedAt = performance.now()

        const waitForRoute = () => {
          if (window.location.pathname === modeDestination || performance.now() - startedAt > 2000) {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            return
          }

          requestAnimationFrame(waitForRoute)
        }

        waitForRoute()
      })

    const cleanUpTransition = () => {
      delete document.documentElement.dataset.modeTransition
      document.documentElement.classList.remove('mode-transition-fallback-out')
      document.documentElement.classList.remove('mode-transition-fallback-in')
      setSwitchingModes(false)
    }

    document.documentElement.classList.add('mode-transition-fallback-out')

    window.setTimeout(() => {
      router.push(modeDestination)

      void waitForModeRoute().then(() => {
        document.documentElement.classList.remove('mode-transition-fallback-out')
        document.documentElement.classList.add('mode-transition-fallback-in')
        window.setTimeout(cleanUpTransition, 220)
      })
    }, 160)
  }

  // Navigation links based on role
  // Returns { primary, more } for admin roles, or just { primary } for others
  const getNavLinks = (): { primary: NavLink[]; more: NavLink[] } => {
    const role = session.user.role

    if (role === 'STUDENT') {
      const links: NavLink[] = [
        { href: '/dashboard/student', label: 'My Progress' },
        { href: '/dashboard/student/lessons', label: 'My Lessons' },
        { href: '/dashboard/files', label: 'Files' },
      ]
      if (session.user.isAsyncStudent) {
        links.push({ href: '/dashboard/student/async-notes', label: 'My Notes' })
        links.push({ href: '/dashboard/student/sunday-school', label: 'Sunday School' })
      }
      return { primary: links, more: [] }
    }

    if (role === 'MENTOR') {
      return {
        primary: [
          { href: '/dashboard/mentor', label: 'Dashboard' },
          { href: '/dashboard/mentor/my-mentees', label: 'My Mentees' },
          { href: '/dashboard/files', label: 'Files' },
        ],
        more: []
      }
    }

    if (role === 'SERVANT') {
      return {
        primary: [
          { href: '/dashboard/servants', label: 'Dashboard' },
          { href: '/dashboard/servants/attendance', label: 'Attendance' },
          { href: '/dashboard/servants/children', label: 'Children' },
          { href: '/dashboard/servants/classes', label: 'Classes' },
        ],
        more: []
      }
    }

    // Anyone browsing Sunday School mode gets that mode's links; the switcher
    // next to the logo takes those with both back to the prep program.
    if (inSundaySchoolMode && hasSundaySchool) {
      const links: NavLink[] = [
        { href: '/dashboard/servants', label: 'Dashboard' },
        { href: '/dashboard/servants/attendance', label: 'Attendance' },
        { href: '/dashboard/servants/children', label: 'Children' },
        { href: '/dashboard/servants/classes', label: 'Classes' },
      ]

      if (canAdministerSundaySchool(role)) {
        links.push({ href: '/dashboard/servants/users', label: 'Users' })
      }

      return {
        primary: links,
        more: []
      }
    }

    // SUPER_ADMIN, PRIEST, SERVANT_PREP — split into primary tabs + "More" dropdown
    const primary: NavLink[] = [
      { href: '/dashboard/admin', label: 'Dashboard' },
      { href: '/dashboard/admin/attendance', label: 'Attendance' },
      { href: '/dashboard/admin/students', label: 'Students' },
      { href: '/dashboard/admin/exams', label: 'Exams' },
    ]

    const more: NavLink[] = [
      { href: '/dashboard/admin/curriculum', label: 'Curriculum' },
      { href: '/dashboard/admin/mentees', label: 'Mentees' },
      { href: '/dashboard/files', label: 'Files' },
    ]

    // Async section
    more.push({ href: '/dashboard/admin/async-students', label: 'Async Students' })

    // Conditional management pages
    if (canManageEnrollments(role)) {
      more.push({ href: '/dashboard/admin/enrollments', label: 'Roster' })
    }
    if (canManageUsers(role)) {
      more.push({ href: '/dashboard/admin/users', label: 'Users' })
    }
    if (canViewRegistrations(role)) {
      more.push({ href: '/dashboard/admin/registrations', label: 'Registrations' })
    }

    return { primary, more }
  }

  const { primary: primaryLinks, more: moreLinks } = getNavLinks()
  const allLinks = [...primaryLinks, ...moreLinks]
  const isMoreActive = moreLinks.some(link => isActive(link.href))

  return (
    <nav className="border-b bg-white dark:bg-gray-900 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Logo/Title */}
          <div className="flex items-center gap-8">
            <div
              className={`flex items-center gap-3 ${canSwitchModes ? 'sm:w-[268px] sm:justify-between' : ''}`}
            >
              <Link
                href={inSundaySchoolMode ? '/dashboard/servants' : '/dashboard'}
                className="flex shrink-0 items-center gap-3"
              >
                <Image
                  src={inSundaySchoolMode ? '/st-mark-logo.png' : '/sp-logo.png'}
                  alt={inSundaySchoolMode ? 'St. Mark Coptic Orthodox Church Logo' : 'Servants Prep Logo'}
                  width={inSundaySchoolMode ? 47 : 40}
                  height={40}
                  className={inSundaySchoolMode
                    ? 'h-10 w-auto object-contain'
                    : 'h-10 w-10 rounded-md bg-black p-1'}
                />
                <span className="whitespace-nowrap text-xl font-bold text-gray-900 dark:text-white">
                  {inSundaySchoolMode ? 'Sunday School' : 'Servants Prep'}
                </span>
              </Link>

              {/* One-click mode toggle. Its fixed-width brand group keeps the
                  navigation from shifting when the mode name and logo change. */}
              {canSwitchModes && (
                <Link
                  href={modeDestination}
                  onClick={handleModeSwitch}
                  aria-label={`Switch to ${inSundaySchoolMode ? 'Servants Prep' : 'Sunday School'}`}
                  aria-disabled={switchingModes}
                  title={`Switch to ${inSundaySchoolMode ? 'Servants Prep' : 'Sunday School'}`}
                  className={`relative hidden h-7 w-[58px] shrink-0 grid-cols-2 items-center rounded-full border border-gray-300 bg-gray-100 p-0.5 text-[9px] font-bold text-gray-500 transition-colors hover:border-maroon-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2 sm:grid dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 ${switchingModes ? 'pointer-events-none' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0.5 left-0.5 w-[26px] rounded-full bg-maroon-700 shadow-sm transition-transform duration-200 ease-out ${inSundaySchoolMode ? 'translate-x-[26px]' : 'translate-x-0'}`}
                  />
                  <span className={`relative z-10 text-center ${inSundaySchoolMode ? '' : 'text-white'}`}>
                    SP
                  </span>
                  <span className={`relative z-10 text-center ${inSundaySchoolMode ? 'text-white' : ''}`}>
                    SS
                  </span>
                </Link>
              )}
            </div>

            {/* Navigation Links */}
            <div className="hidden lg:flex items-center gap-1">
              {primaryLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* "More" dropdown for admin roles */}
              {moreLinks.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isMoreActive
                          ? 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      More
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {moreLinks.map((link, index) => {
                      // Add separator before "Async Students" and before "Roster" (or "Users" if no Roster)
                      const needsSeparator =
                        link.href === '/dashboard/admin/async-students' ||
                        link.href === '/dashboard/admin/enrollments' ||
                        (link.href === '/dashboard/admin/users' && !canManageEnrollments(session.user.role))

                      return (
                        <div key={link.href}>
                          {needsSeparator && index > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuItem asChild>
                            <Link
                              href={link.href}
                              className={`cursor-pointer w-full ${
                                isActive(link.href)
                                  ? 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300'
                                  : ''
                              }`}
                            >
                              {link.label}
                            </Link>
                          </DropdownMenuItem>
                        </div>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search / command palette trigger - desktop (search-bar style) */}
            <button
              type="button"
              aria-label="Open command palette"
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="hidden w-56 items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500 transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 md:inline-flex lg:w-48 xl:w-56 2xl:w-64 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">Search students, lessons…</span>
              <kbd className="hidden lg:inline-flex h-5 items-center rounded border bg-white dark:bg-gray-900 dark:border-gray-700 px-1.5 font-mono text-[10px] text-gray-500">⌘K</kbd>
            </button>

            {/* Search trigger - mobile icon only */}
            <button
              type="button"
              aria-label="Open command palette"
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Notification bell */}
            <NotificationBell />

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              className="lg:hidden"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>

            <div className="hidden min-w-max shrink-0 flex-col items-end whitespace-nowrap md:flex">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {session.user.name}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {getRoleDisplayName(session.user.role)}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    {session.user.profileImageUrl && (
                      <AvatarImage src={session.user.profileImageUrl} alt={session.user.name || ''} />
                    )}
                    <AvatarFallback className="bg-maroon-600 text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleDisplayName(session.user.role)}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={dashboardDestination} className="cursor-pointer">
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={accountDestination} className="cursor-pointer">
                    My Account
                  </Link>
                </DropdownMenuItem>
                {!inSundaySchoolMode && (session.user.role === 'SUPER_ADMIN' || session.user.role === 'PRIEST' || session.user.role === 'SERVANT_PREP') && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/admin/settings" className="cursor-pointer">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                {!inSundaySchoolMode && (
                  <DropdownMenuItem asChild>
                    <Link href="/change-password" className="cursor-pointer">
                      Change Password
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    href={inSundaySchoolMode ? '/dashboard/servants/privacy' : '/privacy'}
                    className="cursor-pointer"
                  >
                    Privacy Policy
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={inSundaySchoolMode ? '/dashboard/servants/terms' : '/terms'}
                    className="cursor-pointer"
                  >
                    Terms of Service
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex items-center gap-2"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile menu - flat list of all links */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t dark:border-gray-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {canSwitchModes && (
                <Link
                  href={modeDestination}
                  onClick={handleModeSwitch}
                  aria-disabled={switchingModes}
                  className="block px-3 py-2 mb-1 rounded-md text-base font-medium border text-gray-700 dark:text-gray-300 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Switch to {inSundaySchoolMode ? 'Servants Prep' : 'Sunday School'}
                </Link>
              )}
              {allLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
