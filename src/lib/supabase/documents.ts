import { getSupabase } from './client'
import type {
  DocumentCategory,
  DocumentEvent,
  DocumentEventAction,
  DocumentStatus,
  DocumentVisibility,
  DocumentVersion,
  LibraryDocument,
} from '../../types/documents'
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMPORT_BATCH,
  guessCategoryCode,
} from '../../types/documents'

const BUCKET = 'documents'

export type LibraryDocumentRow = LibraryDocument & {
  document_categories?: DocumentCategory | DocumentCategory[] | null
  current_version?: DocumentVersion | DocumentVersion[] | null
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapDocument(row: LibraryDocumentRow): LibraryDocument {
  const category = unwrapOne(row.document_categories) ?? row.category ?? null
  const current_version = unwrapOne(row.current_version) ?? null
  const { document_categories: _c, ...rest } = row
  return {
    ...rest,
    tags: Array.isArray(row.tags) ? row.tags : [],
    category,
    current_version,
  }
}

async function sha256Hex(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return null
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180)
}

function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name
}

export async function fetchDocumentCategories(scope: 'job' | 'company' = 'job') {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
    .eq('scope', scope)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as DocumentCategory[]
}

export type FetchJobDocumentsOpts = {
  status?: DocumentStatus | 'all_managed'
  categoryId?: string | null
  visibility?: DocumentVisibility | null
  query?: string
  /** Field mode: only active crew/shared docs in field-visible categories */
  fieldMode?: boolean
}

async function attachVersions(rows: LibraryDocument[]): Promise<LibraryDocument[]> {
  const versionIds = rows.map((r) => r.current_version_id).filter(Boolean) as string[]
  if (versionIds.length === 0) return rows
  const supabase = getSupabase()
  if (!supabase) return rows
  const { data } = await supabase.from('document_versions').select('*').in('id', versionIds)
  const byId = new Map(((data ?? []) as DocumentVersion[]).map((v) => [v.id, v]))
  return rows.map((r) => ({
    ...r,
    current_version: r.current_version_id ? byId.get(r.current_version_id) ?? null : null,
  }))
}

export async function fetchJobDocuments(
  jobId: string,
  opts: FetchJobDocumentsOpts = {},
): Promise<LibraryDocument[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  let q = supabase
    .from('documents')
    .select(`*, document_categories (*)`)
    .eq('job_id', jobId)
    .order('updated_at', { ascending: false })

  if (opts.fieldMode) {
    q = q.eq('status', 'active').in('visibility', ['crew', 'shared'])
  } else if (opts.status === 'all_managed') {
    // active + trashed (+ archived when Phase 2 ships)
  } else if (opts.status) {
    q = q.eq('status', opts.status)
  } else {
    q = q.eq('status', 'active')
  }

  if (opts.categoryId) q = q.eq('category_id', opts.categoryId)
  if (opts.visibility) q = q.eq('visibility', opts.visibility)

  const { data, error } = await q
  if (error) throw error

  let rows = await attachVersions(((data ?? []) as LibraryDocumentRow[]).map(mapDocument))

  if (opts.fieldMode) {
    rows = rows.filter((d) => d.category?.field_visible)
  }

  const query = opts.query?.trim().toLowerCase()
  if (query) {
    rows = rows.filter((d) => {
      const hay = `${d.title} ${d.doc_number} ${(d.tags ?? []).join(' ')} ${d.category?.name ?? ''} ${
        d.current_version?.file_name_original ?? ''
      }`.toLowerCase()
      return hay.includes(query)
    })
  }

  return rows
}

export async function countJobDocuments(jobId: string): Promise<number> {
  const supabase = getSupabase()
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'active')
  if (error) return 0
  return count ?? 0
}

export async function fetchJobDocumentCounts(
  jobIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const id of jobIds) out[id] = 0
  if (jobIds.length === 0) return out
  const supabase = getSupabase()
  if (!supabase) return out
  const { data, error } = await supabase
    .from('documents')
    .select('job_id')
    .in('job_id', jobIds)
    .eq('status', 'active')
  if (error || !data) return out
  for (const row of data as { job_id: string }[]) {
    out[row.job_id] = (out[row.job_id] ?? 0) + 1
  }
  return out
}

async function logDocumentEvent(input: {
  documentId: string
  versionId?: string | null
  action: DocumentEventAction
  details?: Record<string, unknown>
}) {
  const supabase = getSupabase()
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('document_events').insert({
    document_id: input.documentId,
    version_id: input.versionId ?? null,
    actor_id: user?.id ?? null,
    action: input.action,
    details: input.details ?? {},
  })
}

export type UploadJobDocumentInput = {
  jobId: string
  jobNumber: string
  categoryId: string
  visibility: DocumentVisibility
  title?: string
  file: File
  tags?: string[]
}

