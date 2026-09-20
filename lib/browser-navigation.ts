/**
 * Perform a full-document replacement for security-sensitive identity
 * transitions. Unlike client-side routing, this cannot reuse the previous
 * identity's component tree or data cache.
 */
export function replaceBrowserLocation(destination: string): void {
  window.location.replace(destination)
}
