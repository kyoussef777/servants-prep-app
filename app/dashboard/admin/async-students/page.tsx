'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { isAdmin, isReadOnlyAdmin, canReviewAsyncNotes, canManageSundaySchool, canManageSundaySchoolAttendance } from '@/lib/roles'
import { AsyncNotesPanel } from '@/components/admin/async-notes-panel'
import { SundaySchoolPanel } from '@/components/admin/sunday-school-panel'

export default function AsyncStudentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('notes')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && !isAdmin(session?.user?.role)) {
      router.push('/dashboard')
    }
  }, [status, session, router])

  if (status === 'loading' || !session?.user || !isAdmin(session.user.role)) {
    return null
  }

  const role = session.user.role
  const readOnly = isReadOnlyAdmin(role)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Async Students</h1>
          <p className="text-muted-foreground">
            Manage async student note submissions and Sunday School assignments
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="notes">Notes Review</TabsTrigger>
            <TabsTrigger value="sunday-school">Sunday School</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-6">
            <AsyncNotesPanel
              canReview={canReviewAsyncNotes(role)}
              isReadOnly={readOnly}
            />
          </TabsContent>

          <TabsContent value="sunday-school" className="mt-6">
            <SundaySchoolPanel
              canManage={canManageSundaySchool(role)}
              canManageAttendance={canManageSundaySchoolAttendance(role)}
              readOnly={readOnly}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
