import { RoleTag, UserRole } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { getRoleDisplayName } from '@/lib/roles'
import { getRoleTagDisplayName } from '@/lib/role-tags'

const TAG_STYLES: Record<RoleTag, string> = {
  SUPER_ADMIN: 'border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-200',
  PRIEST: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200',
  SERVANTS_PREP_SERVANT: 'border-green-300 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200',
  SERVANTS_PREP_STUDENT: 'border-slate-300 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  SUNDAY_SCHOOL_SERVANT: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200',
  SUNDAY_SCHOOL_STUDENT: 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200',
  PARENT: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
}

export function UserRoleTagBadges({ tags, legacyRole }: { tags: RoleTag[]; legacyRole: UserRole }) {
  if (tags.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Legacy: {getRoleDisplayName(legacyRole)}
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className={`whitespace-nowrap text-[10px] ${TAG_STYLES[tag]}`}>
          {getRoleTagDisplayName(tag)}
        </Badge>
      ))}
    </div>
  )
}
