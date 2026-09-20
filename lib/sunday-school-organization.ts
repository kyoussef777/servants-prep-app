import { SundaySchoolAuthority, SundaySchoolLevel } from '@prisma/client'

export interface OrganizationPerson {
  id: string
  name: string
  profileImageUrl: string | null
}

export interface OrganizationAssignment {
  user: OrganizationPerson
  authority: SundaySchoolAuthority
  classId: string | null
  ageGroupId: string | null
}

export interface SundaySchoolOrganization {
  academicYear: { id: string; name: string } | null
  priests: OrganizationPerson[]
  classes: { id: string; name: string; level: SundaySchoolLevel }[]
  ageGroups: { id: string; name: string; levels: SundaySchoolLevel[]; overseerId: string | null }[]
  assignments: OrganizationAssignment[]
}

export interface OrganizationBranch {
  id: string
  name: string
  ageGroupName: string | null
    overseer: OrganizationPerson | null
  bandCoordinators: OrganizationPerson[]
  classCoordinators: OrganizationPerson[]
  servants: OrganizationPerson[]
}

function people(assignments: OrganizationAssignment[]) {
  return [...new Map(assignments.map(a => [a.user.id, a.user])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Keep each scope separate: a person may serve one class and coordinate another.
export function organizationBranches(data: SundaySchoolOrganization, userId: string): OrganizationBranch[] {
  // Oversight is explicit per age group; priests do not automatically head every team.
  const coordinators = data.assignments.filter(a => a.authority === SundaySchoolAuthority.COORDINATOR)
  const branches: OrganizationBranch[] = data.classes.map(cls => {
    const band = data.ageGroups.find(group => group.levels.includes(cls.level))
    const direct = data.assignments.filter(a => a.classId === cls.id)
    return {
      id: cls.id,
      name: cls.name,
      ageGroupName: band?.name ?? null,
            overseer: data.priests.find(person => person.id === band?.overseerId) ?? null,
      bandCoordinators: people(coordinators.filter(a => !!band && a.ageGroupId === band.id)),
      classCoordinators: people(direct.filter(a => a.authority === SundaySchoolAuthority.COORDINATOR)),
      servants: people(direct.filter(a => a.authority === SundaySchoolAuthority.SERVANT)),
    }
  })

  // A band can have coordinators before its first class is created.
  for (const band of data.ageGroups) {
    if (!data.classes.some(cls => band.levels.includes(cls.level))) {
      branches.push({
        id: `band-${band.id}`, name: band.name, ageGroupName: band.name,
                overseer: data.priests.find(person => person.id === band.overseerId) ?? null,
        bandCoordinators: people(coordinators.filter(a => a.ageGroupId === band.id)),
        classCoordinators: [], servants: [],
      })
    }
  }

  return branches.filter(branch => branch.overseer?.id === userId ||
    [...branch.bandCoordinators, ...branch.classCoordinators, ...branch.servants]
      .some(person => person.id === userId))
}
