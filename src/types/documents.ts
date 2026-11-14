/** Job Document Library (Phases 1–4). Phase 1 uses active + trashed. */

export type DocumentScope = 'job' | 'company'
export type DocumentVisibility = 'internal' | 'crew' | 'shared'
export type DocumentStatus = 'active' | 'archived' | 'trashed'
export type DocumentScanStatus = 'pending' | 'available' | 'quarantined' | 'failed'
export type DocumentEventAction =
  | 'upload'
  | 'view'
  | 'download'
  | 'export'
  | 'archive'
  | 'restore'
  | 'trash'
  | 'purge'
  | 'hold_on'
  | 'hold_off'
  | 'metadata_edit'

export type DocumentCategory = {
  id: string
  scope: DocumentScope
  name: string
  code: string
  default_visibility: DocumentVisibility
  versioned: boolean
  retention_years: number
  field_visible: boolean
  sort_order: number
}

export type DocumentVersion = {
  id: string
  document_id: string
  rev_label: string
  storage_path: string
  file_name_original: string
  mime_type: string
  size_bytes: number
  sha256: string | null
  scan_status: DocumentScanStatus
  page_count: number | null
  extracted_text: string | null
  superseded_at: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export type LibraryDocument = {
  id: string
  job_id: string
  category_id: string
  title: string
  doc_number: string
  visibility: DocumentVisibility
  status: DocumentStatus
  current_version_id: string | null
  legal_hold: boolean
  retain_until: string | null
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  trashed_at: string | null
  category?: DocumentCategory | null
  current_version?: DocumentVersion | null
}

export type DocumentEvent = {
  id: string
  document_id: string
  version_id: string | null
  actor_id: string | null
  action: DocumentEventAction
  details: Record<string, unknown>
  created_at: string
}

export const DOCUMENT_VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  internal: 'Internal (office only)',
  crew: 'Crew (assigned to job)',
  shared: 'Shared (named people)',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  active: 'Active',
  archived: 'Archived',
  trashed: 'Trash',
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'application/octet-stream',
] as const

export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024
export const MAX_IMPORT_BATCH = 100

/** Guess category code from filename heuristics (Phase 1 smart defaults). */
export function guessCategoryCode(fileName: string): string | null {
  const n = fileName.toLowerCase()
  if (/\b(co|change[\s_-]?order)\b/.test(n) || n.includes('change-order')) return 'CO'
  if (/\brfi\b/.test(n)) return 'RFI'
  if (/permit|inspection/.test(n)) return 'PERMIT'
  if (/drawing|plan|sheet|dwg/.test(n)) return 'DWG'
  if (/spec/.test(n)) return 'SPEC'
  if (/submittal|shop[\s_-]?draw/.test(n)) return 'SUB'
  if (/invoice|lien|waiver|pay[\s_-]?app/.test(n)) return 'INV'
  if (/contract|agreement|subcontract/.test(n)) return 'CONTRACT'
  if (/estimate|proposal|bid/.test(n)) return 'EST'
  if (/safety|jha|toolbox|incident/.test(n)) return 'SAFETY'
  if (/warranty|closeout|as[\s_-]?built|punch/.test(n)) return 'CLOSE'
  if (/\.(jpe?g|png|heic|webp|gif|mp4)$/i.test(n)) return 'PHOTO'
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Categories archived when a job is marked completed (working docs). Closeout stays active. */
export const JOB_COMPLETION_ARCHIVE_CODES = ['RFI', 'SUB', 'LOG', 'CORR', 'PHOTO'] as const

export function nextRevLabel(current: string | null | undefined): string {
  const m = /R(\d+)/i.exec(current ?? 'R0')
  const n = m ? Number(m[1]) + 1 : 1
  return `R${n}`
}

export function isRetentionSatisfied(retainUntil: string | null | undefined, now = new Date()): boolean {
  if (!retainUntil) return true
  const end = new Date(`${retainUntil}T23:59:59`)
  return end.getTime() <= now.getTime()
}

export function addYearsToDate(isoDate: string, years: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setFullYear(d.getFullYear() + years)
  return d.toISOString().slice(0, 10)
}
