'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import {
  getLegalReturnLabel,
  getSafeLegalReturnPath,
  LEGAL_RETURN_PATH_KEY,
} from '@/lib/legal-navigation'

export function LegalBackLink() {
  const pathname = usePathname()
  const { status } = useSession()
  const inSundaySchoolMode = pathname.startsWith('/dashboard/servants')
  const fallbackHref = inSundaySchoolMode ? '/dashboard/servants' : '/dashboard'
  const fallbackLabel = inSundaySchoolMode ? 'Sunday School' : 'Dashboard'
  const [destination, setDestination] = useState({
    href: fallbackHref,
    label: fallbackLabel,
  })

  useEffect(() => {
    const returnPath = getSafeLegalReturnPath(
      sessionStorage.getItem(LEGAL_RETURN_PATH_KEY),
      inSundaySchoolMode
    )
    setDestination({
      href: returnPath ?? fallbackHref,
      label: getLegalReturnLabel(returnPath, inSundaySchoolMode),
    })
  }, [fallbackHref, fallbackLabel, inSundaySchoolMode])

  // Signed-out legal pages already provide a return-to-sign-in action in their
  // public header. This link is for returning authenticated users to their
  // active workspace without accidentally changing modes.
  if (status !== 'authenticated') return null

  return (
    <Link
      href={destination.href}
      onClick={() => sessionStorage.removeItem(LEGAL_RETURN_PATH_KEY)}
      className="group mb-10 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-maroon-300 hover:text-maroon-700 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-maroon-700 dark:hover:text-maroon-300"
    >
      <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      Back to {destination.label}
    </Link>
  )
}
