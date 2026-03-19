interface EmptyStateProps {
  message: string
  className?: string
}

export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div className={`text-center py-8 text-gray-500 ${className ?? ''}`}>
      {message}
    </div>
  )
}
