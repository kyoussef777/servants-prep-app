interface FilterSelectOption {
  value: string
  label: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  placeholder?: string
  className?: string
}

export function FilterSelect({ value, onChange, options, placeholder, className }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-gray-800 dark:text-white dark:border-gray-600 ${className ?? ''}`}
    >
      {placeholder && <option value="all">{placeholder}</option>}
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
