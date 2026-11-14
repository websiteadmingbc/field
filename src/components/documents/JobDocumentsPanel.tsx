import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Download,
  FileText,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  RotateCcw,
  X,
  Eye,
  Scale,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import {
  documentsToMetadataCsv,
  downloadCloseoutPackage,
  downloadDocumentsZip,
  downloadTextFile,
} from '../../lib/documents/exportLibrary'
import { Button } from '../ui/Button'
import { Card, SectionHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import {
  archiveDocument,
  defaultCategoryForFile,
  fetchDocumentCategories,
  fetchDocumentEvents,
  fetchDocumentVersions,
  fetchJobDocuments,
  findMatchingDocument,
  getDocumentSignedUrl,
  getPurgeEligibility,
  logDocumentDownload,
  logDocumentView,
  purgeDocument,
  restoreDocument,
  setDocumentLegalHold,
  trashDocument,
  updateDocumentMetadata,
  uploadDocumentRevision,
  uploadJobDocumentsBatch,
  type PurgeCheck,
} from '../../lib/supabase/documents'
import { cn, formatRelative } from '../../lib/utils'
import type {
  DocumentCategory,
  DocumentEvent,
  DocumentStatus,
  DocumentVersion,
  DocumentVisibility,
  LibraryDocument,
} from '../../types/documents'
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_VISIBILITY_LABELS,
  MAX_IMPORT_BATCH,
  formatFileSize,
  isRetentionSatisfied,
} from '../../types/documents'
import { isSupabaseConfigured } from '../../lib/supabase/client'

type LibraryView = 'active' | 'archived' | 'trashed'

type Props = {
  jobId: string
  jobNumber: string
  jobName: string
  canManage: boolean
  fieldMode?: boolean
  /** Owner/Admin — permanent purge */
  canPurge?: boolean
  /** Owner/Admin — legal hold */
  canHold?: boolean
}

type DraftItem = {
  key: string
  file: File
  title: string
  categoryId: string
  visibility: DocumentVisibility
  reviseDocumentId?: string | null
  matchTitle?: string | null
}

