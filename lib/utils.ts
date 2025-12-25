import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string as UTC to avoid timezone shifts.
 * Use this for dates that represent a specific calendar day (not a moment in time).
 * This prevents dates stored as midnight UTC from appearing as the previous day
 * when displayed in timezones west of UTC (like EST/PST).
 */
export function formatDateUTC(dateStr: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options })
}
