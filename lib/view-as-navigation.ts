const VIEW_AS_RETURN_PATH_KEY = 'view-as-return-path'

export function safeViewAsReturnPath(candidate: string | null): string | null {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null
  }

  const parsed = new URL(candidate, 'https://portal.local')
  if (parsed.origin !== 'https://portal.local') return null
  const isDashboardPath =
    parsed.pathname === '/dashboard' || parsed.pathname.startsWith('/dashboard/')
  if (!isDashboardPath && parsed.pathname !== '/settings') return null

  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}

export function rememberViewAsReturnPath(): void {
  try {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const safePath = safeViewAsReturnPath(currentPath)
    if (safePath) window.sessionStorage.setItem(VIEW_AS_RETURN_PATH_KEY, safePath)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts. The
    // restored role's default dashboard remains a safe fallback.
  }
}

export function consumeViewAsReturnPath(fallback: string): string {
  try {
    const stored = window.sessionStorage.getItem(VIEW_AS_RETURN_PATH_KEY)
    window.sessionStorage.removeItem(VIEW_AS_RETURN_PATH_KEY)
    return safeViewAsReturnPath(stored) ?? fallback
  } catch {
    return fallback
  }
}
