import type { ReactNode } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { FadeIn } from '@/components/fade-in'
import { LegalHeader } from '@/components/legal-header'

interface LegalSection {
  title: string
  content: ReactNode
}

interface LegalPageProps {
  eyebrow: 'Privacy' | 'Terms'
  title: string
  description: string
  lastUpdated: string
  sections: LegalSection[]
}

export function LegalPage({ eyebrow, title, description, lastUpdated, sections }: LegalPageProps) {
  const Icon = eyebrow === 'Privacy' ? ShieldCheck : FileText

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <LegalHeader />

      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        <FadeIn>
          <div className="mb-16 sm:mb-20">
            <div className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-maroon-700 dark:text-maroon-300">
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              {description}
            </p>
            <p className="mt-8 text-sm text-gray-500">Last updated: {lastUpdated}</p>
          </div>
        </FadeIn>

        <article className="space-y-12 sm:space-y-14">
          {sections.map((section, index) => (
            <FadeIn key={section.title} delay={Math.min(index * 0.035, 0.18)}>
              <section>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {index + 1}. {section.title}
                </h2>
                <div className="mt-4 space-y-3 text-[15px] leading-7 text-gray-600 dark:text-gray-300">
                  {section.content}
                </div>
              </section>
            </FadeIn>
          ))}
        </article>
      </main>

    </div>
  )
}
