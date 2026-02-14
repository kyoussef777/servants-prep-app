import { describe, it, expect } from 'vitest'
import {
  extractGoogleDriveFileId,
  getGoogleDriveThumbnail,
  getGoogleDriveFileIcon,
  extractDomain,
  isGoogleDriveLink,
  getTitleFromUrl,
} from '@/lib/link-metadata'

describe('extractGoogleDriveFileId', () => {
  it('should extract ID from /file/d/{id}/view format', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/abc123/view')).toBe('abc123')
  })

  it('should extract ID from /file/d/{id}/view?usp=sharing', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/file/d/xyz789/view?usp=sharing')).toBe('xyz789')
  })

  it('should extract ID from /open?id={id} format', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=abc123')).toBe('abc123')
  })

  it('should extract ID from /open?id={id}&other=param format', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=abc123&other=param')).toBe('abc123')
  })

  it('should extract ID from /folders/{id} format', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/drive/folders/folder123')).toBe('folder123')
  })

  it('should extract ID from URL with id= parameter', () => {
    expect(extractGoogleDriveFileId('https://example.com/view?id=test456')).toBe('test456')
  })

  it('should return null for non-Drive URL without id param', () => {
    expect(extractGoogleDriveFileId('https://example.com/page')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(extractGoogleDriveFileId('')).toBeNull()
  })

  it('should return null for malformed URL', () => {
    expect(extractGoogleDriveFileId('not a url')).toBeNull()
  })

  it('should handle long file IDs', () => {
    const longId = 'a'.repeat(50)
    expect(extractGoogleDriveFileId(`https://drive.google.com/file/d/${longId}/view`)).toBe(longId)
  })
})

describe('getGoogleDriveThumbnail', () => {
  it('should return correct thumbnail URL format', () => {
    expect(getGoogleDriveThumbnail('abc123')).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w400')
  })

  it('should work with any fileId string', () => {
    expect(getGoogleDriveThumbnail('xyz')).toBe('https://drive.google.com/thumbnail?id=xyz&sz=w400')
  })
})

describe('getGoogleDriveFileIcon', () => {
  it('should return folder icon for folder URLs', () => {
    expect(getGoogleDriveFileIcon('https://drive.google.com/drive/folders/abc')).toBe('📁')
  })

  it('should return spreadsheet icon for sheets URLs', () => {
    expect(getGoogleDriveFileIcon('https://docs.google.com/spreadsheets/d/abc')).toBe('📊')
    expect(getGoogleDriveFileIcon('https://example.com/spreadsheet')).toBe('📊')
  })

  it('should return document icon for docs URLs', () => {
    expect(getGoogleDriveFileIcon('https://docs.google.com/document/d/abc')).toBe('📄')
  })

  it('should return slides icon for presentation URLs', () => {
    expect(getGoogleDriveFileIcon('https://docs.google.com/presentation/d/abc')).toBe('📽️')
  })

  it('should return forms icon for forms URLs', () => {
    expect(getGoogleDriveFileIcon('https://docs.google.com/forms/d/abc')).toBe('📋')
  })

  it('should return default file icon for generic Drive files', () => {
    expect(getGoogleDriveFileIcon('https://drive.google.com/file/d/abc/view')).toBe('📎')
  })

  it('should be case-insensitive for URL matching', () => {
    expect(getGoogleDriveFileIcon('https://docs.google.com/SPREADSHEETS/d/abc')).toBe('📊')
    expect(getGoogleDriveFileIcon('https://docs.google.com/DOCUMENT/d/abc')).toBe('📄')
  })
})

describe('extractDomain', () => {
  it('should extract domain from standard URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com')
  })

  it('should strip www. prefix', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com')
  })

  it('should preserve subdomains other than www', () => {
    expect(extractDomain('https://docs.google.com/doc')).toBe('docs.google.com')
  })

  it('should handle http URLs', () => {
    expect(extractDomain('http://example.com')).toBe('example.com')
  })

  it('should return "Link" for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe('Link')
  })

  it('should return "Link" for empty string', () => {
    expect(extractDomain('')).toBe('Link')
  })
})

describe('isGoogleDriveLink', () => {
  it('should return true for drive.google.com URLs', () => {
    expect(isGoogleDriveLink('https://drive.google.com/file/d/abc')).toBe(true)
  })

  it('should return true for docs.google.com URLs', () => {
    expect(isGoogleDriveLink('https://docs.google.com/document/d/abc')).toBe(true)
  })

  it('should return false for other Google URLs', () => {
    expect(isGoogleDriveLink('https://www.google.com/search')).toBe(false)
  })

  it('should return false for non-Google URLs', () => {
    expect(isGoogleDriveLink('https://example.com')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isGoogleDriveLink('')).toBe(false)
  })
})

describe('getTitleFromUrl', () => {
  it('should extract last path segment as title', () => {
    expect(getTitleFromUrl('https://example.com/my-document')).toBe('my document')
  })

  it('should replace underscores and hyphens with spaces', () => {
    expect(getTitleFromUrl('https://example.com/my_great-file')).toBe('my great file')
  })

  it('should remove file extensions', () => {
    expect(getTitleFromUrl('https://example.com/document.pdf')).toBe('document')
  })

  it('should decode URI-encoded characters', () => {
    expect(getTitleFromUrl('https://example.com/my%20file')).toBe('my file')
  })

  it('should return domain for root URL with no path', () => {
    expect(getTitleFromUrl('https://example.com')).toBe('example.com')
  })

  it('should return "Resource Link" for invalid URL', () => {
    expect(getTitleFromUrl('not a url')).toBe('Resource Link')
  })

  it('should handle deeply nested paths', () => {
    expect(getTitleFromUrl('https://example.com/a/b/c/final-segment')).toBe('final segment')
  })
})
