const HONORIFIC_WORDS = new Set([
  'very',
  'rev',
  'reverend',
  'fr',
  'father',
  'mr',
  'mrs',
  'ms',
  'dr',
  'deacon',
  'dn',
])

function normalizeNamePart(part: string): string {
  return part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, '')
}

/**
 * Build a compact avatar label from a person's first and last meaningful name.
 * Clerical and common honorifics are ignored so "Rev. Fr. Daniel Abdel-Maseih"
 * becomes "DA" instead of an unreadable string of title initials.
 */
export function getPersonInitials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .trim()
    .split(/\s+/)
    .map(normalizeNamePart)
    .filter(Boolean)

  const meaningfulParts = parts.filter(
    part => !HONORIFIC_WORDS.has(part.replace(/\.$/, '').toLowerCase())
  )
  const initialsFrom = meaningfulParts.length > 0 ? meaningfulParts : parts

  if (initialsFrom.length === 0) return '??'

  const firstInitial = Array.from(initialsFrom[0])[0] ?? ''
  const lastInitial = initialsFrom.length > 1
    ? Array.from(initialsFrom[initialsFrom.length - 1])[0] ?? ''
    : ''

  return `${firstInitial}${lastInitial}`.toUpperCase() || '??'
}
