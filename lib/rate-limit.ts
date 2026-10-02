// Simple in-memory rate limiter for login attempts
// Tracks attempts by email to prevent brute force attacks

interface RateLimitEntry {
  count: number
  resetAt: number
}

const loginAttempts = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) {
      loginAttempts.delete(key)
    }
  }
}, 60 * 1000) // Clean every minute

export function checkLoginRateLimit(email: string): { allowed: boolean; retryAfterSeconds?: number } {
  return checkRateLimit(`login:${email.toLowerCase()}`, MAX_ATTEMPTS, WINDOW_MS)
}

/**
 * Fixed-window limiter shared by login and password-reset requests.
 * In-memory, so it limits per server instance; treat it as a brake, not a guarantee.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const entry = loginAttempts.get(key)

  // No previous attempts or window expired
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  // Within window but under limit
  if (entry.count < max) {
    entry.count++
    return { allowed: true }
  }

  // Rate limited
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
  return { allowed: false, retryAfterSeconds }
}

export function resetLoginRateLimit(email: string): void {
  loginAttempts.delete(`login:${email.toLowerCase()}`)
}
