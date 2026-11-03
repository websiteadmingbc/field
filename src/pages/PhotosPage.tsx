import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, ImageIcon, Upload } from 'lucide-react'
import { Button } from '../components/ui/Button'
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
  { id: 'progress', label: 'Progress' },
  { id: 'after', label: 'After' },
  { id: 'issue', label: 'Issue' },
]

export function PhotosPage() {
  const { data, addPhoto, getJob } = useApp()
  const [params, setParams] = useSearchParams()
  const jobFilter = params.get('job') ?? 'all'
  const [category, setCategory] = useState<PhotoCategory | 'all'>('all')
  const [caption, setCaption] = useState('')
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>('progress')
  const [uploadJobId, setUploadJobId] = useState(jobFilter !== 'all' ? jobFilter : data.jobs[0]?.id ?? '')
  const [lightbox, setLightbox] = useState<JobPhoto | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const photos = useMemo(() => {
    return data.photos
      .filter((p) => (jobFilter === 'all' ? true : p.jobId === jobFilter))
      .filter((p) => (category === 'all' ? true : p.category === category))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.photos, jobFilter, category])

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !uploadJobId) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        await addPhoto({
          jobId: uploadJobId,
          file,
          category: uploadCategory,
          caption: caption.trim(),
        })
      }
      setCaption('')
      setParams(uploadJobId ? { job: uploadJobId } : {})
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Photos</h1>
        <p className="mt-1 text-ink-muted">
          Document sites when it helps the crew. Upload is optional — photos stay on this device.
        </p>
      </header>

      <Card className="p-5 animate-fade-up stagger-1">
        <SectionHeader title="Add a photo" subtitle="From your library or camera" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Job</span>
            <select
              value={uploadJobId}
              onChange={(e) => setUploadJobId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border px-3"
            >
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold">Category</span>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as PhotoCategory)}
              className="h-11 w-full rounded-xl border border-border px-3 capitalize"
            >
              {categories
                .filter((c) => c.id !== 'all')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1.5 block font-semibold">Caption (optional)</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What does this show?"
            className="h-11 w-full rounded-xl border border-border px-3"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
            Upload photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
            Take photo
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
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
            description="Upload a photo or switch filters to see demo gallery images."
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
