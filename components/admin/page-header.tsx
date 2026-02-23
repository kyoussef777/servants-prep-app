import { LastSaved } from '@/components/ui/last-saved'

interface PageHeaderProps {
  title: string
  description?: string
  lastSaved?: Date | null
  actions?: React.ReactNode
}

export function PageHeader({ title, description, lastSaved, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
        {lastSaved !== undefined && <LastSaved date={lastSaved ?? null} />}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
