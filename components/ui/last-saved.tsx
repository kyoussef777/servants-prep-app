interface LastSavedProps {
  date: Date | null
  className?: string
}

export function LastSaved({ date, className }: LastSavedProps) {
  if (!date) return null

  return (
    <p className={`text-xs text-gray-500 mt-1 ${className ?? ''}`}>
      Last saved {date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}
    </p>
  )
}
