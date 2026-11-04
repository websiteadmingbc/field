import { getSupabase, isSupabaseConfigured } from './client'

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

/** True when blobKey looks like a Storage path (projectId/file.ext), not a local IndexedDB id. */
export function isStoragePhotoPath(blobKey: string): boolean {
  return blobKey.includes('/')
}

export async function getPhotoSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  const cached = signedUrlCache.get(storagePath)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url
  }

  const supabase = getSupabase()
  if (!supabase) return null

  const { data, error } = await supabase.storage
    .from('job-photos')
    .createSignedUrl(storagePath, 60 * 60) // 1 hour

  if (error || !data?.signedUrl) {
    console.error('Signed URL failed', storagePath, error)
    return null
  }

  signedUrlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + 55 * 60 * 1000,
  })
  return data.signedUrl
}

export function guessImageContentType(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.heic')) return 'image/heic'
  if (name.endsWith('.heif')) return 'image/heif'
  return 'image/jpeg'
}

export function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  // iOS camera/library sometimes omits MIME type
  if (!file.type) return true
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name)
}

export function extensionForImage(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName !== 'image') return fromName
  const type = guessImageContentType(file)
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/heic') return 'heic'
  if (type === 'image/heif') return 'heif'
  return 'jpg'
}
