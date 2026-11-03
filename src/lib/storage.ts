import { createDemoData } from '../data/demoData'
import type { AppData } from '../types'
import { DATA_VERSION, STORAGE_KEY } from '../types'
import {
  clearAllPhotoBlobs,
  createPlaceholderBlob,
  getPhotoBlob,
  savePhotoBlob,
} from './idb'

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDemoData()
    const parsed = JSON.parse(raw) as AppData
    if (parsed.version !== DATA_VERSION) return createDemoData()
    return parsed
  } catch {
    return createDemoData()
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export async function seedDemoPhotoBlobs(data: AppData): Promise<void> {
  await Promise.all(
    data.photos.map(async (photo) => {
      if (!photo.placeholderColor || !photo.placeholderLabel) return
      try {
        const existing = await getPhotoBlob(photo.blobKey)
        if (existing) return
        const blob = await createPlaceholderBlob(photo.placeholderColor, photo.placeholderLabel)
        await savePhotoBlob(photo.blobKey, blob)
      } catch {
        // Ignore seed failures in restrictive environments
      }
    }),
  )
  localStorage.setItem('britton-field-photos-seeded', '1')
}

export async function resetDemoData(): Promise<AppData> {
  await clearAllPhotoBlobs()
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('britton-field-photos-seeded')
  const data = createDemoData()
  saveAppData(data)
  await seedDemoPhotoBlobs(data)
  return data
}
