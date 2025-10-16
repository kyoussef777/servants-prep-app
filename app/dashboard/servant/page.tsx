'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ServantDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role !== 'SERVANT') {
      router.push('/dashboard')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Servant Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome, {session?.user?.name}</p>
          <p className="text-sm text-gray-500">Manage your mentees and view their progress</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>My Mentees</CardTitle>
              <CardDescription>
                View and manage your assigned students (max 3)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/servant/my-mentees">
                <Button className="w-full">Manage My Mentees</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Mentee Analytics</CardTitle>
              <CardDescription>
                View detailed progress for your mentees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/servant/analytics">
                <Button className="w-full">View Analytics</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Your Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              As a <strong>Servant</strong>, you can:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Assign yourself up to <strong>3 mentees</strong></li>
              <li>View detailed analytics for your assigned mentees</li>
              <li>Track their attendance and exam performance</li>
              <li>Monitor their graduation eligibility</li>
            </ul>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{session?.user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{session?.user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Role:</span>
              <span className="font-medium">Servant</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