export function JobDocumentsPanel({
  jobId,
  jobNumber,
  jobName,
  canManage,
  fieldMode = false,
  canPurge = false,
  canHold = false,
}: Props) {
  const remote = isSupabaseConfigured()
  const { pushNotification } = useApp()
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [docs, setDocs] = useState<LibraryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [view, setView] = useState<LibraryView>('active')
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<LibraryDocument | null>(null)
  const [events, setEvents] = useState<DocumentEvent[]>([])
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [exportProgress, setExportProgress] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!remote) {
      setLoading(false)
      setDocs([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const status: DocumentStatus =
        canManage && view !== 'active' ? view : 'active'
      const [cats, list] = await Promise.all([
        fetchDocumentCategories('job'),
        fetchJobDocuments(jobId, {
          fieldMode: fieldMode && !canManage,
          status: canManage ? status : 'active',
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
  }, [remote, jobId, fieldMode, canManage, view, categoryFilter, query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) {
      setPreviewUrl(null)
      setEvents([])
      setVersions([])
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
      void fetchDocumentVersions(selected.id)
        .then(setVersions)
        .catch(() => setVersions([]))
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

  const checkedDocs = useMemo(
    () => docs.filter((d) => checkedIds.has(d.id)),
    [docs, checkedIds],
  )

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    if (checkedIds.size === docs.length) setCheckedIds(new Set())
    else setCheckedIds(new Set(docs.map((d) => d.id)))
  }

  async function runExport(
    label: string,
    work: () => Promise<{ fileName: string; count: number } | void>,
  ) {
    setExporting(true)
    setExportProgress('Starting…')
    setError(null)
    try {
      const result = await work()
      const body = result
        ? `Downloaded ${result.fileName} (${result.count} file${result.count === 1 ? '' : 's'}).`
        : 'Export complete.'
      pushNotification({
        type: 'export',
        title: `${label} ready`,
        body,
        jobId,
      })
      setExportProgress(null)
      setCheckedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
      setExportProgress(null)
    } finally {
      setExporting(false)
    }
  }

  async function onExportZip() {
    const targets = checkedDocs.length > 0 ? checkedDocs : docs
    if (targets.length === 0) {
      setError('No documents to export')
      return
    }
    await runExport('ZIP export', () =>
      downloadDocumentsZip({
        docs: targets,
        jobNumber,
        packageLabel: checkedDocs.length > 0 ? 'Selection' : 'Library',
        onProgress: (done, total, name) => setExportProgress(`${done}/${total} · ${name}`),
      }),
    )
  }

  async function onExportCsv() {
    const targets = checkedDocs.length > 0 ? checkedDocs : docs
    if (targets.length === 0) {
      setError('No documents to export')
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      documentsToMetadataCsv(targets),
      `${jobNumber}_documents_${stamp}.csv`,
    )
    pushNotification({
      type: 'export',
      title: 'CSV export ready',
      body: `Exported metadata for ${targets.length} document${targets.length === 1 ? '' : 's'}.`,
      jobId,
    })
  }

  async function onCloseoutPackage() {
    await runExport('Closeout package', () =>
      downloadCloseoutPackage({
        jobId,
        jobNumber,
        onProgress: (done, total, name) => setExportProgress(`${done}/${total} · ${name}`),
      }),
    )
  }

  async function onTrash(doc: LibraryDocument) {
    if (doc.legal_hold) {
      setError('On legal hold — lift hold before trashing')
      return
    }
    if (!confirm(`Move “${doc.title}” to Trash?`)) return
    try {
      await trashDocument(doc.id)
      setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trash failed')
    }
  }

  async function onArchive(doc: LibraryDocument) {
    if (doc.legal_hold) {
      setError('On legal hold — lift hold before archiving')
      return
    }
    if (!confirm(`Archive “${doc.title}”? It stays searchable under Show archived.`)) return
    try {
      await archiveDocument(doc.id)
      setSelected(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed')
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

  async function onDownload(doc: LibraryDocument, version?: DocumentVersion | null) {
    const ver = version ?? doc.current_version
    const path = ver?.storage_path
    if (!path) return
    const url =
      !version && previewUrl && selected?.id === doc.id
        ? previewUrl
        : await getDocumentSignedUrl(path)
    if (!url) {
      setError('Could not create download link')
      return
    }
    await logDocumentDownload(doc.id, ver?.id ?? doc.current_version_id)
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
              ? 'Latest field-visible plans, permits, and safety docs (current revision only)'
              : `${jobName} · revisions, archive, trash${canPurge ? ', purge' : ''}`
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {canManage && (
            <>
              <select
                value={view}
                onChange={(e) => setView(e.target.value as LibraryView)}
                className="h-9 rounded-md border border-gold-line/40 bg-surface-raised px-2 text-xs font-semibold uppercase tracking-wide text-ink"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="trashed">Trash</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting || docs.length === 0}
                onClick={() => void onExportCsv()}
              >
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting || docs.length === 0}
                onClick={() => void onExportZip()}
              >
                <Download className="h-4 w-4" />
                ZIP
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => void onCloseoutPackage()}
              >
                <Package className="h-4 w-4" />
                Closeout
              </Button>
              <Button type="button" size="sm" onClick={() => setImportOpen(true)}>
                <Plus className="h-4 w-4" />
                Import
              </Button>
            </>
          )}
        </div>
      </div>

      {canManage && (checkedIds.size > 0 || exportProgress) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold-line/40 bg-teal-soft/30 px-3 py-2 text-sm">
          {checkedIds.size > 0 && (
            <span className="font-semibold text-ink">{checkedIds.size} selected</span>
          )}
          {exportProgress && <span className="text-ink-muted">{exportProgress}</span>}
          {checkedIds.size > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => void onExportZip()}
              >
                Export ZIP
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCheckedIds(new Set())}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, tags, file text…"
              className="h-10 w-full rounded-md border border-border bg-surface-raised pl-10 pr-3 text-sm outline-none focus:border-gold-line"
            />
          </div>
          {docs.length > 0 && (
            <button
              type="button"
              onClick={toggleCheckAll}
              className="h-10 rounded-md border border-border bg-surface-raised px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
            >
              {checkedIds.size === docs.length ? 'Unselect all' : 'Select all'}
            </button>
          )}
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
          title={
            view === 'trashed'
              ? 'Trash is empty'
              : view === 'archived'
                ? 'No archived documents'
                : 'No documents yet'
          }
          description={
            view === 'trashed'
              ? 'Soft-deleted documents appear here for restore or purge.'
              : view === 'archived'
                ? 'Archived documents are read-only until restored.'
                : canManage
                  ? 'Import contracts, drawings, permits, and more for this job.'
                  : 'Field docs will show here when uploaded for this job.'
          }
          action={
            canManage && view === 'active' ? (
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
            <details
              key={category?.id ?? 'unknown'}
              open
              className="rounded-2xl border border-border bg-surface-raised"
            >
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
                    <label className="flex shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(d.id)}
                        onChange={() => toggleChecked(d.id)}
                        className="h-4 w-4 accent-teal"
                        aria-label={`Select ${d.title}`}
                      />
                    </label>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelected(d)}
                    >
                      <p className="font-semibold text-ink">
                        {d.title}
                        {d.legal_hold ? (
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-amber">
                            On hold
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {DOCUMENT_VISIBILITY_LABELS[d.visibility]} ·{' '}
                        {d.current_version?.rev_label ?? 'R0'} ·{' '}
                        {d.current_version
                          ? formatFileSize(d.current_version.size_bytes)
                          : '—'}{' '}
                        · {formatRelative(d.updated_at)}
                        {d.status !== 'active' ? ` · ${DOCUMENT_STATUS_LABELS[d.status]}` : ''}
                        {d.retain_until ? ` · retain to ${d.retain_until}` : ''}
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
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void onArchive(d)}
                            aria-label="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void onTrash(d)}
                            aria-label="Trash"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {canManage && (d.status === 'trashed' || d.status === 'archived') && (
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
          canPurge={canPurge}
          canHold={canHold}
          categories={categories}
          previewUrl={previewUrl}
          events={events}
          versions={versions}
          onClose={() => setSelected(null)}
          onDownload={(ver) => void onDownload(selected, ver)}
          onTrash={() => void onTrash(selected)}
          onArchive={() => void onArchive(selected)}
          onRestore={() => void onRestore(selected)}
          onSaved={async () => {
            await load()
            setSelected(null)
          }}
          onRefreshSelected={async () => {
            await load()
            const refreshed = await fetchJobDocuments(jobId, {
              status: selected.status,
              query: selected.title,
            })
            const match = refreshed.find((d) => d.id === selected.id)
            if (match) setSelected(match)
            else setSelected(null)
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

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const next: DraftItem[] = []
    for (const file of Array.from(fileList)) {
      if (items.length + next.length >= MAX_IMPORT_BATCH) break
      const cat = defaultCategoryForFile(file, categories)
      const title = file.name.replace(/\.[^.]+$/, '')
      const categoryId = cat?.id ?? batchCategoryId
      let reviseDocumentId: string | null = null
      let matchTitle: string | null = null
      try {
        const match = await findMatchingDocument({ jobId, categoryId, title })
        if (match && cat?.versioned !== false) {
          const asRev = confirm(
            `“${title}” already exists in this category.\n\nOK = upload as new revision (supersede current)\nCancel = separate document`,
          )
          if (asRev) {
            reviseDocumentId = match.id
            matchTitle = match.title
          }
        }
      } catch {
        /* ignore match lookup failures during draft */
      }
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        title,
        categoryId,
        visibility: cat?.default_visibility ?? batchVisibility,
        reviseDocumentId,
        matchTitle,
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
          reviseDocumentId: i.reviseDocumentId,
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
              void addFiles(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <FileText className="mb-2 h-8 w-8 text-teal" />
            <p className="font-semibold text-ink">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-ink-muted">
              PDF, Office, images, DWG, MP4 · up to {MAX_IMPORT_BATCH} files · matching titles can become revisions
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files)
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
                    <p className="text-xs text-ink-muted">
                      {formatFileSize(item.file.size)}
                      {item.reviseDocumentId ? ' · new revision' : ''}
                    </p>
                  </div>
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((i) =>
                          i.key === item.key
                            ? { ...i, title: e.target.value, reviseDocumentId: null }
                            : i,
                        ),
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
                                reviseDocumentId: null,
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
  canPurge,
  canHold,
  categories,
  previewUrl,
  events,
  versions,
  onClose,
  onDownload,
  onTrash,
  onArchive,
  onRestore,
  onSaved,
  onRefreshSelected,
}: {
  doc: LibraryDocument
  canManage: boolean
  canPurge: boolean
  canHold: boolean
  categories: DocumentCategory[]
  previewUrl: string | null
  events: DocumentEvent[]
  versions: DocumentVersion[]
  onClose: () => void
  onDownload: (version?: DocumentVersion | null) => void
  onTrash: () => void
  onArchive: () => void
  onRestore: () => void
  onSaved: () => Promise<void>
  onRefreshSelected: () => Promise<void>
}) {
  const [title, setTitle] = useState(doc.title)
  const [categoryId, setCategoryId] = useState(doc.category_id)
  const [visibility, setVisibility] = useState(doc.visibility)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeCheck, setPurgeCheck] = useState<PurgeCheck | null>(null)
  const [purgeTyped, setPurgeTyped] = useState('')
  const revInputRef = useRef<HTMLInputElement>(null)
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

  async function toggleHold() {
    setSaving(true)
    setError(null)
    try {
      await setDocumentLegalHold(doc.id, !doc.legal_hold)
      await onRefreshSelected()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hold update failed')
    } finally {
      setSaving(false)
    }
  }

  async function openPurge() {
    try {
      const check = await getPurgeEligibility(doc.id)
      setPurgeCheck(check)
      setPurgeTyped('')
      setPurgeOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check purge eligibility')
    }
  }

  async function confirmPurge() {
    setSaving(true)
    setError(null)
    try {
      await purgeDocument(doc.id, purgeTyped, { includeAllRevisions: true })
      setPurgeOpen(false)
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purge failed')
      setSaving(false)
    }
  }

  async function onNewRevision(file: File | null) {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      await uploadDocumentRevision({ documentId: doc.id, jobId: doc.job_id, file })
      await onRefreshSelected()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revision upload failed')
    } finally {
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
              {doc.legal_hold ? ' · Legal hold' : ''}
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
            {doc.retain_until && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Retain until</dt>
                <dd className="font-semibold">
                  {doc.retain_until}
                  {!isRetentionSatisfied(doc.retain_until) ? ' · purge blocked' : ' · eligible for purge'}
                </dd>
              </div>
            )}
          </dl>

          {canManage && versions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Revision history
              </p>
              <ul className="space-y-2 text-sm">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2',
                      v.superseded_at && 'opacity-70',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {v.rev_label}
                        {v.id === doc.current_version_id ? ' · current' : ''}
                        {v.superseded_at ? ' · superseded' : ''}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {v.file_name_original} · {formatRelative(v.uploaded_at)}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onDownload(v)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              {doc.status === 'active' && !doc.legal_hold && (
                <div className="mt-2">
                  <input
                    ref={revInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      void onNewRevision(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => revInputRef.current?.click()}
                  >
                    Upload new revision
                  </Button>
                </div>
              )}
            </div>
          )}

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

          {purgeOpen && purgeCheck && (
            <div className="space-y-3 rounded-xl border border-rose/40 bg-rose-soft/40 p-3">
              <p className="text-sm font-semibold text-rose">Permanent purge</p>
              {!purgeCheck.ok ? (
                <p className="text-sm text-ink">{purgeCheck.reasons.join('. ')}</p>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Type the document title to confirm. This removes storage objects and keeps an audit
                    tombstone.
                  </p>
                  <input
                    value={purgeTyped}
                    onChange={(e) => setPurgeTyped(e.target.value)}
                    placeholder={purgeCheck.title}
                    className="h-10 w-full rounded-md border border-border px-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={saving || purgeTyped.trim() !== purgeCheck.title.trim()}
                    onClick={() => void confirmPurge()}
                  >
                    Purge forever
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setPurgeOpen(false)}>
                Cancel
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-rose">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <Button type="button" size="sm" onClick={() => onDownload()}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          {canHold && (
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void toggleHold()}>
              <Scale className="h-4 w-4" />
              {doc.legal_hold ? 'Lift hold' : 'Legal hold'}
            </Button>
          )}
          {canManage && doc.status === 'active' && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-4 w-4" />
                Archive
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={onTrash}>
                <Trash2 className="h-4 w-4" />
                Trash
              </Button>
            </>
          )}
          {canManage && (doc.status === 'trashed' || doc.status === 'archived') && (
            <Button type="button" variant="outline" size="sm" onClick={onRestore}>
              <RotateCcw className="h-4 w-4" />
              Restore
            </Button>
          )}
          {canPurge && doc.status === 'trashed' && (
            <Button type="button" variant="danger" size="sm" onClick={() => void openPurge()}>
              Purge
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
