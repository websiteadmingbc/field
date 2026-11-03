import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, Users } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { useApp } from '../context/AppContext'
import { cn, emailHref, phoneHref } from '../lib/utils'

export function TeamPage() {
  const { data, getJob } = useApp()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'crew' | 'contacts'>('crew')

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.contacts
      .filter((c) => (tab === 'crew' ? c.isCrew : !c.isCrew))
      .filter((c) => {
        if (!q) return true
        return `${c.name} ${c.role} ${c.phone} ${c.email ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data.contacts, query, tab])

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Team Directory</h1>
        <p className="mt-1 text-ink-muted">
          Call or email crew and site contacts. No personal addresses or live locations.
        </p>
      </header>

      <div className="space-y-3 animate-fade-up stagger-1">
        <SearchInput value={query} onChange={setQuery} placeholder="Search by name or role…" />
        <div className="flex gap-2">
          {(
            [
              ['crew', 'Crew'],
              ['contacts', 'Site contacts'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold',
                tab === id
                  ? 'bg-teal-fill text-on-teal'
                  : 'border border-gold-line/40 bg-surface-raised text-ink-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No matches"
          description="Try another search term."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 animate-fade-up stagger-2">
          {people.map((person) => {
            const projects = (person.associatedJobIds ?? [])
              .map((id) => getJob(id))
              .filter(Boolean)
            return (
              <Card key={person.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gold-line/40 bg-teal-soft font-display text-sm font-bold uppercase text-teal">
                    {person.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{person.name}</p>
                    <p className="text-sm text-ink-muted">{person.role}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={phoneHref(person.phone)}>
                    <Button size="sm" variant="outline">
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </Button>
                  </a>
                  {person.email && (
                    <a href={emailHref(person.email)}>
                      <Button size="sm" variant="ghost">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </Button>
                    </a>
                  )}
                </div>
                {projects.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                      Projects
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {projects.slice(0, 4).map((job) => (
                        <li key={job!.id}>
                          <Link
                            to={`/jobs/${job!.id}`}
                            className="text-sm text-teal hover:underline"
                          >
                            {job!.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
