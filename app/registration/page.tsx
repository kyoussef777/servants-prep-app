import { prisma } from '@/lib/prisma'
import RegistrationForm from './registration-form'

// Read the active year per request, not at build time
export const dynamic = 'force-dynamic'

export default async function RegistrationPage() {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
    select: { name: true },
  })

  return <RegistrationForm yearName={activeYear?.name ?? null} />
}
