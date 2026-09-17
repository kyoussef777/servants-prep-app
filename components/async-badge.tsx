import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Marks a student whose attendance comes from signed slips instead of in-person marking. */
export function AsyncBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Async student — attendance comes from signed slips"
      className={cn('bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800', className)}
    >
      Async
    </Badge>
  )
}
