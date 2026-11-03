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
import { todayISO, uid } from '../lib/utils'
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
  resetDemo: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await seedDemoPhotoBlobs(data)
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
    // Seed once on mount with initial data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready) saveAppData(data)
  }, [data, ready])

  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData(updater)
  }, [])

  const currentUser = useMemo(
    () => data.contacts.find((c) => c.id === data.currentUserId),
    [data.contacts, data.currentUserId],
  )

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
    [persist],
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
      const note: JobNote = {
        id: uid('note'),
        jobId,
        content: content.trim(),
        authorId: data.currentUserId,
        createdAt: new Date().toISOString(),
      }
      const notif: AppNotification = {
        id: uid('notif'),
        type: 'note',
        title: 'New note added',
        body: content.trim().slice(0, 120),
        jobId,
        createdAt: note.createdAt,
        read: false,
      }
      persist((prev) => ({
        ...prev,
        notes: [note, ...prev.notes],
        notifications: [notif, ...prev.notifications],
        activity: [
          {
            id: uid('act'),
            jobId,
            type: 'note',
            title: 'Note added',
            body: content.trim(),
            createdAt: note.createdAt,
            authorId: prev.currentUserId,
          },
          ...prev.activity,
        ],
      }))
    },
    [data.currentUserId, persist],
  )

  const saveDailyLog = useCallback(
    (log: Partial<DailyLog> & { jobId: string }, status: LogStatus) => {
      const now = new Date().toISOString()
      let logId = log.id ?? uid('log')

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
    [persist],
  )

  const deleteDailyLog = useCallback(
    (logId: string) => {
      persist((prev) => ({
        ...prev,
        dailyLogs: prev.dailyLogs.filter((l) => l.id !== logId),
      }))
    },
    [persist],
  )

  const addPhoto = useCallback(
    async (input: {
      jobId: string
      file: File
      category: PhotoCategory
      caption: string
    }) => {
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
    [data.currentUserId, persist],
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

  const resetDemo = useCallback(async () => {
    const fresh = await resetDemoData()
    setData(fresh)
  }, [])

  const value: AppContextValue = {
    data,
    ready,
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
    resetDemo,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
