import { describe, expect, it } from 'vitest'
import { organizationBranches, type SundaySchoolOrganization, type OrganizationAssignment } from '@/lib/sunday-school-organization'

const person = (id: string) => ({ id, name: id, profileImageUrl: null })
const assignment = (id: string, authority: OrganizationAssignment['authority'], classId: string | null, ageGroupId: string | null = null): OrganizationAssignment => ({ user: person(id), authority, classId, ageGroupId })
const data: SundaySchoolOrganization = {
  academicYear: { id: 'year', name: '2026' },
  priests: [person('priest')],
  classes: [
    { id: 'first', name: 'First grade', level: 'GRADE_1' },
    { id: 'second', name: 'Second grade', level: 'GRADE_2' },
    { id: 'high', name: 'High school', level: 'GRADE_12' },
  ],
  ageGroups: [{ id: 'elementary', name: 'Elementary', levels: ['GRADE_1', 'GRADE_2'], overseerId: 'priest' }],
  assignments: [
    assignment('servant', 'SERVANT', 'first'),
    assignment('class-lead', 'COORDINATOR', 'first'),
    assignment('band-lead', 'COORDINATOR', null, 'elementary'),
    assignment('other-servant', 'SERVANT', 'high'),
  ],
}

describe('Sunday School organization', () => {
  it('connects a servant only to their class and its coordinators', () => {
    const branches = organizationBranches(data, 'servant')
    expect(branches.map(b => b.id)).toEqual(['first'])
    expect(branches[0].bandCoordinators.map(p => p.id)).toEqual(['band-lead'])
    expect(branches[0].classCoordinators.map(p => p.id)).toEqual(['class-lead'])
    expect(branches[0].servants.map(p => p.id)).toEqual(['servant'])
  })
  it('expands band coordination by grade without including another band', () => {
    expect(organizationBranches(data, 'band-lead').map(b => b.id)).toEqual(['first', 'second'])
  })
  it('shows only the teams assigned to a priest', () => {
      expect(organizationBranches(data, 'priest').map(branch => branch.id)).toEqual(['first', 'second'])
      expect(organizationBranches(data, 'servant')[0].overseer?.id).toBe('priest')
    })
    it('supports a different priest for another band and one priest across several bands', () => {
      const expanded = { ...data, priests: [...data.priests, person('other-priest')], ageGroups: [...data.ageGroups, { id: 'high-band', name: 'High', levels: ['GRADE_12' as const], overseerId: 'other-priest' }] }
      expect(organizationBranches(expanded, 'other-priest').map(branch => branch.id)).toEqual(['high'])
      expanded.ageGroups[1].overseerId = 'priest'
      expect(organizationBranches(expanded, 'priest')).toHaveLength(3)
    })
    it('does not infer oversight for unassigned or inactive priests', () => {
      expect(organizationBranches({ ...data, priests: [] }, 'servant')[0].overseer).toBeNull()
      expect(organizationBranches({ ...data, ageGroups: [] }, 'priest')).toEqual([])
    })
  it('keeps multiple assignments and roles separate and deduplicates people', () => {
    const branches = organizationBranches({ ...data, assignments: [...data.assignments,
      assignment('servant', 'SERVANT', 'first'), assignment('servant', 'COORDINATOR', 'high'),
    ] }, 'servant')
    expect(branches).toHaveLength(2)
    expect(branches[0].servants).toHaveLength(1)
    expect(branches[1].classCoordinators.map(p => p.id)).toEqual(['servant'])
    expect(branches[1].bandCoordinators).toEqual([])
  })
  it('supports coordinators of a band with no classes', () => {
    const branches = organizationBranches({ ...data, classes: [] }, 'band-lead')
    expect(branches[0].id).toBe('band-elementary')
  })
  it('does not infer assignments for unassigned people', () => {
    expect(organizationBranches(data, 'unassigned')).toEqual([])
  })
  it('does not use assignments to classes absent from the active directory', () => {
    expect(organizationBranches({ ...data, classes: [] }, 'servant')).toEqual([])
  })
})
