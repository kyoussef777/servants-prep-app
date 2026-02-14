'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getRoleDisplayName, canManageUsers, canManageEnrollments, canViewRegistrations } from '@/lib/roles'
import { Menu, X, Moon, Sun, ChevronDown } from 'lucide-react'

interface NavLink {
  href: string
  label: string
}

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (!session?.user || pathname === '/login' || pathname === '/change-password') {
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
    if (path === '/dashboard/admin' || path === '/dashboard/mentor' || path === '/dashboard/student') {
      return pathname === path
    }

    return pathname.startsWith(path + '/')
  }

  // Navigation links based on role
  // Returns { primary, more } for admin roles, or just { primary } for others
  const getNavLinks = (): { primary: NavLink[]; more: NavLink[] } => {
    const role = session.user.role

    if (role === 'STUDENT') {
      const links: NavLink[] = [
        { href: '/dashboard/student', label: 'My Progress' },
        { href: '/dashboard/student/lessons', label: 'My Lessons' },
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
          { href: '/dashboard/mentor/my-mentees', label: 'My Mentees' }
        ],
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
            <Link href="/dashboard" className="flex items-center gap-3">
              <img
                src="/sp-logo.png"
                alt="Servants Prep Logo"
                className="w-10 h-10 rounded-md bg-black p-1"
              />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Servants Prep
              </span>
            </Link>

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
          <div className="flex items-center gap-4">
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

            <div className="hidden md:flex flex-col items-end">
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
                  <Link href="/dashboard" className="cursor-pointer">
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    My Account
                  </Link>
                </DropdownMenuItem>
                {(session.user.role === 'SUPER_ADMIN' || session.user.role === 'PRIEST' || session.user.role === 'SERVANT_PREP') && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/admin/settings" className="cursor-pointer">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/change-password" className="cursor-pointer">
                    Change Password
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
