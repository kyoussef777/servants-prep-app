/**
 * Store and compare email addresses in one canonical form.
 *
 * Email inputs are user-controlled and may contain surrounding whitespace or
 * mixed casing. The application treats addresses as case-insensitive, so every
 * write path should pass through this helper before validation, lookup, or
 * persistence.
 */
export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normalizeOptionalEmail(value: unknown): string | null {
  return normalizeEmail(value) || null
}
