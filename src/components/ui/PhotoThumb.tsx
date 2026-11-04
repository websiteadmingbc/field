import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { createPlaceholderBlob, getPhotoBlob, savePhotoBlob } from '../../lib/idb'
import { getPhotoSignedUrl, isStoragePhotoPath } from '../../lib/supabase/photos'
import type { JobPhoto } from '../../types'
import { cn } from '../../lib/utils'

const urlCache = new Map<string, string>()

async function resolvePhotoUrl(photo: JobPhoto): Promise<string | null> {
  try {
    if (isStoragePhotoPath(photo.blobKey)) {
      return await getPhotoSignedUrl(photo.blobKey)
    }

    const existing = await getPhotoBlob(photo.blobKey)
    if (existing) {
      const objectUrl = URL.createObjectURL(existing)
      return objectUrl
    }

    if (photo.placeholderColor && photo.placeholderLabel) {
      const blob = await createPlaceholderBlob(photo.placeholderColor, photo.placeholderLabel)
      await savePhotoBlob(photo.blobKey, blob)
      return URL.createObjectURL(blob)
    }
  } catch (err) {
    console.error('Failed to resolve photo', err)
    return null
  }
  return null
}

function cachedUrl(blobKey: string | undefined): string | null {
  if (!blobKey) return null
  return urlCache.get(blobKey) ?? null
}

export function usePhotoUrl(photo: JobPhoto | undefined): {
  url: string | null
  loading: boolean
} {
  const blobKey = photo?.blobKey
  const [url, setUrl] = useState<string | null>(() => cachedUrl(blobKey))
  const [loading, setLoading] = useState(() => Boolean(photo && !cachedUrl(blobKey)))

  useEffect(() => {
    if (!photo || !blobKey) {
      setUrl(null)
      setLoading(false)
      return
    }

    const existing = cachedUrl(blobKey)
    if (existing) {
      setUrl(existing)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    void resolvePhotoUrl(photo).then((resolved) => {
      if (!resolved) {
        if (active) {
          setUrl(null)
          setLoading(false)
        }
        return
      }

      let next = urlCache.get(blobKey)
      if (!next) {
        next = resolved
        urlCache.set(blobKey, next)
      }

      if (active) {
        setUrl(next)
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [blobKey, photo])

  return { url, loading }
}

export function PhotoThumb({
  photo,
  className,
  onClick,
}: {
  photo: JobPhoto
  className?: string
  onClick?: () => void
}) {
  const { url, loading } = usePhotoUrl(photo)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative aspect-[4/3] overflow-hidden rounded-xl bg-charcoal-muted text-left',
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={photo.caption || 'Job photo'}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/50">
          <ImageIcon className={cn('h-8 w-8', loading && 'animate-pulse')} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <p className="truncate text-xs font-medium text-white">{photo.caption || 'Untitled'}</p>
      </div>
    </button>
  )
}
