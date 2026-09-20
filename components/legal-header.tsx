'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export function LegalHeader() {
  const { status } = useSession()

  // Authenticated visitors keep the app navbar. Waiting for the session before
  // showing this avoids briefly flashing a signed-out header during hydration.
  if (status !== 'unauthenticated') return null

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/login" className="group flex items-center gap-3" aria-label="Return to sign in">
          <Image
            src="/st-mark-logo.png"
            alt="St. Mark Coptic Orthodox Church Logo"
            width={42}
            height={36}
            className="h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">St. Mark Church</p>
            <p className="text-xs text-gray-500">Ministry Portal</p>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-maroon-300 hover:text-maroon-700 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-maroon-700 dark:hover:text-maroon-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Sign in
          </Link>
        </div>
      </div>
    </header>
  )
}
