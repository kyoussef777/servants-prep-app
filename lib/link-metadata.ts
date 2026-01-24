// Extract Google Drive file ID from various URL formats
export function extractGoogleDriveFileId(url: string): string | null {
  try {
    const patterns = [
      /\/file\/d\/([^\/]+)/,           // https://drive.google.com/file/d/FILE_ID/view
      /\/open\?id=([^&]+)/,             // https://drive.google.com/open?id=FILE_ID
      /\/folders\/([^\/\?]+)/,          // https://drive.google.com/drive/folders/FOLDER_ID
      /id=([^&]+)/                      // Any URL with id= parameter
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  } catch {
    return null
  }
}

// Get Google Drive thumbnail URL
export function getGoogleDriveThumbnail(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
}

// Get Google Drive file icon based on URL or file type
export function getGoogleDriveFileIcon(url: string): string {
  if (url.includes('/folders/')) {
    return '📁' // Folder
  }

  // Try to determine file type from URL or common patterns
  const lowercaseUrl = url.toLowerCase()

  if (lowercaseUrl.includes('spreadsheet') || lowercaseUrl.includes('/spreadsheets/')) {
    return '📊' // Sheets
  }
  if (lowercaseUrl.includes('document') || lowercaseUrl.includes('/document/')) {
    return '📄' // Docs
  }
  if (lowercaseUrl.includes('presentation') || lowercaseUrl.includes('/presentation/')) {
    return '📽️' // Slides
  }
  if (lowercaseUrl.includes('form') || lowercaseUrl.includes('/forms/')) {
    return '📋' // Forms
  }

  // Default to file icon
  return '📎'
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'Link'
  }
}

// Check if URL is a Google Drive link
export function isGoogleDriveLink(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com')
}

// Get a preview-friendly title from URL
export function getTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Try to extract filename from path
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1]
      // Decode URI component and clean up
      return decodeURIComponent(lastSegment)
        .replace(/[_-]/g, ' ')
        .replace(/\.[^.]+$/, '') // Remove file extension
        .trim()
    }

    return extractDomain(url)
  } catch {
    return 'Resource Link'
  }
}
