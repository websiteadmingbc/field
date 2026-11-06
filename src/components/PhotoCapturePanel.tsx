import { useRef, useState } from 'react'
import { Camera, Upload } from 'lucide-react'
import { Button } from './ui/Button'
import { useApp } from '../context/AppContext'
import { isLikelyImageFile } from '../lib/supabase/photos'
import type { PhotoCategory } from '../types'

const categories: Array<{ id: PhotoCategory; label: string }> = [
  { id: 'before', label: 'Before' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'progress', label: 'Progress' },
  { id: 'after', label: 'After' },
  { id: 'issue', label: 'Issue' },
]

const visuallyHiddenFileInput =
  'absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 opacity-0'
const fileInputStyle = {
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  margin: '-1px',
} as const

/**
 * Capture/upload into the master photo library, always tagged to one project.
 * Job is required — that association is what makes the photo appear on the project.
 */
export function PhotoCapturePanel({
  jobId,
  jobName,
  lockedJob = false,
  defaultCategory = 'progress',
  onUploaded,
}: {
  jobId: string
  jobName?: string
  /** When true, user cannot change the project (e.g. capturing from job detail). */
  lockedJob?: boolean
  defaultCategory?: PhotoCategory
  onUploaded?: () => void
}) {
  const { data, addPhoto } = useApp()
  const [selectedJobId, setSelectedJobId] = useState(jobId)
  const [category, setCategory] = useState<PhotoCategory>(defaultCategory)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const activeJobId = lockedJob ? jobId : selectedJobId
  const activeJob = data.jobs.find((j) => j.id === activeJobId)

  async function handleFiles(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return
    if (!activeJobId) {
      setError('Select a project before capturing. Photos are stored in the library and linked to that job.')
      return
    }
    setError(null)
    setNotice(null)
    setUploading(true)
    try {
      let saved = 0
      for (const file of Array.from(files)) {
        if (!isLikelyImageFile(file)) continue
        await addPhoto({
          jobId: activeJobId,
          file,
          category,
          caption: caption.trim(),
        })
        saved += 1
      }
      if (saved === 0) {
        setError('No image was selected.')
      } else {
        setCaption('')
        setNotice(
          `${saved} photo${saved === 1 ? '' : 's'} saved to the library and linked to ${
            activeJob?.name ?? 'this project'
          }.`,
        )
        onUploaded?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (input) input.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Photos live in one library. Tag the <span className="font-semibold text-ink">project</span> and{' '}
        <span className="font-semibold text-ink">type</span> when you capture so they show on that job
        automatically.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Project</span>
          {lockedJob ? (
            <div className="flex h-11 items-center rounded-xl border border-gold-line/50 bg-teal-soft px-3 text-sm font-semibold text-teal">
              {jobName ?? activeJob?.name ?? 'This project'}
            </div>
          ) : (
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border px-3"
            >
              <option value="">Select a project…</option>
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Photo tag</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PhotoCategory)}
            className="h-11 w-full rounded-xl border border-border px-3 capitalize"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold">Caption (optional)</span>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What does this show?"
          className="h-11 w-full rounded-xl border border-border px-3"
        />
      </label>

      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-emerald/30 bg-emerald-soft px-3 py-2 text-sm text-emerald">
          {notice}
        </p>
      )}

      <div className="relative flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !activeJobId}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload photo'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading || !activeJobId}
        >
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/heic,image/heif,.heic,.heif"
          multiple
          className={visuallyHiddenFileInput}
          style={fileInputStyle}
          onChange={(e) => void handleFiles(e.target.files, e.target)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={visuallyHiddenFileInput}
          style={fileInputStyle}
          onChange={(e) => void handleFiles(e.target.files, e.target)}
        />
      </div>
    </div>
  )
}
