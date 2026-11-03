import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, MapPin, Navigation, Phone, Users } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatTime, fullAddress, phoneHref } from '../lib/utils'
import type { Job } from '../types'
import { LocationDetailsModal } from './LocationDetailsModal'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { StatusBadge } from './ui/StatusBadge'

export function JobCard({
  job,
  showCrew = false,
  compact = false,
}: {
  job: Job
  showCrew?: boolean
  compact?: boolean
}) {
  const { getContact } = useApp()
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const contact = getContact(job.primaryContactId)
  const crew = job.assignedCrewIds.map((id) => getContact(id)?.name).filter(Boolean)

  return (
    <>
      <Card className="overflow-hidden transition hover:border-border-strong animate-fade-up">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
                {job.jobNumber}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold uppercase tracking-wide text-ink">
                {job.name}
              </h3>
              <p className="mt-0.5 text-sm text-ink-muted">{job.customer}</p>
            </div>
            <StatusBadge status={job.status} />
          </div>

          <div className="mt-4 space-y-2 text-sm text-ink-muted">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
              <span>{fullAddress(job)}</span>
            </div>
            {!compact && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-ink-subtle" />
                <span>
                  {formatTime(job.startTime)} · {job.type}
                </span>
              </div>
            )}
            {contact && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-ink-subtle" />
                <span>
                  {contact.name}
                  <span className="text-ink-subtle"> · {contact.role}</span>
                </span>
              </div>
            )}
            {showCrew && crew.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                <span>{crew.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={`/jobs/${job.id}`} className="inline-flex text-inherit no-underline">
              <Button size="sm">View Job</Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setDirectionsOpen(true)}>
              <Navigation className="h-4 w-4" />
              Directions
            </Button>
            {contact && (
              <a href={phoneHref(contact.phone)} className="inline-flex text-inherit no-underline">
                <Button size="sm" variant="outline">
                  <Phone className="h-4 w-4" />
                  Contact
                </Button>
              </a>
            )}
          </div>
        </div>
      </Card>

      <LocationDetailsModal
        job={directionsOpen ? job : null}
        onClose={() => setDirectionsOpen(false)}
      />
    </>
  )
}
