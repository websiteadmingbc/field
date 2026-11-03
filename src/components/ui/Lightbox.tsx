import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, X } from 'lucide-react'
import type { JobPhoto } from '../../types'
import { usePhotoUrl } from './PhotoThumb'

export function Lightbox({
  photo,
  onClose,
}: {
  photo: JobPhoto | null
  onClose: () => void
}) {
  const { url, loading } = usePhotoUrl(photo ?? undefined)

  useEffect(() => {
    if (!photo) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [photo, onClose])

  if (!photo || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || 'Photo viewer'}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative max-h-[85vh] w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {url ? (
          <img
            src={url}
            alt={photo.caption || 'Job photo'}
            className="mx-auto max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl bg-[#171717] px-6 text-center text-white/80">
            {loading ? (
              <>
                <LoaderCircle className="h-8 w-8 animate-spin text-[#d4af37]" />
                <p className="mt-3 text-sm">Loading photo…</p>
              </>
            ) : (
              <p className="text-sm">
                Photo unavailable. Try Reset Demo Data if this is a sample image.
              </p>
            )}
          </div>
        )}
        {photo.caption && (
          <p className="mt-3 text-center text-sm text-white/90">{photo.caption}</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
