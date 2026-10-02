import { LastSaved } from '@/components/ui/last-saved'
import { PageHeader as DsPageHeader } from '@/components/ds/page-header'

interface PageHeaderProps {
  title: string
  description?: string
  lastSaved?: Date | null
  actions?: React.ReactNode
}

/** Legacy signature; renders the design-system header. */
export function PageHeader({ title, description, lastSaved, actions }: PageHeaderProps) {
  const meta: React.ReactNode[] = []
  if (description) meta.push(description)
  if (lastSaved) meta.push(<LastSaved key="saved" date={lastSaved} />)
  return <DsPageHeader title={title} meta={meta} actions={actions} />
}
