'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteFooter() {
  const pathname = usePathname()
  const legalBase = pathname.startsWith('/dashboard/servants') ? '/dashboard/servants' : ''

  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} St. Mark Coptic Orthodox Church.
        </p>
        <nav className="flex items-center gap-4" aria-label="Legal">
          <Link
            href={`${legalBase}/terms`}
            className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Terms of Service
          </Link>
          <Link
            href={`${legalBase}/privacy`}
            className="text-xs text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
