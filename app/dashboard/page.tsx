'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      // Redirect based on role
      switch (session?.user?.role) {
        case 'STUDENT':
          router.push('/dashboard/student')
          break
        case 'SERVANT':
          router.push('/dashboard/servant')
          break
        case 'SERVANT_PREP':
        case 'PRIEST':
        case 'SUPER_ADMIN':
          router.push('/dashboard/admin')
          break
        default:
          router.push('/login')
      }
    }
  }, [status, session, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>
  )
}
