import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { canReviewServantApplications } from '@/lib/roles'
import ServantApplicationsPage from '@/app/dashboard/admin/servant-applications/page'

export default async function SundaySchoolServantApplicationsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user || !canReviewServantApplications(session.user.role)) {
    redirect('/dashboard/servants')
  }

  return <ServantApplicationsPage />
}
