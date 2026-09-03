import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy | St. Mark Church Ministry Portal',
  description: 'How the St. Mark Church Ministry Portal collects, uses, and protects information.',
}

export function PrivacyPageContent() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="This policy explains how information is handled when families, students, servants, mentors, clergy, and administrators use the ministry portal."
      lastUpdated="September 3, 2026"
      sections={[
        {
          title: 'Information we collect',
          content: (
            <>
              <p>
                We collect account details such as name, email address, phone number, profile photo,
                ministry role, and sign-in information. We also maintain records needed to operate the
                Servants Preparation and Sunday School ministries.
              </p>
              <p>
                Those ministry records may include enrollment, class and mentor assignments, attendance,
                expected absences, exam results, lesson progress, notes, uploaded resources, notification
                preferences, and Sunday School service activity.
              </p>
            </>
          ),
        },
        {
          title: 'Children and guardian information',
          content: (
            <p>
              For Sunday School registration and administration, we may collect a child&apos;s name, date of
              birth, grade, class, attendance, and relevant registration details, together with a parent or
              guardian&apos;s name, contact information, and relationship to the child. This information is used
              only for church ministry administration, communication, and safeguarding purposes.
            </p>
          ),
        },
        {
          title: 'How we use information',
          content: (
            <p>
              Information is used to authenticate users, manage classes and rosters, record attendance and
              academic progress, coordinate servants and mentors, review registrations, communicate ministry
              updates, support users, maintain security, and improve the reliability of the portal.
            </p>
          ),
        },
        {
          title: 'Who can access information',
          content: (
            <p>
              Access is limited according to a person&apos;s church role and current ministry assignments.
              Administrators, clergy, mentors, coordinators, and servants receive only the access needed for
              their responsibilities. Sensitive guardian contact details are restricted to authorized people
              responsible for the child&apos;s class and appropriate administrators.
            </p>
          ),
        },
        {
          title: 'Service providers and disclosure',
          content: (
            <p>
              We may use trusted providers for hosting, database services, authentication, file delivery,
              analytics, email, and notifications. They may process information only as needed to provide
              those services. We do not sell personal information or use ministry records for targeted
              advertising. Information may also be disclosed when required by law or necessary to protect
              the safety and rights of the church community.
            </p>
          ),
        },
        {
          title: 'Cookies and technical information',
          content: (
            <p>
              The portal uses cookies and similar browser storage for essential functions such as secure
              sign-in, session continuity, theme preferences, and notification settings. Basic technical and
              usage information may be collected to diagnose errors, prevent abuse, and understand portal
              performance.
            </p>
          ),
        },
        {
          title: 'Retention and security',
          content: (
            <p>
              We keep information only as long as reasonably needed for ministry administration, safety,
              recordkeeping, and legal obligations. We use reasonable administrative and technical safeguards
              to protect it, but no online system can guarantee absolute security.
            </p>
          ),
        },
        {
          title: 'Your choices and requests',
          content: (
            <p>
              You may ask church administration to review or correct your account or family information, or
              to consider a deletion request. Some records may need to be retained for legitimate ministry,
              safeguarding, or legal reasons. Parents and guardians may make these requests for their children.
            </p>
          ),
        },
        {
          title: 'Changes and contact',
          content: (
            <p>
              We may update this policy as the portal or ministry practices change. The date above identifies
              the latest revision. For privacy questions or requests, contact St. Mark church administration
              through the church&apos;s usual contact channels.
            </p>
          ),
        },
      ]}
    />
  )
}

export default PrivacyPageContent
