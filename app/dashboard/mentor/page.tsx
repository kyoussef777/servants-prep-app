'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MentorDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && session?.user?.role &&
               session.user.role !== 'MENTOR' &&
               session.user.role !== 'SUPER_ADMIN' &&
               session.user.role !== 'SERVANT_PREP') {
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
          <h1 className="text-3xl font-bold">Mentor Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome, {session?.user?.name}</p>
          <p className="text-sm text-gray-500">View your mentees and their progress</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-1 gap-4 max-w-md">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>My Mentees</CardTitle>
              <CardDescription>
                View your assigned students and their detailed analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/mentor/my-mentees">
                <Button className="w-full">View My Mentees</Button>
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
              As a <strong>Mentor</strong>, you have read-only access to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>View your assigned mentees and their detailed analytics</li>
              <li>Track their attendance records</li>
              <li>Monitor their exam scores and performance</li>
              <li>Check their graduation eligibility</li>
            </ul>
            <p className="text-sm text-gray-600 pt-2">
              <strong>Note:</strong> To request changes to mentee assignments, please contact an administrator.
            </p>
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
              <span className="font-medium">Mentor</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
