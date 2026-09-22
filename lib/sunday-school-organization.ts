import { SundaySchoolAuthority, SundaySchoolLevel } from '@prisma/client'
import {
  compareAgeGroupsByLevel,
  compareClassesByLevelAndName,
} from '@/lib/sunday-school-class'

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

export interface OrganizationClassTeam {
  id: string
  name: string
  classCoordinators: OrganizationPerson[]
  servants: OrganizationPerson[]
}

export interface OrganizationBand {
  id: string
  name: string
  overseer: OrganizationPerson | null
  bandCoordinators: OrganizationPerson[]
  classes: OrganizationClassTeam[]
}

function people(assignments: OrganizationAssignment[]) {
  return [...new Map(assignments.map(a => [a.user.id, a.user])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Builds the chart around reporting levels instead of repeating the priest and
 * age-group coordinator once for every class. Each band is one branch beneath
 * its priest, and its classes fan out beneath the band coordinator.
 */
export function organizationBands(data: SundaySchoolOrganization, userId: string): OrganizationBand[] {
  const coordinatorAssignments = data.assignments.filter(
    assignment => assignment.authority === SundaySchoolAuthority.COORDINATOR
  )

  const bands: OrganizationBand[] = [...data.ageGroups].sort(compareAgeGroupsByLevel).map(ageGroup => ({
    id: ageGroup.id,
    name: ageGroup.name,
    overseer: data.priests.find(person => person.id === ageGroup.overseerId) ?? null,
    bandCoordinators: people(
      coordinatorAssignments.filter(assignment => assignment.ageGroupId === ageGroup.id)
    ),
    classes: data.classes
      .filter(cls => ageGroup.levels.includes(cls.level))
      .sort(compareClassesByLevelAndName)
      .map(cls => {
        const direct = data.assignments.filter(assignment => assignment.classId === cls.id)
        return {
          id: cls.id,
          name: cls.name,
          classCoordinators: people(
            direct.filter(assignment => assignment.authority === SundaySchoolAuthority.COORDINATOR)
          ),
          servants: people(
            direct.filter(assignment => assignment.authority === SundaySchoolAuthority.SERVANT)
          ),
        }
      }),
  }))

  // Keep an ungrouped class independently discoverable without making its
  // people appear related to other classes that also lack an age group.
  for (const cls of [...data.classes].sort(compareClassesByLevelAndName)) {
    if (data.ageGroups.some(ageGroup => ageGroup.levels.includes(cls.level))) continue
    const direct = data.assignments.filter(assignment => assignment.classId === cls.id)
    bands.push({
      id: `class-${cls.id}`,
      name: 'No age group',
      overseer: null,
      bandCoordinators: [],
      classes: [{
        id: cls.id,
        name: cls.name,
        classCoordinators: people(
          direct.filter(assignment => assignment.authority === SundaySchoolAuthority.COORDINATOR)
        ),
        servants: people(
          direct.filter(assignment => assignment.authority === SundaySchoolAuthority.SERVANT)
        ),
      }],
    })
  }

  return bands.flatMap(band => {
    const leadsBand = band.overseer?.id === userId ||
      band.bandCoordinators.some(person => person.id === userId)
    const assignedClasses = band.classes.filter(team =>
      [...team.classCoordinators, ...team.servants].some(person => person.id === userId)
    )

    if (!leadsBand && assignedClasses.length === 0) return []
    return [{ ...band, classes: leadsBand ? band.classes : assignedClasses }]
  })
}

// Keep each scope separate: a person may serve one class and coordinate another.
export function organizationBranches(data: SundaySchoolOrganization, userId: string): OrganizationBranch[] {
  return organizationBands(data, userId).flatMap(band =>
    band.classes.length > 0
      ? band.classes.map(team => ({
          id: team.id,
          name: team.name,
          ageGroupName: band.name === 'No age group' ? null : band.name,
          overseer: band.overseer,
          bandCoordinators: band.bandCoordinators,
          classCoordinators: team.classCoordinators,
          servants: team.servants,
        }))
      : [{
          id: `band-${band.id}`,
          name: band.name,
          ageGroupName: band.name,
          overseer: band.overseer,
          bandCoordinators: band.bandCoordinators,
          classCoordinators: [],
          servants: [],
        }]
  )
}
