'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import { cn } from '@/lib/utils'

interface MentorFilterOption {
  id: string
  name: string
}

interface MentorFilterComboboxProps {
  mentors: MentorFilterOption[]
  workload: Map<string, number>
  value: string
  onValueChange: (value: string) => void
}

interface FilterOption {
  value: string
  label: string
  count?: number
}

export function MentorFilterCombobox({
  mentors,
  workload,
  value,
  onValueChange,
}: MentorFilterComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const options = useMemo<FilterOption[]>(() => [
    { value: 'all', label: 'All Mentors' },
    { value: 'unassigned', label: 'Unassigned' },
    ...mentors.map((mentor) => ({
      value: mentor.id,
      label: mentor.name,
      count: workload.get(mentor.id) ?? 0,
    })),
  ], [mentors, workload])

  const selectedOption = options.find((option) => option.value === value) ?? options[0]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredOptions = normalizedQuery
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
    : options

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const selectOption = (option: FilterOption) => {
    onValueChange(option.value)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const openList = () => {
    setQuery('')
    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Filter by mentor"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="mentor-filter-options"
        aria-activedescendant={
          open && filteredOptions[activeIndex]
            ? `mentor-filter-option-${filteredOptions[activeIndex].value}`
            : undefined
        }
        autoComplete="off"
        placeholder="Search mentors…"
        value={open ? query : selectedOption.label}
        onFocus={openList}
        onClick={() => {
          if (!open) openList()
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
            event.preventDefault()
            selectOption(filteredOptions[activeIndex])
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setOpen(false)
            setQuery('')
            inputRef.current?.blur()
          } else if (event.key === 'Tab') {
            setOpen(false)
            setQuery('')
          }
        }}
        className="h-9 w-full rounded-md border border-input bg-background py-2 pl-8 pr-8 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus:border-maroon-400 focus:ring-2 focus:ring-maroon-100 dark:bg-gray-800 dark:text-white dark:focus:border-maroon-600 dark:focus:ring-maroon-950"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Close mentor list' : 'Open mentor list'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false)
            setQuery('')
            inputRef.current?.blur()
          } else {
            openList()
            inputRef.current?.focus()
          }
        }}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id="mentor-filter-options"
          role="listbox"
          aria-label="Mentors"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-200/80 bg-white/95 p-1.5 shadow-xl shadow-gray-900/10 backdrop-blur-xl dark:border-gray-700/80 dark:bg-gray-900/95 dark:shadow-black/30"
        >
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
            <button
              key={option.value}
              id={`mentor-filter-option-${option.value}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                index === activeIndex
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-700 dark:text-gray-300'
              )}
            >
              <Check
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 shrink-0 text-maroon-600',
                  option.value !== value && 'invisible'
                )}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.count !== undefined && (
                <span className="shrink-0 text-xs tabular-nums text-gray-400">{option.count}</span>
              )}
            </button>
          )) : (
            <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No mentors match “{query}”
            </p>
          )}
        </div>
      )}
    </div>
  )
}
