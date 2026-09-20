'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-gray-300"
      >
        <Moon className="h-4 w-4" />
      </span>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
