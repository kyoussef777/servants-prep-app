'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteFooter() {
  const pathname = usePathname()
  const legalBase = pathname.startsWith('/dashboard/servants') ? '/dashboard/servants' : ''

  return (
    <footer className="bg-[var(--app-canvas)] px-2 pb-2 pt-6 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200/80 bg-white/75 shadow-sm shadow-gray-900/5 backdrop-blur-xl dark:border-gray-700/80 dark:bg-gray-900/75 dark:shadow-black/20">
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6">
          <p className="text-center text-xs text-gray-500 sm:text-left dark:text-gray-400">
            © {new Date().getFullYear()} St. Mark Coptic Orthodox Church.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Footer">
            <Link
              href="/dashboard/servants/feedback"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-gray-100/80 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              Feedback
            </Link>
            <Link
              href={`${legalBase}/terms`}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-gray-100/80 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              Terms of Service
            </Link>
            <Link
              href={`${legalBase}/privacy`}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-gray-100/80 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
