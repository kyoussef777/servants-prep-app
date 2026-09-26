import { redirect } from 'next/navigation'

export default function LegacyRegistrationCompletionPage() {
  redirect('/dashboard/student/application')
}
