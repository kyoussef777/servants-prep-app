import { describe, expect, it } from 'vitest'
import { organizationBands, organizationBranches, type SundaySchoolOrganization, type OrganizationAssignment } from '@/lib/sunday-school-organization'

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
  it('groups classes beneath one age-group coordinator instead of repeating the chain', () => {
    const bands = organizationBands(data, 'priest')

    expect(bands).toHaveLength(1)
    expect(bands[0].overseer?.id).toBe('priest')
    expect(bands[0].bandCoordinators.map(person => person.id)).toEqual(['band-lead'])
    expect(bands[0].classes.map(team => team.id)).toEqual(['first', 'second'])
  })
  it('orders age groups and their classes by grade instead of alphabetically', () => {
    const gradeOrderedData: SundaySchoolOrganization = {
      ...data,
      classes: [
        { id: 'grade-10', name: '10th Grade', level: 'GRADE_10' },
        { id: 'grade-11', name: '11th Grade', level: 'GRADE_11' },
        { id: 'grade-12', name: '12th Grade', level: 'GRADE_12' },
        { id: 'grade-9', name: '9th Grade', level: 'GRADE_9' },
        { id: 'grade-6', name: '6th Grade', level: 'GRADE_6' },
        { id: 'grade-1', name: '1st Grade', level: 'GRADE_1' },
      ],
      ageGroups: [
        {
          id: 'high',
          name: 'High School',
          levels: ['GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12'],
          overseerId: 'priest',
        },
        {
          id: 'elementary',
          name: 'Elementary',
          levels: ['GRADE_1'],
          overseerId: 'priest',
        },
        {
          id: 'middle',
          name: 'Middle School',
          levels: ['GRADE_6'],
          overseerId: 'priest',
        },
      ],
    }

    const bands = organizationBands(gradeOrderedData, 'priest')

    expect(bands.map(band => band.name)).toEqual([
      'Elementary',
      'Middle School',
      'High School',
    ])
    expect(bands[2].classes.map(team => team.name)).toEqual([
      '9th Grade',
      '10th Grade',
      '11th Grade',
      '12th Grade',
    ])
  })
  it('keeps an individual servant focused on their own class', () => {
    const bands = organizationBands(data, 'servant')

    expect(bands).toHaveLength(1)
    expect(bands[0].classes.map(team => team.id)).toEqual(['first'])
    expect(bands[0].overseer?.id).toBe('priest')
    expect(bands[0].bandCoordinators.map(person => person.id)).toEqual(['band-lead'])
  })
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
