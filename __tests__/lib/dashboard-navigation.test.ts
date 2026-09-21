import { describe, expect, it } from 'vitest'
import { defaultDashboardPath } from '@/lib/dashboard-navigation'

describe('defaultDashboardPath', () => {
  it('routes each account type to its correct home', () => {
    expect(defaultDashboardPath('SERVANT')).toBe('/dashboard/servants')
    expect(defaultDashboardPath('PARENT')).toBe('/dashboard/parent')
    expect(defaultDashboardPath('STUDENT')).toBe('/dashboard/student')
    expect(defaultDashboardPath('MENTOR')).toBe('/dashboard/mentor')
    expect(defaultDashboardPath('SUPER_ADMIN')).toBe('/dashboard/admin')
  })
})
