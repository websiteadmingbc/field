import { useEffect, useState } from 'react'
import { Link2, Pin, Share2, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  addDocumentLink,
  fetchDocumentLinks,
  fetchDocumentShares,
  fetchShareablePersonnel,
  grantDocumentShare,
  removeDocumentLink,
  revokeDocumentShare,
  type DocumentLink,
  type DocumentShare,
  type ShareablePersonnel,
} from '../../lib/supabase/documentSharing'
import {
  getPinnedDocument,
  openPinnedBlob,
  pinDocumentOffline,
  unpinDocumentOffline,
} from '../../lib/documents/offlinePins'
import { getDocumentSignedUrl } from '../../lib/supabase/documents'
import type { LibraryDocument } from '../../types/documents'
import type { DailyLog } from '../../types'

type Props = {
  doc: LibraryDocument
  jobId: string
  jobNumber: string
  canManage: boolean
  canPin: boolean
  dailyLogs?: DailyLog[]
}

export function DocumentCollaboratePanel({
  doc,
  jobId,
  jobNumber,
  canManage,
  canPin,
  dailyLogs = [],
}: Props) {
  const [shares, setShares] = useState<DocumentShare[]>([])
  const [links, setLinks] = useState<DocumentLink[]>([])
  const [people, setPeople] = useState<ShareablePersonnel[]>([])
  const [personnelId, setPersonnelId] = useState('')
  const [linkType, setLinkType] = useState<'daily_log' | 'change_order' | 'rfi'>('daily_log')
  const [logId, setLogId] = useState('')
  const [refLabel, setRefLabel] = useState('')
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function refresh() {
    if (canManage) {
      const [s, l, p] = await Promise.all([
        fetchDocumentShares(doc.id),
        fetchDocumentLinks(doc.id),
        fetchShareablePersonnel(),
      ])
      setShares(s)
      setLinks(l)
      setPeople(p.filter((x) => x.linked_user_id || x.classification === 'subcontractor'))
    } else {
      try {
        setLinks(await fetchDocumentLinks(doc.id))
      } catch {
        setLinks([])
      }
    }
    setPinned(Boolean(await getPinnedDocument(doc.id)))
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [doc.id, canManage])

  async function onPin() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (pinned) {
        await unpinDocumentOffline(doc.id)
        setPinned(false)
        setNotice('Removed offline pin')
      } else {
        const path = doc.current_version?.storage_path
        if (!path) throw new Error('No file to pin')
        const url = await getDocumentSignedUrl(path)
        if (!url) throw new Error('Could not download for offline pin')
        const res = await fetch(url)
        if (!res.ok) throw new Error('Download failed')
        const blob = await res.blob()
        await pinDocumentOffline({
          documentId: doc.id,
          jobId,
          jobNumber,
          title: doc.title,
          categoryName: doc.category?.name ?? 'Document',
          revLabel: doc.current_version?.rev_label ?? 'R0',
          mimeType: doc.current_version?.mime_type ?? blob.type,
          fileName: doc.current_version?.file_name_original ?? 'document',
          pinnedAt: new Date().toISOString(),
          blob,
        })
        setPinned(true)
        setNotice('Pinned for offline use on this device')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pin failed')
    } finally {
      setBusy(false)
    }
  }

  async function onOpenPinned() {
    const pin = await getPinnedDocument(doc.id)
    if (pin) openPinnedBlob(pin)
  }

  async function onShare() {
    if (!personnelId) return
    setBusy(true)
    setError(null)
    try {
      await grantDocumentShare({ documentId: doc.id, personnelId })
      setPersonnelId('')
      await refresh()
      setNotice('Shared with selected person')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share failed')
    } finally {
      setBusy(false)
    }
  }

  async function onAddLink() {
    setBusy(true)
    setError(null)
    try {
      if (linkType === 'daily_log') {
        if (!logId) throw new Error('Pick a daily log')
        const log = dailyLogs.find((l) => l.id === logId)
        await addDocumentLink({
          documentId: doc.id,
          entityType: 'daily_log',
          entityId: logId,
          label: log ? `Daily log ${log.date}` : 'Daily log',
        })
      } else {
        if (!refLabel.trim()) throw new Error('Enter an RFI or CO reference')
        await addDocumentLink({
          documentId: doc.id,
          entityType: linkType,
          entityId: crypto.randomUUID(),
          label: refLabel.trim(),
        })
      }
      setRefLabel('')
      setLogId('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed')
    } finally {
      setBusy(false)
    }
  }

  const jobLogs = dailyLogs.filter((l) => l.jobId === jobId)

  return (
    <div className="space-y-4">
      {canPin && (
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Offline pin
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onPin()}>
              <Pin className="h-4 w-4" />
              {pinned ? 'Unpin' : 'Pin for offline'}
            </Button>
            {pinned && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void onOpenPinned()}>
                Open offline copy
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Pins store the current file on this device for weak-signal sites (plans & permits).
          </p>
        </div>
      )}

      {canManage && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Share2 className="mr-1 inline h-3.5 w-3.5" />
            Share with subcontractor
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={personnelId}
              onChange={(e) => setPersonnelId(e.target.value)}
              className="h-10 min-w-[180px] flex-1 rounded-md border border-border px-2 text-sm"
            >
              <option value="">Select person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.preferred_name || p.first_name} {p.last_name}
                  {!p.linked_user_id ? ' (no app login)' : ''}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={busy || !personnelId} onClick={() => void onShare()}>
              Share
            </Button>
          </div>
          {shares.length === 0 ? (
            <p className="text-xs text-ink-muted">No shares yet. Sharing sets visibility to Shared.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {shares.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span>
                    {s.personnel
                      ? `${s.personnel.preferred_name || s.personnel.first_name} ${s.personnel.last_name}`
                      : s.personnel_id}
                  </span>
                  <button
                    type="button"
                    className="text-rose"
                    aria-label="Revoke share"
                    onClick={() =>
                      void revokeDocumentShare(s.id)
                        .then(refresh)
                        .catch((e) => setError(e instanceof Error ? e.message : 'Revoke failed'))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(canManage || links.length > 0) && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Link2 className="mr-1 inline h-3.5 w-3.5" />
            Linked items
          </p>
          {canManage && (
            <div className="space-y-2">
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as typeof linkType)}
                className="h-10 w-full rounded-md border border-border px-2 text-sm"
              >
                <option value="daily_log">Daily log</option>
                <option value="rfi">RFI reference</option>
                <option value="change_order">Change order reference</option>
              </select>
              {linkType === 'daily_log' ? (
                <select
                  value={logId}
                  onChange={(e) => setLogId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border px-2 text-sm"
                >
                  <option value="">Select log…</option>
                  {jobLogs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.date} · {l.status}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={refLabel}
                  onChange={(e) => setRefLabel(e.target.value)}
                  placeholder={linkType === 'rfi' ? 'e.g. RFI-012' : 'e.g. CO-003'}
                  className="h-10 w-full rounded-md border border-border px-2 text-sm"
                />
              )}
              <Button type="button" size="sm" disabled={busy} onClick={() => void onAddLink()}>
                Add link
              </Button>
            </div>
          )}
          {links.length === 0 ? (
            <p className="text-xs text-ink-muted">No linked RFIs, COs, or daily logs.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span className="capitalize">
                    {l.entity_type.replace('_', ' ')}
                    {l.label ? ` · ${l.label}` : ''}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className="text-rose"
                      aria-label="Remove link"
                      onClick={() =>
                        void removeDocumentLink(l.id)
                          .then(refresh)
                          .catch((e) => setError(e instanceof Error ? e.message : 'Remove failed'))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {notice && <p className="text-sm text-emerald">{notice}</p>}
      {error && <p className="text-sm text-rose">{error}</p>}
    </div>
  )
}
