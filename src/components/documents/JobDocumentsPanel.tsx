import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  RotateCcw,
  X,
  Eye,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, SectionHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import {
  defaultCategoryForFile,
  fetchDocumentCategories,
  fetchDocumentEvents,
  fetchJobDocuments,
  getDocumentSignedUrl,
  logDocumentDownload,
  logDocumentView,
  restoreDocument,
  trashDocument,
  updateDocumentMetadata,
  uploadJobDocumentsBatch,
} from '../../lib/supabase/documents'
import { cn, formatRelative } from '../../lib/utils'
import type {
  DocumentCategory,
  DocumentEvent,
  DocumentStatus,
  DocumentVisibility,
  LibraryDocument,
} from '../../types/documents'
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
  MAX_IMPORT_BATCH,
  formatFileSize,
} from '../../types/documents'
import { isSupabaseConfigured } from '../../lib/supabase/client'

type Props = {
  jobId: string
  jobNumber: string
  jobName: string
  /** Managers see import / trash / all categories; crew gets field mode */
  canManage: boolean
  /** Compact field list of current crew-visible docs */
  fieldMode?: boolean
}

type DraftItem = {
  key: string
  file: File
  title: string
  categoryId: string
  visibility: DocumentVisibility
}

export function JobDocumentsPanel({
  jobId,
  jobNumber,
  jobName,
  canManage,
  fieldMode = false,
}: Props) {
  const remote = isSupabaseConfigured()
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [docs, setDocs] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showTrash, setShowTrash] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<LibraryDocument | null>(null)
  const [events, setEvents] = useState<DocumentEvent[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!remote) {
      setLoading(false)
      setDocs([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [cats, list] = await Promise.all([
        fetchDocumentCategories('job'),
        fetchJobDocuments(jobId, {
          fieldMode: fieldMode && !canManage,
          status: canManage && showTrash ? 'trashed' : 'active',
          categoryId: categoryFilter || null,
          query,
        }),
      ])
      setCategories(cats)
      setDocs(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [remote, jobId, fieldMode, canManage, showTrash, categoryFilter, query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null)
      setEvents([])
      return
    }
    const path = selected.current_version?.storage_path
    if (path) {
      void getDocumentSignedUrl(path).then((url) => {
        setPreviewUrl(url)
        void logDocumentView(selected.id, selected.current_version_id)
      })
    }
    if (canManage) {
      void fetchDocumentEvents(selected.id)
        .then(setEvents)
        .catch(() => setEvents([]))
    }
  }, [selected, canManage])

  const grouped = useMemo(() => {
    const map = new Map<string, { category: DocumentCategory | null; items: LibraryDocument[] }>()
    for (const d of docs) {
      const key = d.category_id
      const existing = map.get(key)
      if (existing) existing.items.push(d)
      else map.set(key, { category: d.category ?? null, items: [d] })
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.category?.sort_order ?? 999) - (b.category?.sort_order ?? 999),
    )
  }, [docs])

  async function onTrash(doc: LibraryDocument) {
    if (!confirm(`Move “${doc.title}” to Trash?`)) return
    try {
      await trashDocument(doc.id)
      setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trash failed')
    }
  }

  async function onRestore(doc: LibraryDocument) {
    try {
      await restoreDocument(doc.id)
      setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed')
    }
  }

  async function onDownload(doc: LibraryDocument) {
    const path = doc.current_version?.storage_path
    if (!path) return
    const url = previewUrl && selected?.id === doc.id ? previewUrl : await getDocumentSignedUrl(path)
    if (!url) {
      setError('Could not create download link')
      return
    }
    await logDocumentDownload(doc.id, doc.current_version_id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!remote) {
    return (
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="Document library unavailable"
        description="Connect Supabase to store job documents."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title={fieldMode && !canManage ? 'Current docs' : 'Documents'}
          subtitle={
            fieldMode && !canManage
              ? 'Latest field-visible plans, permits, and safety docs for this job'
              : `${jobName} · import, view, download, and trash`
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setShowTrash((v) => !v)}
                className={cn(
                  'h-9 rounded-md border px-3 text-xs font-semibold uppercase tracking-wide',
                  showTrash
                    ? 'border-gold-line bg-teal-soft text-teal'
                    : 'border-gold-line/40 bg-surface-raised text-ink-muted',
                )}
              >
                {showTrash ? 'Showing trash' : 'Show trash'}
              </button>
              <Button type="button" size="sm" onClick={() => setImportOpen(true)}>
                <Plus className="h-4 w-4" />
                Import
              </Button>
            </>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, tags…"
              className="h-10 w-full rounded-md border border-border bg-surface-raised pl-10 pr-3 text-sm outline-none focus:border-gold-line"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-md border border-border bg-surface-raised px-2 text-sm font-medium normal-case tracking-normal text-ink"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">Loading…</p>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={showTrash ? 'Trash is empty' : 'No documents yet'}
          description={
            showTrash
              ? 'Soft-deleted documents appear here for restore.'
              : canManage
                ? 'Import contracts, drawings, permits, and more for this job.'
                : 'Field docs will show here when uploaded for this job.'
          }
          action={
            canManage && !showTrash ? (
              <button
                type="button"
                className="text-sm font-semibold text-teal hover:underline"
                onClick={() => setImportOpen(true)}
              >
                Import documents
              </button>
            ) : undefined
          }
        />
      ) : fieldMode && !canManage ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-raised">
          {docs.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelected(d)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-teal-soft/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-sky">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {d.category?.name ?? 'Document'} · {d.current_version?.rev_label ?? 'R0'}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ category, items }) => (
            <details key={category?.id ?? 'unknown'} open className="rounded-2xl border border-border bg-surface-raised">
              <summary className="cursor-pointer list-none px-4 py-3 font-semibold text-ink">
                <span className="inline-flex items-center gap-2">
                  {category?.name ?? 'Uncategorized'}
                  <span className="rounded-md bg-teal-soft px-2 py-0.5 text-xs font-semibold text-teal">
                    {items.length}
                  </span>
                </span>
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {items.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-teal-soft/20"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelected(d)}
                    >
                      <p className="font-semibold text-ink">{d.title}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {DOCUMENT_VISIBILITY_LABELS[d.visibility]} ·{' '}
                        {d.current_version?.rev_label ?? 'R0'} ·{' '}
                        {d.current_version
                          ? formatFileSize(d.current_version.size_bytes)
                          : '—'}{' '}
                        · {formatRelative(d.updated_at)}
                        {d.status !== 'active' ? ` · ${DOCUMENT_STATUS_LABELS[d.status]}` : ''}
                      </p>
                    </button>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(d)}
                        aria-label="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void onDownload(d)}
                        aria-label="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canManage && d.status === 'active' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void onTrash(d)}
                          aria-label="Trash"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && d.status === 'trashed' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void onRestore(d)}
                          aria-label="Restore"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      {importOpen && canManage && (
        <ImportWizard
          jobId={jobId}
          jobNumber={jobNumber}
          categories={categories}
          onClose={() => setImportOpen(false)}
          onDone={async () => {
            setImportOpen(false)
            await load()
          }}
        />
      )}

      {selected && (
        <DocumentDrawer
          doc={selected}
          canManage={canManage}
          categories={categories}
          previewUrl={previewUrl}
          events={events}
          onClose={() => setSelected(null)}
          onDownload={() => void onDownload(selected)}
          onTrash={() => void onTrash(selected)}
          onRestore={() => void onRestore(selected)}
          onSaved={async () => {
            await load()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function ImportWizard({
  jobId,
  jobNumber,
  categories,
  onClose,
  onDone,
}: {
  jobId: string
  jobNumber: string
  categories: DocumentCategory[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [batchCategoryId, setBatchCategoryId] = useState(categories[0]?.id ?? '')
  const [batchVisibility, setBatchVisibility] = useState<DocumentVisibility>(
    categories[0]?.default_visibility ?? 'internal',
  )
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const next: DraftItem[] = []
    for (const file of Array.from(fileList)) {
      if (items.length + next.length >= MAX_IMPORT_BATCH) break
      const cat = defaultCategoryForFile(file, categories)
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        categoryId: cat?.id ?? batchCategoryId,
        visibility: cat?.default_visibility ?? batchVisibility,
      })
    }
    setItems((prev) => [...prev, ...next])
  }

  function applyBatchDefaults() {
    const cat = categories.find((c) => c.id === batchCategoryId)
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        categoryId: batchCategoryId || i.categoryId,
        visibility: batchVisibility || cat?.default_visibility || i.visibility,
      })),
    )
  }

  async function startUpload() {
    if (items.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const { errors } = await uploadJobDocumentsBatch(
        jobId,
        jobNumber,
        items.map((i) => ({
          file: i.file,
          categoryId: i.categoryId,
          visibility: i.visibility,
          title: i.title,
        })),
        (done, total, name) => setProgress(`${done}/${total} · ${name}`),
      )
      if (errors.length) {
        setError(errors.map((e) => `${e.fileName}: ${e.message}`).join('\n'))
        setUploading(false)
        if (errors.length < items.length) await onDone()
        return
      }
      await onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      <Card className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal">Import</p>
            <h3 className="font-display text-xl font-semibold text-ink">Add documents</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-surface" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gold-line/50 bg-teal-soft/20 px-4 py-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              addFiles(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <FileText className="mb-2 h-8 w-8 text-teal" />
            <p className="font-semibold text-ink">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-ink-muted">
              PDF, Office, images, DWG, MP4 · up to {MAX_IMPORT_BATCH} files
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold sm:col-span-1">
              Category (batch)
              <select
                value={batchCategoryId}
                onChange={(e) => {
                  const id = e.target.value
                  setBatchCategoryId(id)
                  const cat = categories.find((c) => c.id === id)
                  if (cat) setBatchVisibility(cat.default_visibility)
                }}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-surface px-2"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Visibility (batch)
              <select
                value={batchVisibility}
                onChange={(e) => setBatchVisibility(e.target.value as DocumentVisibility)}
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-surface px-2"
              >
                {(Object.keys(DOCUMENT_VISIBILITY_LABELS) as DocumentVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {DOCUMENT_VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={applyBatchDefaults}>
                Apply to all
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((item) => (
                <li key={item.key} className="grid gap-2 p-3 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-4">
                    <p className="truncate text-sm font-semibold">{item.file.name}</p>
                    <p className="text-xs text-ink-muted">{formatFileSize(item.file.size)}</p>
                  </div>
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((i) => (i.key === item.key ? { ...i, title: e.target.value } : i)),
                      )
                    }
                    className="h-9 rounded-md border border-border px-2 text-sm sm:col-span-3"
                    placeholder="Title"
                  />
                  <select
                    value={item.categoryId}
                    onChange={(e) => {
                      const id = e.target.value
                      const cat = categories.find((c) => c.id === id)
                      setItems((prev) =>
                        prev.map((i) =>
                          i.key === item.key
                            ? {
                                ...i,
                                categoryId: id,
                                visibility: cat?.default_visibility ?? i.visibility,
                              }
                            : i,
                        ),
                      )
                    }}
                    className="h-9 rounded-md border border-border px-2 text-sm sm:col-span-3"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose sm:col-span-2"
                    onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {progress && <p className="text-sm text-ink-muted">{progress}</p>}
          {error && (
            <pre className="whitespace-pre-wrap rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-xs text-rose">
              {error}
            </pre>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={uploading || items.length === 0}
            onClick={() => void startUpload()}
          >
            {uploading ? 'Uploading…' : `Upload ${items.length || ''}`}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function DocumentDrawer({
  doc,
  canManage,
  categories,
  previewUrl,
  events,
  onClose,
  onDownload,
  onTrash,
  onRestore,
  onSaved,
}: {
  doc: LibraryDocument
  canManage: boolean
  categories: DocumentCategory[]
  previewUrl: string | null
  events: DocumentEvent[]
  onClose: () => void
  onDownload: () => void
  onTrash: () => void
  onRestore: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(doc.title)
  const [categoryId, setCategoryId] = useState(doc.category_id)
  const [visibility, setVisibility] = useState(doc.visibility)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mime = doc.current_version?.mime_type ?? ''
  const isImage = mime.startsWith('image/')
  const isPdf = mime === 'application/pdf'

  async function saveMeta() {
    setSaving(true)
    setError(null)
    try {
      await updateDocumentMetadata(doc.id, { title, category_id: categoryId, visibility })
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div className="flex h-full w-full max-w-lg flex-col bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal">
              {doc.category?.name ?? 'Document'}
            </p>
            <h3 className="truncate font-display text-xl font-semibold text-ink">{doc.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-surface-raised" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-xl border border-border bg-charcoal/5">
            {previewUrl && isImage ? (
              <img src={previewUrl} alt={doc.title} className="max-h-72 w-full object-contain" />
            ) : previewUrl && isPdf ? (
              <iframe title={doc.title} src={previewUrl} className="h-72 w-full bg-white" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-ink-muted">
                <FileText className="h-8 w-8" />
                <p className="text-sm">Preview not available — download to open</p>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Revision</dt>
              <dd className="font-semibold">{doc.current_version?.rev_label ?? 'R0'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</dt>
              <dd className="font-semibold">{DOCUMENT_STATUS_LABELS[doc.status as DocumentStatus]}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">File</dt>
              <dd className="truncate font-semibold">
                {doc.current_version?.file_name_original ?? '—'}
                {doc.current_version ? ` · ${formatFileSize(doc.current_version.size_bytes)}` : ''}
              </dd>
            </div>
          </dl>

          {canManage && doc.status === 'active' && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Metadata</p>
              <label className="block text-sm font-semibold">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border px-2"
                />
              </label>
              <label className="block text-sm font-semibold">
                Category
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border px-2"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Visibility
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
                  className="mt-1 h-10 w-full rounded-md border border-border px-2"
                >
                  {(Object.keys(DOCUMENT_VISIBILITY_LABELS) as DocumentVisibility[]).map((v) => (
                    <option key={v} value={v}>
                      {DOCUMENT_VISIBILITY_LABELS[v]}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveMeta()}>
                Save metadata
              </Button>
            </div>
          )}

          {canManage && events.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Activity</p>
              <ul className="space-y-2 text-sm">
                {events.slice(0, 12).map((ev) => (
                  <li key={ev.id} className="rounded-md border border-border px-3 py-2">
                    <span className="font-semibold capitalize">{ev.action.replace('_', ' ')}</span>
                    <span className="text-ink-muted"> · {formatRelative(ev.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-rose">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <Button type="button" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          {canManage && doc.status === 'active' && (
            <Button type="button" variant="danger" size="sm" onClick={onTrash}>
              <Trash2 className="h-4 w-4" />
              Trash
            </Button>
          )}
          {canManage && doc.status === 'trashed' && (
            <Button type="button" variant="outline" size="sm" onClick={onRestore}>
              <RotateCcw className="h-4 w-4" />
              Restore
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
