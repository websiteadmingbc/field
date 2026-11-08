import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Mail, Phone } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { SearchInput } from '../components/ui/SearchInput'
import { useApp } from '../context/AppContext'
import { emailHref, phoneHref } from '../lib/utils'

/**
 * Customer contacts = project site contacts (homeowners, GCs, inspectors).
 * Kept separate from Team Directory (internal crew).
 */
export function CustomersPage() {
  const { data, getJob } = useApp()
  const [query, setQuery] = useState('')

  const customers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.contacts
      .filter((c) => !c.isCrew)
      .map((c) => {
        const jobs = (c.associatedJobIds ?? []).map((id) => getJob(id)).filter(Boolean)
        return { contact: c, jobs }
      })
      .filter(({ contact, jobs }) => {
        if (!q) return true
        const jobText = jobs.map((j) => `${j!.name} ${j!.jobNumber} ${j!.customer}`).join(' ')
        return `${contact.name} ${contact.role} ${contact.phone} ${contact.email ?? ''} ${jobText}`
          .toLowerCase()
          .includes(q)
      })
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name))
  }, [data.contacts, getJob, query])

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Customers</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Homeowners, clients, and other site contacts tied to jobs — not Great Britton crew.
        </p>
      </header>

      <div className="animate-fade-up stagger-1">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, role, or job…"
        />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title={query ? 'No matches' : 'No customer contacts yet'}
          description={
            query
              ? 'Try another search term.'
              : 'Add site contacts on a job in Operations → Projects.'
          }
        />
      ) : (
        <ul className="space-y-3 animate-fade-up stagger-2">
          {customers.map(({ contact, jobs }) => {
            const primaryJob = jobs[0]
            return (
              <li key={contact.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-ink">
                          {contact.name}
                        </h2>
                        <span className="text-xs font-semibold uppercase tracking-wider text-teal">
                          {contact.role || 'Customer'}
                        </span>
                      </div>

                      {primaryJob && (
                        <p className="mt-2 text-sm text-ink-muted">
                          <span className="font-semibold text-ink">
                            {primaryJob.customer || contact.name}
                          </span>
                          {primaryJob.customer && primaryJob.customer !== contact.name
                            ? ` · contact on file`
                            : null}
                        </p>
                      )}

                      <div className="mt-3 space-y-1.5">
                        {jobs.map((job) => (
                          <div key={job!.id} className="text-sm">
                            <Link
                              to={`/jobs/${job!.id}`}
                              className="font-semibold text-teal hover:underline"
                            >
                              {job!.jobNumber} — {job!.name}
                            </Link>
                            {(job!.address || job!.city) && (
                              <p className="text-ink-muted">
                                {[job!.address, job!.city, job!.state]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      {contact.phone && (
                        <a href={phoneHref(contact.phone)} className="sm:text-right">
                          <Button size="sm" variant="outline" className="w-full sm:w-auto">
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </Button>
                        </a>
                      )}
                      {contact.email && (
                        <a href={emailHref(contact.email)}>
                          <Button size="sm" variant="ghost" className="w-full sm:w-auto">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
