'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const EXIT_DURATION_MS = 120
const ENTER_DURATION_MS = 200

export function NavigationTransition() {
  const pathname = usePathname()
  const router = useRouter()
  const previousPathname = useRef(pathname)
  const navigating = useRef(false)
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const root = document.documentElement

    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    navigating.current = false

    if (cleanupTimer.current) clearTimeout(cleanupTimer.current)

    root.classList.remove('page-transition-out')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('page-transition-in')
      return
    }

    root.classList.add('page-transition-in')
    cleanupTimer.current = setTimeout(() => {
      root.classList.remove('page-transition-in')
    }, ENTER_DURATION_MS)
  }, [pathname])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>('a[href]')
      if (
        !anchor ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.hasAttribute('data-mode-switch') ||
        anchor.hasAttribute('data-no-page-transition')
      ) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return

      const currentLocation = `${window.location.pathname}${window.location.search}`
      const nextLocation = `${destination.pathname}${destination.search}`
      if (currentLocation === nextLocation) return

      event.preventDefault()
      if (navigating.current) return
      navigating.current = true

      const root = document.documentElement
      root.classList.remove('page-transition-in')
      root.classList.add('page-transition-out')

      navigateTimer.current = setTimeout(() => {
        router.push(`${nextLocation}${destination.hash}`)

        // Recover gracefully if a navigation is interrupted or rejected.
        cleanupTimer.current = setTimeout(() => {
          root.classList.remove('page-transition-out')
          navigating.current = false
        }, 2000)
      }, EXIT_DURATION_MS)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (navigateTimer.current) clearTimeout(navigateTimer.current)
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current)
      document.documentElement.classList.remove('page-transition-in', 'page-transition-out')
    }
  }, [router])

  return null
}
