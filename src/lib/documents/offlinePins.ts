/** Offline pin store for field Current Docs (Document Library Phase 4). */

const DB_NAME = 'britton-field-docs'
const STORE = 'pins'
const DB_VERSION = 1

export type PinnedDocument = {
  documentId: string
  jobId: string
  jobNumber: string
  title: string
  categoryName: string
  revLabel: string
  mimeType: string
  fileName: string
  pinnedAt: string
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'documentId' })
        store.createIndex('jobId', 'jobId', { unique: false })
      }
    }
  })
}

export async function pinDocumentOffline(pin: PinnedDocument): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(pin)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function unpinDocumentOffline(documentId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(documentId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPinnedDocument(documentId: string): Promise<PinnedDocument | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(documentId)
    req.onsuccess = () => resolve((req.result as PinnedDocument) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function listPinnedDocuments(jobId?: string): Promise<PinnedDocument[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = jobId ? store.index('jobId').getAll(jobId) : store.getAll()
    req.onsuccess = () => resolve((req.result as PinnedDocument[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function isDocumentPinned(documentId: string): Promise<boolean> {
  const pin = await getPinnedDocument(documentId)
  return Boolean(pin)
}

export function openPinnedBlob(pin: PinnedDocument) {
  const url = URL.createObjectURL(pin.blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  // Revoke after a delay so the new tab can load
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
