import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Terms of Service | St. Mark Church Ministry Portal',
  description: 'Terms governing use of the St. Mark Church Ministry Portal.',
}

export function TermsPageContent() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of Service"
      description="These terms set expectations for appropriate, secure use of the ministry portal and the records available through it."
      lastUpdated="September 3, 2026"
      sections={[
        {
          title: 'Acceptance of these terms',
          content: (
            <p>
              By accessing or using the portal, you agree to these terms and the Privacy Policy. If you are
              submitting information for a child, you confirm that you are the child&apos;s parent, legal guardian,
              or otherwise authorized to provide that information.
            </p>
          ),
        },
        {
          title: 'Purpose of the portal',
          content: (
            <p>
              The portal supports St. Mark Coptic Orthodox Church ministries, including Sunday School and the
              Servants Preparation Program. Features may include registration, class and servant assignments,
              attendance, lessons, exams, mentoring, notes, files, notifications, and ministry reporting.
            </p>
          ),
        },
        {
          title: 'Accounts and security',
          content: (
            <p>
              You must provide accurate information, protect your sign-in credentials, and promptly notify
              church administration if you believe your account has been compromised. You may not share an
              account or use another person&apos;s account without authorization.
            </p>
          ),
        },
        {
          title: 'Roles and authorized access',
          content: (
            <p>
              Portal access is based on church roles and ministry assignments. You may access and use only the
              information needed for your assigned responsibilities. Access to a record does not authorize you
              to copy, disclose, or use it for personal, commercial, or non-ministry purposes.
            </p>
          ),
        },
        {
          title: 'Acceptable use',
          content: (
            <p>
              You may not misuse the portal, attempt to bypass access controls, disrupt service, upload harmful
              material, scrape records, impersonate another person, or enter information you know is false or
              misleading. Ministry records must be handled respectfully and confidentially.
            </p>
          ),
        },
        {
          title: 'Parent and guardian responsibilities',
          content: (
            <p>
              Parents and guardians are responsible for keeping child and contact information current and for
              communicating relevant changes to church administration. The portal supplements, but does not
              replace, direct communication with clergy, servants, coordinators, or emergency services.
            </p>
          ),
        },
        {
          title: 'Content and ministry records',
          content: (
            <p>
              The church retains its rights in portal software, curriculum, forms, and ministry materials.
              Users retain rights they may have in content they submit, while granting the church permission
              to store and use that content as reasonably necessary to operate the ministry and portal.
            </p>
          ),
        },
        {
          title: 'Availability and third-party services',
          content: (
            <p>
              The portal may rely on third-party hosting, authentication, storage, analytics, and notification
              services. Features may occasionally be unavailable, changed, or discontinued. We will make
              reasonable efforts to maintain the portal but do not promise uninterrupted or error-free service.
            </p>
          ),
        },
        {
          title: 'Suspension or termination',
          content: (
            <p>
              The church may limit or remove access when a person&apos;s role or assignment ends, when necessary
              to protect users or information, or when these terms are violated. Relevant ministry records may
              remain subject to the retention practices described in the Privacy Policy.
            </p>
          ),
        },
        {
          title: 'Disclaimer and limitation',
          content: (
            <p>
              The portal is provided for church ministry administration on an &quot;as available&quot; basis. To the
              extent permitted by law, St. Mark Coptic Orthodox Church is not responsible for indirect or
              consequential loss arising from portal interruptions, unauthorized misuse, or reliance on
              incomplete or outdated information.
            </p>
          ),
        },
        {
          title: 'Changes and contact',
          content: (
            <p>
              We may revise these terms as the portal and ministry practices change. Continued use after an
              update means you accept the revised terms. Questions should be directed to St. Mark church
              administration through the church&apos;s usual contact channels.
            </p>
          ),
        },
      ]}
    />
  )
}

export default TermsPageContent
