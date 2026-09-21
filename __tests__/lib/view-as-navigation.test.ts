import { afterEach, describe, expect, it } from 'vitest'
import {
  consumeViewAsReturnPath,
  rememberViewAsReturnPath,
  safeViewAsReturnPath,
} from '@/lib/view-as-navigation'

describe('View as return navigation', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(window.history.state, '', '/')
  })

  it('remembers the exact dashboard path, query, and hash for this tab', () => {
    window.history.replaceState(
      window.history.state,
      '',
      '/dashboard/servants/classes?year=current#middle-school'
    )

    rememberViewAsReturnPath()

    expect(consumeViewAsReturnPath('/dashboard/admin')).toBe(
      '/dashboard/servants/classes?year=current#middle-school'
    )
    expect(window.sessionStorage.getItem('view-as-return-path')).toBeNull()
  })

  it('rejects external and non-portal return destinations', () => {
    expect(safeViewAsReturnPath('//example.com/dashboard')).toBeNull()
    expect(safeViewAsReturnPath('/\\example.com/dashboard')).toBeNull()
    expect(safeViewAsReturnPath('/login')).toBeNull()
    expect(safeViewAsReturnPath('/dashboard-elsewhere')).toBeNull()
    expect(safeViewAsReturnPath('/dashboard')).toBe('/dashboard')
    expect(safeViewAsReturnPath('/dashboard/servants')).toBe('/dashboard/servants')
    expect(safeViewAsReturnPath('/settings')).toBe('/settings')
  })
})
