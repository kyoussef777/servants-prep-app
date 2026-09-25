'use client'

import { useAdminGuard } from '@/hooks/useAdminGuard'
import { isAdmin, canManageData } from '@/lib/roles'
import { PageLoading } from '@/components/ui/page-loading'
import { PageHeader } from '@/components/admin/page-header'
import { ConfessionTracker } from '@/components/admin/confession-tracker'

export default function ConfessionPage() {
  const { session, status } = useAdminGuard(isAdmin)

  if (status === 'loading' || !session?.user) {
    return <PageLoading />
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-gray-50 p-4 dark:bg-gray-950 md:p-8">
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
        <PageHeader title="Confession Tracker" description="Father of confession sign-offs, in 2-month batches" />
        <ConfessionTracker canEdit={canManageData(session.user.role)} />
      </div>
    </div>
  )
}