export async function uploadJobDocument(input: UploadJobDocumentInput): Promise<LibraryDocument> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  if (input.file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`File exceeds ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB limit`)
  }
  const mime = input.file.type || 'application/octet-stream'
  if (
    mime !== 'application/octet-stream' &&
    !(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    throw new Error(`File type not allowed: ${mime || 'unknown'}`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required to upload documents')

  const title = (input.title?.trim() || titleFromFileName(input.file.name)).slice(0, 200)
  const sha256 = await sha256Hex(input.file)

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      job_id: input.jobId,
      category_id: input.categoryId,
      title,
      visibility: input.visibility,
      status: 'active',
      tags: input.tags ?? [],
      created_by: user.id,
    })
    .select('*')
    .single()
  if (docErr) throw docErr

  const versionId = crypto.randomUUID()
  const storagePath = `jobs/${input.jobId}/${doc.id}/${versionId}/${safeFileName(input.file.name)}`

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    upsert: false,
    contentType: mime,
  })
  if (upErr) {
    await supabase.from('documents').delete().eq('id', doc.id)
    throw upErr
  }

  const { data: version, error: verErr } = await supabase
    .from('document_versions')
    .insert({
      id: versionId,
      document_id: doc.id,
      rev_label: 'R0',
      storage_path: storagePath,
      file_name_original: input.file.name,
      mime_type: mime,
      size_bytes: input.file.size,
      sha256,
      scan_status: 'available', // Phase 1: mark available; virus scan in later phase
      uploaded_by: user.id,
    })
    .select('*')
    .single()
  if (verErr) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    await supabase.from('documents').delete().eq('id', doc.id)
    throw verErr
  }

  const { data: updated, error: updErr } = await supabase
    .from('documents')
    .update({ current_version_id: version.id })
    .eq('id', doc.id)
    .select(`*, document_categories (*)`)
    .single()
  if (updErr) throw updErr

  await logDocumentEvent({
    documentId: doc.id,
    versionId: version.id,
    action: 'upload',
    details: {
      title,
      file_name: input.file.name,
      size_bytes: input.file.size,
      sha256,
      job_number: input.jobNumber,
    },
  })

  const mapped = mapDocument(updated as LibraryDocumentRow)
  return {
    ...mapped,
    current_version: version as DocumentVersion,
  }
}

export type BulkUploadItem = {
  file: File
  categoryId: string
  visibility: DocumentVisibility
  title?: string
}

export async function uploadJobDocumentsBatch(
  jobId: string,
  jobNumber: string,
  items: BulkUploadItem[],
  onProgress?: (done: number, total: number, fileName: string) => void,
): Promise<{ uploaded: LibraryDocument[]; errors: { fileName: string; message: string }[] }> {
  if (items.length > MAX_IMPORT_BATCH) {
    throw new Error(`Batch limited to ${MAX_IMPORT_BATCH} files`)
  }
  const uploaded: LibraryDocument[] = []
  const errors: { fileName: string; message: string }[] = []
  let done = 0
  for (const item of items) {
    try {
      const doc = await uploadJobDocument({
        jobId,
        jobNumber,
        categoryId: item.categoryId,
        visibility: item.visibility,
        title: item.title,
        file: item.file,
      })
      uploaded.push(doc)
    } catch (e) {
      errors.push({
        fileName: item.file.name,
        message: e instanceof Error ? e.message : 'Upload failed',
      })
    }
    done += 1
    onProgress?.(done, items.length, item.file.name)
  }
  return { uploaded, errors }
}

export async function updateDocumentMetadata(
  documentId: string,
  patch: Partial<Pick<LibraryDocument, 'title' | 'category_id' | 'visibility' | 'doc_number' | 'tags'>>,
): Promise<LibraryDocument> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('documents')
    .update(patch)
    .eq('id', documentId)
    .select(`*, document_categories (*)`)
    .single()
  if (error) throw error
  await logDocumentEvent({
    documentId,
    action: 'metadata_edit',
    details: patch as Record<string, unknown>,
  })
  const [withVersion] = await attachVersions([mapDocument(data as LibraryDocumentRow)])
  return withVersion
}

export async function trashDocument(documentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('documents')
    .update({ status: 'trashed', trashed_at: new Date().toISOString() })
    .eq('id', documentId)
  if (error) throw error
  await logDocumentEvent({ documentId, action: 'trash' })
}

export async function restoreDocument(documentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('documents')
    .update({ status: 'active', trashed_at: null, archived_at: null })
    .eq('id', documentId)
  if (error) throw error
  await logDocumentEvent({ documentId, action: 'restore' })
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5)
  if (error) return null
  return data.signedUrl
}

export async function logDocumentView(documentId: string, versionId?: string | null) {
  await logDocumentEvent({ documentId, versionId, action: 'view' })
}

export async function logDocumentDownload(documentId: string, versionId?: string | null) {
  await logDocumentEvent({ documentId, versionId, action: 'download' })
}

export async function fetchDocumentEvents(documentId: string): Promise<DocumentEvent[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('document_events')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as DocumentEvent[]
}

export function defaultCategoryForFile(
  file: File,
  categories: DocumentCategory[],
): DocumentCategory | null {
  const code = guessCategoryCode(file.name)
  if (code) {
    const match = categories.find((c) => c.code === code)
    if (match) return match
  }
  return categories.find((c) => c.code === 'CORR') ?? categories[0] ?? null
}
