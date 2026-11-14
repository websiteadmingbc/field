import JSZip from 'jszip'
import { getSupabase } from '../supabase/client'
import { fetchJobDocuments, getDocumentSignedUrl } from '../supabase/documents'
import type { LibraryDocument } from '../../types/documents'
import { formatFileSize } from '../../types/documents'

async function logExportEvent(input: {
  documentId: string
  versionId?: string | null
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
    action: 'export',
    details: input.details ?? {},
  })
}

/** Closeout package: closeout/warranties, permits, final drawings & specs */
export const CLOSEOUT_CATEGORY_CODES = ['CLOSE', 'PERMIT', 'DWG', 'SPEC'] as const

export type ExportManifestRow = {
  file_name: string
  category: string
  category_code: string
  title: string
  rev: string
  date: string
  uploader: string
  checksum: string
  size_bytes: number
  document_id: string
  version_id: string
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function documentsToManifestCsv(rows: ExportManifestRow[]): string {
  const header = [
    'file_name',
    'category',
    'category_code',
    'title',
    'rev',
    'date',
    'uploader',
    'checksum',
    'size_bytes',
    'document_id',
    'version_id',
  ]
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.file_name,
        r.category,
        r.category_code,
        r.title,
        r.rev,
        r.date,
        r.uploader,
        r.checksum,
        String(r.size_bytes),
        r.document_id,
        r.version_id,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function documentsToMetadataCsv(docs: LibraryDocument[]): string {
  const header = [
    'title',
    'category',
    'code',
    'visibility',
    'status',
    'rev',
    'file_name',
    'size',
    'sha256',
    'retain_until',
    'legal_hold',
    'updated_at',
    'document_id',
  ]
  const lines = [header.join(',')]
  for (const d of docs) {
    const v = d.current_version
    lines.push(
      [
        d.title,
        d.category?.name ?? '',
        d.category?.code ?? '',
        d.visibility,
        d.status,
        v?.rev_label ?? '',
        v?.file_name_original ?? '',
        v ? formatFileSize(v.size_bytes) : '',
        v?.sha256 ?? '',
        d.retain_until ?? '',
        d.legal_hold ? 'yes' : 'no',
        d.updated_at,
        d.id,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(content: string, fileName: string, mime = 'text/csv;charset=utf-8') {
  downloadBlob(new Blob([content], { type: mime }), fileName)
}

function safeZipPathSegment(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file'
}

async function fetchFileBlob(storagePath: string): Promise<Blob> {
  const signed = await getDocumentSignedUrl(storagePath)
  if (!signed) throw new Error(`Could not sign ${storagePath}`)
  const res = await fetch(signed)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return res.blob()
}

function toManifestRow(doc: LibraryDocument): ExportManifestRow | null {
  const v = doc.current_version
  if (!v) return null
  return {
    file_name: v.file_name_original,
    category: doc.category?.name ?? '',
    category_code: doc.category?.code ?? '',
    title: doc.title,
    rev: v.rev_label,
    date: v.uploaded_at,
    uploader: v.uploaded_by ?? '',
    checksum: v.sha256 ?? '',
    size_bytes: v.size_bytes,
    document_id: doc.id,
    version_id: v.id,
  }
}

export type BuildZipProgress = (done: number, total: number, label: string) => void

export async function buildDocumentsZip(opts: {
  docs: LibraryDocument[]
  jobNumber: string
  packageLabel: string
  onProgress?: BuildZipProgress
}): Promise<{ blob: Blob; manifest: ExportManifestRow[]; fileName: string }> {
  const zip = new JSZip()
  const manifest: ExportManifestRow[] = []
  const withFiles = opts.docs.filter((d) => d.current_version?.storage_path)
  let done = 0
  const total = withFiles.length

  for (const doc of withFiles) {
    const v = doc.current_version!
    const folder = safeZipPathSegment(doc.category?.name ?? 'Uncategorized')
    const base = `${v.rev_label}_${safeZipPathSegment(doc.title)}_${safeZipPathSegment(v.file_name_original)}`
    opts.onProgress?.(done, total, v.file_name_original)
    const blob = await fetchFileBlob(v.storage_path)
    zip.folder(folder)?.file(base, blob)
    const row = toManifestRow(doc)
    if (row) manifest.push(row)
    done += 1
    opts.onProgress?.(done, total, v.file_name_original)

    void logExportEvent({
      documentId: doc.id,
      versionId: v.id,
      details: { package: opts.packageLabel },
    }).catch(() => undefined)
  }

  zip.file('manifest.csv', documentsToManifestCsv(manifest))
  zip.file(
    'INDEX.txt',
    [
      `Britton Field export: ${opts.packageLabel}`,
      `Job: ${opts.jobNumber}`,
      `Generated: ${new Date().toISOString()}`,
      `Files: ${manifest.length}`,
      '',
      'See manifest.csv for checksums and metadata.',
    ].join('\n'),
  )

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `${safeZipPathSegment(opts.jobNumber)}_${safeZipPathSegment(opts.packageLabel)}_${stamp}.zip`
  return { blob, manifest, fileName }
}

export async function downloadDocumentsZip(opts: {
  docs: LibraryDocument[]
  jobNumber: string
  packageLabel: string
  onProgress?: BuildZipProgress
}): Promise<{ fileName: string; count: number }> {
  const { blob, fileName, manifest } = await buildDocumentsZip(opts)
  downloadBlob(blob, fileName)
  await recordExportJob({
    scope: {
      type: opts.packageLabel,
      job_number: opts.jobNumber,
      document_ids: opts.docs.map((d) => d.id),
      file_count: manifest.length,
    },
    status: 'completed',
  })
  return { fileName, count: manifest.length }
}

export async function downloadCloseoutPackage(opts: {
  jobId: string
  jobNumber: string
  onProgress?: BuildZipProgress
}): Promise<{ fileName: string; count: number }> {
  const all = await fetchJobDocuments(opts.jobId, { status: 'active' })
  const docs = all.filter((d) =>
    (CLOSEOUT_CATEGORY_CODES as readonly string[]).includes(d.category?.code ?? ''),
  )
  if (docs.length === 0) {
    throw new Error('No closeout, permit, drawing, or spec documents to package')
  }
  return downloadDocumentsZip({
    docs,
    jobNumber: opts.jobNumber,
    packageLabel: 'Closeout',
    onProgress: opts.onProgress,
  })
}

async function recordExportJob(input: {
  scope: Record<string, unknown>
  status: string
  storagePath?: string | null
}) {
  const supabase = getSupabase()
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('export_jobs').insert({
    requested_by: user?.id ?? null,
    scope: input.scope,
    status: input.status,
    storage_path: input.storagePath ?? null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: input.status === 'completed' ? new Date().toISOString() : null,
  })
}

