import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImageIcon } from 'lucide-react'
import { PhotoCapturePanel } from '../components/PhotoCapturePanel'
import { Card, SectionHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Lightbox } from '../components/ui/Lightbox'
import { PhotoThumb } from '../components/ui/PhotoThumb'
import { useApp } from '../context/AppContext'
import { cn } from '../lib/utils'
import type { JobPhoto, PhotoCategory } from '../types'

const categories: Array<{ id: PhotoCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'before', label: 'Before' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'progress', label: 'Progress' },
  { id: 'after', label: 'After' },
  { id: 'issue', label: 'Issue' },
]

export function PhotosPage() {
  const { data, getJob, refreshRemote, remote } = useApp()
  const [params, setParams] = useSearchParams()
  const jobFilter = params.get('job') ?? 'all'
  const [category, setCategory] = useState<PhotoCategory | 'all'>('all')
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null)

  const uploadJobId = jobFilter !== 'all' ? jobFilter : data.jobs[0]?.id ?? ''
  const uploadJob = getJob(uploadJobId)

  const photos = useMemo(() => {
    return data.photos
      .filter((p) => (jobFilter === 'all' ? true : p.jobId === jobFilter))
      .filter((p) => (category === 'all' ? true : p.category === category))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.photos, jobFilter, category])

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Photo library</h1>
        <p className="mt-1 text-ink-muted">
          Master library for all job photos. Every capture is tagged to a job so it also appears on
          that job.
        </p>
      </header>

      <Card className="relative p-5 animate-fade-up stagger-1">
        <SectionHeader title="Add a photo" subtitle="Tag job + type at capture time" />
        <PhotoCapturePanel
          jobId={uploadJobId}
          jobName={uploadJob?.name}
          lockedJob={jobFilter !== 'all'}
          defaultCategory={jobFilter !== 'all' ? 'progress' : 'before'}
          onUploaded={() => {
            if (uploadJobId) setParams({ job: uploadJobId })
            if (remote) void refreshRemote()
          }}
        />
      </Card>

      <div className="space-y-3 animate-fade-up stagger-2">
        <div className="flex flex-wrap gap-2">
          <select
            value={jobFilter}
            onChange={(e) =>
              setParams(e.target.value === 'all' ? {} : { job: e.target.value })
            }
            className="h-10 rounded-xl border border-border bg-surface-raised px-3 text-sm font-semibold"
          >
            <option value="all">All jobs</option>
            {data.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-semibold transition',
                category === c.id
                  ? 'bg-teal-fill text-on-teal'
                  : 'border border-gold-line/40 bg-surface-raised text-ink-muted',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {photos.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title="No photos here"
            description="Capture or upload a photo with a job selected to add it to the library."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => {
              const job = getJob(photo.jobId)
              return (
                <div key={photo.id} className="space-y-1.5">
                  <PhotoThumb photo={photo} onClick={() => setLightbox(photo)} />
                  <p className="truncate px-0.5 text-xs text-ink-muted">
                    <span className="capitalize">{photo.category}</span>
                    {job ? ` · ${job.name}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Lightbox
        key={lightbox?.id ?? 'closed'}
        photo={lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  )
}
