'use client'

import { useState } from 'react'
import { ArrowLeft, Network, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSundaySchoolOrganization } from '@/lib/swr'
import { organizationBranches, type OrganizationPerson } from '@/lib/sunday-school-organization'
import { cn } from '@/lib/utils'

function PersonCard({ person, label, selectedId, onSelect }: {
  person: OrganizationPerson
  label: string
  selectedId: string
  onSelect: (person: OrganizationPerson) => void
}) {
  const selected = selectedId === person.id
  return (
    <button type="button" onClick={() => onSelect(person)}
      aria-label={`View ${person.name}'s organization, ${label}`} aria-pressed={selected}
      className={cn(
        'flex w-full max-w-64 items-center gap-3 rounded-xl border bg-background p-3 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        selected && 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/40',
      )}>
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={person.profileImageUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
          {person.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold">{person.name}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        {selected && <span className="block text-xs font-medium text-indigo-700 dark:text-indigo-300">Selected person</span>}
      </span>
    </button>
  )
}

function Connector() {
  return <div aria-hidden="true" className="mx-auto h-6 w-px bg-indigo-300 dark:bg-indigo-700" />
}

export function UserOrganizationDialog({ user, onClose }: { user: OrganizationPerson; onClose: () => void }) {
  const { data, error, isLoading, mutate } = useSundaySchoolOrganization()
  const [history, setHistory] = useState<OrganizationPerson[]>([user])
  const selected = history[history.length - 1]
  const branches = data ? organizationBranches(data, selected.id) : []
  const isPriest = data?.priests.some(person => person.id === selected.id)
  const selectPerson = (person: OrganizationPerson) => {
    if (person.id !== selected.id) setHistory(previous => [...previous, person])
  }
  const cards = (people: OrganizationPerson[], label: string, empty: string) => (
    <div className="flex flex-wrap justify-center gap-3">
      {people.length ? people.map(person => (
        <PersonCard key={person.id} person={person} label={label} selectedId={selected.id} onSelect={selectPerson} />
      )) : <p className="rounded-lg border border-dashed px-4 py-3 text-center text-xs text-muted-foreground">{empty}</p>}
    </div>
  )

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2"><Network className="h-5 w-5 text-indigo-600" />Organization</DialogTitle>
          <DialogDescription>Sunday School · {data?.academicYear?.name ?? 'Current academic year'}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
          {history.length > 1 && <Button variant="ghost" size="sm" onClick={() => setHistory(previous => previous.slice(0, -1))}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>}
          <p className="min-w-0 flex-1 break-words text-sm">Organization for <strong>{selected.name}</strong></p>
          {history.length > 1 && <Button variant="ghost" size="sm" onClick={() => setHistory([user])}>Reset</Button>}
        </div>
        <div className="min-h-0 overflow-y-auto bg-muted/30 p-4 sm:p-6" aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading organization…</p>
          ) : error ? (
            <div role="alert" className="space-y-3 py-12 text-center"><p>Unable to load the organization chart.</p><Button variant="outline" onClick={() => void mutate()}>Try again</Button></div>
          ) : !data?.academicYear ? (
            <p className="py-12 text-center text-muted-foreground">No active academic year. The organization chart will appear once a year is activated.</p>
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <PersonCard person={selected} label={isPriest ? "No groups assigned" : "No active assignment"} selectedId={selected.id} onSelect={selectPerson} />
              <p className="max-w-md text-sm text-muted-foreground">This person has no assignment to an active Sunday School class or age group for {data.academicYear.name}. Disabled accounts are not included in the active organization.</p>
            </div>
          ) : (
            <>
              <p className="text-center text-xs text-muted-foreground">Priest overseer → Age-group coordinators → Class coordinators → Servants</p>
              {branches.length > 0 ? (
                <>
                  <Connector />
                  <div className="flex items-center justify-center gap-2 pb-4 text-xs text-muted-foreground"><Users className="h-4 w-4" />{branches.length} {branches.length === 1 ? 'team' : 'teams'} · Select a person to explore</div>
                  <div className={cn('grid gap-5', branches.length > 1 && 'lg:grid-cols-2')}>
                    {branches.map(branch => (
                      <section key={branch.id} aria-label={`${branch.name} reporting chain`} className="min-w-0 rounded-2xl border bg-background/60 p-4">
                        <div className="mb-4 text-center"><h3 className="font-semibold">{branch.name}</h3>{branch.ageGroupName && branch.ageGroupName !== branch.name && <p className="text-xs text-muted-foreground">{branch.ageGroupName}</p>}</div>
                        <h4 className="mb-2 text-center text-xs font-medium text-muted-foreground">Priest overseer</h4>
                        {cards(branch.overseer ? [branch.overseer] : [], 'Priest overseer', 'No priest overseer assigned')}
                        <Connector />
                        <h4 className="mb-2 text-center text-xs font-medium text-muted-foreground">Age-group coordinators</h4>
                        {cards(branch.bandCoordinators, 'Age-group coordinator', branch.ageGroupName ? 'No age-group coordinator assigned' : 'No age group configured')}
                        <Connector />
                        <h4 className="mb-2 text-center text-xs font-medium text-muted-foreground">Class coordinators</h4>
                        {cards(branch.classCoordinators, 'Class coordinator', 'No class coordinator assigned')}
                        <Connector />
                        <h4 className="mb-2 text-center text-xs font-medium text-muted-foreground">Servants</h4>
                        {cards(branch.servants, 'Servant', 'No servants assigned')}
                      </section>
                    ))}
                  </div>
                </>
              ) : <p className="py-8 text-center text-sm text-muted-foreground">No active Sunday School teams yet.</p>}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
