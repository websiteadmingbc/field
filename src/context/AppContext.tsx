import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadAppData, resetDemoData, saveAppData, seedDemoPhotoBlobs } from '../lib/storage'
import { savePhotoBlob } from '../lib/idb'
import { uid, todayISO } from '../lib/utils'
import { getSupabase } from '../lib/supabase/client'
import { loadRemoteAppData } from '../lib/supabase/loadAppData'
import { extensionForImage, guessImageContentType } from '../lib/supabase/photos'
import { addProjectNotice, updateProjectStatus as remoteUpdateStatus } from '../lib/supabase/projects'
import { useAuth } from './AuthContext'
import type {
  AppData,
  AppNotification,
  DailyLog,
  Job,
  JobNote,
  JobPhoto,
  JobStatus,
  LogStatus,
  MaterialItem,
  MaterialStatus,
  PhotoCategory,
} from '../types'

interface AppContextValue {
  data: AppData
  ready: boolean
  remote: boolean
  currentUser: AppData['contacts'][number] | undefined
  unreadCount: number
  getJob: (id: string) => Job | undefined
  getContact: (id: string) => AppData['contacts'][number] | undefined
  updateJobStatus: (jobId: string, status: JobStatus) => void
  toggleChecklistItem: (jobId: string, itemId: string) => void
  addMaterial: (jobId: string, item: Omit<MaterialItem, 'id'>) => void
  updateMaterialStatus: (jobId: string, materialId: string, status: MaterialStatus) => void
  addNote: (jobId: string, content: string) => void
  saveDailyLog: (log: Partial<DailyLog> & { jobId: string }, status: LogStatus) => string
  deleteDailyLog: (logId: string) => void
  addPhoto: (input: {
    jobId: string
    file: File
    category: PhotoCategory
    caption: string
  }) => Promise<string>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  pushNotification: (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => void
  resetDemo: () => Promise<void>
  refreshRemote: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { configured, session, profile } = useAuth()
  const remote = Boolean(configured && session?.user)

  const [data, setData] = useState<AppData>(() => loadAppData())
  const [ready, setReady] = useState(false)

  const refreshRemote = useCallback(async () => {
    if (!session?.user) return
    const remoteData = await loadRemoteAppData(session.user.id)
    setData(remoteData)
  }, [session?.user])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (remote && session?.user) {
        try {
          const remoteData = await loadRemoteAppData(session.user.id)
          if (!cancelled) {
            setData(remoteData)
            setReady(true)
          }
        } catch (err) {
          console.error(err)
          if (!cancelled) setReady(true)
        }
        return
      }

      // Demo / local POC mode
      const local = loadAppData()
      await seedDemoPhotoBlobs(local)
      if (!cancelled) {
        setData(local)
        setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [remote, session?.user?.id])

  useEffect(() => {
    if (ready && !remote) saveAppData(data)
  }, [data, ready, remote])

  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData(updater)
  }, [])

  const currentUser = useMemo(() => {
    if (remote && profile) {
      return (
        data.contacts.find((c) => c.id === profile.id) ?? {
          id: profile.id,
          name: profile.full_name,
          role: profile.title || profile.app_role,
          phone: profile.phone ?? '',
          email: profile.email,
          isCrew: true,
        }
      )
    }
    return data.contacts.find((c) => c.id === data.currentUserId)
  }, [data.contacts, data.currentUserId, remote, profile])

  const unreadCount = useMemo(
    () => data.notifications.filter((n) => !n.read).length,
    [data.notifications],
  )

  const getJob = useCallback((id: string) => data.jobs.find((j) => j.id === id), [data.jobs])
  const getContact = useCallback(
    (id: string) => data.contacts.find((c) => c.id === id),
    [data.contacts],
  )

  const updateJobStatus = useCallback(
    (jobId: string, status: JobStatus) => {
      if (remote) {
        void remoteUpdateStatus(jobId, status)
          .then(() => refreshRemote())
          .catch((err) => console.error(err))
      }
      persist((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => (j.id === jobId ? { ...j, status } : j)),
        activity: [
          {
            id: uid('act'),
            jobId,
            type: 'status',
            title: 'Status updated',
            body: `Job marked ${status.replace('_', ' ')}`,
            createdAt: new Date().toISOString(),
            authorId: prev.currentUserId,
          },
          ...prev.activity,
        ],
      }))
    },
    [persist, remote, refreshRemote],
  )

  const toggleChecklistItem = useCallback(
    (jobId: string, itemId: string) => {
      persist((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => {
          if (j.id !== jobId) return j
          return {
            ...j,
            checklist: j.checklist.map((c) =>
              c.id === itemId ? { ...c, completed: !c.completed } : c,
            ),
          }
        }),
      }))
    },
    [persist],
  )

  const addMaterial = useCallback(
    (jobId: string, item: Omit<MaterialItem, 'id'>) => {
      persist((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.id === jobId
            ? { ...j, materials: [...j.materials, { ...item, id: uid('mat') }] }
            : j,
        ),
        activity: [
          {
            id: uid('act'),
            jobId,
            type: 'material',
            title: 'Material recorded',
            body: `${item.name} — ${item.status}`,
            createdAt: new Date().toISOString(),
            authorId: prev.currentUserId,
          },
          ...prev.activity,
        ],
      }))
    },
    [persist],
  )

  const updateMaterialStatus = useCallback(
    (jobId: string, materialId: string, status: MaterialStatus) => {
      persist((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) => {
          if (j.id !== jobId) return j
          return {
            ...j,
            materials: j.materials.map((m) => (m.id === materialId ? { ...m, status } : m)),
          }
        }),
      }))
    },
    [persist],
  )

  const addNote = useCallback(
    (jobId: string, content: string) => {
      const trimmed = content.trim()
      if (remote) {
        void addProjectNotice(jobId, trimmed)
          .then(() => refreshRemote())
          .catch((err) => console.error(err))
      }

      const note: JobNote = {
        id: uid('note'),
        jobId,
        content: trimmed,
        authorId: data.currentUserId,
        createdAt: new Date().toISOString(),
      }
      const notif: AppNotification = {
        id: uid('notif'),
        type: 'note',
        title: 'New note added',
        body: trimmed.slice(0, 120),
        jobId,
        createdAt: note.createdAt,
        read: false,
      }
      persist((prev) => ({
        ...prev,
        notes: [note, ...prev.notes],
        notifications: [notif, ...prev.notifications],
        jobs: prev.jobs.map((j) =>
          j.id === jobId ? { ...j, notices: [trimmed, ...j.notices] } : j,
        ),
        activity: [
          {
            id: uid('act'),
            jobId,
            type: 'note',
            title: 'Note added',
            body: trimmed,
            createdAt: note.createdAt,
            authorId: prev.currentUserId,
          },
          ...prev.activity,
        ],
      }))
    },
    [data.currentUserId, persist, remote, refreshRemote],
  )

  const saveDailyLog = useCallback(
    (log: Partial<DailyLog> & { jobId: string }, status: LogStatus) => {
      const now = new Date().toISOString()
      const logId = log.id ?? uid('log')

      if (remote) {
        const supabase = getSupabase()
        if (supabase && session?.user) {
          const payload = {
            project_id: log.jobId,
            author_id: session.user.id,
            log_date: log.date ?? todayISO(),
            work_completed: log.workCompleted ?? '',
            materials_used: log.materialsUsed ?? '',
            issues: log.issues ?? '',
            notes_for_next: log.notesForNext ?? '',
            status,
          }
          void (async () => {
            const result = log.id
              ? await supabase.from('daily_logs').update(payload).eq('id', log.id)
              : await supabase.from('daily_logs').insert(payload)
            if (result.error) throw result.error
            await refreshRemote()
          })().catch((err) => console.error(err))
        }
      }

      persist((prev) => {
        const existing = log.id ? prev.dailyLogs.find((l) => l.id === log.id) : undefined
        const next: DailyLog = {
          id: logId,
          jobId: log.jobId,
          date: log.date ?? todayISO(),
          workCompleted: log.workCompleted ?? '',
          materialsUsed: log.materialsUsed ?? '',
          issues: log.issues ?? '',
          notesForNext: log.notesForNext ?? '',
          photoIds: log.photoIds ?? existing?.photoIds ?? [],
          status,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          authorId: prev.currentUserId,
        }

        const dailyLogs = existing
          ? prev.dailyLogs.map((l) => (l.id === existing.id ? next : l))
          : [next, ...prev.dailyLogs]

        const activity =
          status === 'submitted'
            ? [
                {
                  id: uid('act'),
                  jobId: next.jobId,
                  type: 'log' as const,
                  title: 'Daily log submitted',
                  body: next.workCompleted.slice(0, 140) || 'Log submitted',
                  createdAt: now,
                  authorId: prev.currentUserId,
                },
                ...prev.activity,
              ]
            : prev.activity

        return { ...prev, dailyLogs, activity }
      })

      return logId
    },
    [persist, remote, session?.user, refreshRemote],
  )

  const deleteDailyLog = useCallback(
    (logId: string) => {
      if (remote) {
        const supabase = getSupabase()
        void (async () => {
          if (!supabase) return
          const { error } = await supabase.from('daily_logs').delete().eq('id', logId)
          if (error) throw error
          await refreshRemote()
        })().catch((err) => console.error(err))
      }
      persist((prev) => ({
        ...prev,
        dailyLogs: prev.dailyLogs.filter((l) => l.id !== logId),
      }))
    },
    [persist, remote, refreshRemote],
  )

  const addPhoto = useCallback(
    async (input: {
      jobId: string
      file: File
      category: PhotoCategory
      caption: string
    }) => {
      if (remote) {
        const supabase = getSupabase()
        if (!supabase || !session?.user) throw new Error('Not signed in')
        const id = crypto.randomUUID()
        const ext = extensionForImage(input.file)
        const contentType = guessImageContentType(input.file)
        const storagePath = `${input.jobId}/${id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(storagePath, input.file, { contentType, upsert: false })
        if (uploadError) {
          throw new Error(uploadError.message || 'Photo upload failed')
        }
        const { error: insertError } = await supabase.from('photos').insert({
          id,
          project_id: input.jobId,
          author_id: session.user.id,
          category: input.category,
          caption: input.caption,
          storage_path: storagePath,
        })
        if (insertError) {
          throw new Error(insertError.message || 'Could not save photo record')
        }
        await refreshRemote()
        return id
      }

      const id = uid('photo')
      await savePhotoBlob(id, input.file)
      const photo: JobPhoto = {
        id,
        jobId: input.jobId,
        category: input.category,
        caption: input.caption,
        createdAt: new Date().toISOString(),
        authorId: data.currentUserId,
        blobKey: id,
      }
      persist((prev) => ({
        ...prev,
        photos: [photo, ...prev.photos],
        activity: [
          {
            id: uid('act'),
            jobId: input.jobId,
            type: 'photo',
            title: 'Photo added',
            body: input.caption || `${input.category} photo`,
            createdAt: photo.createdAt,
            authorId: prev.currentUserId,
          },
          ...prev.activity,
        ],
      }))
      return id
    },
    [data.currentUserId, persist, remote, session?.user, refreshRemote],
  )

  const markNotificationRead = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      }))
    },
    [persist],
  )

  const markAllNotificationsRead = useCallback(() => {
    persist((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }))
  }, [persist])

  const pushNotification = useCallback(
    (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => {
      const notif: AppNotification = {
        id: input.id ?? uid('notif'),
        type: input.type,
        title: input.title,
        body: input.body,
        jobId: input.jobId,
        createdAt: new Date().toISOString(),
        read: false,
      }
      persist((prev) => ({
        ...prev,
        notifications: [notif, ...prev.notifications],
      }))
    },
    [persist],
  )

  const resetDemo = useCallback(async () => {
    if (remote) return
    const fresh = await resetDemoData()
    setData(fresh)
  }, [remote])

  const value: AppContextValue = {
    data,
    ready,
    remote,
    currentUser,
    unreadCount,
    getJob,
    getContact,
    updateJobStatus,
    toggleChecklistItem,
    addMaterial,
    updateMaterialStatus,
    addNote,
    saveDailyLog,
    deleteDailyLog,
    addPhoto,
    markNotificationRead,
    markAllNotificationsRead,
    pushNotification,
    resetDemo,
    refreshRemote,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
