export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'on_hold' | 'archived'
export type JobType =
  | 'Residential Remodeling'
  | 'Kitchen Renovation'
  | 'Commercial Tenant Improvement'
  | 'Exterior Renovation'
  | 'General Construction'
  | 'Property Maintenance'
export type PhotoCategory = 'before' | 'estimation' | 'progress' | 'after' | 'issue'
export type LogStatus = 'draft' | 'submitted'
export type MaterialStatus = 'needed' | 'ordered' | 'delivered' | 'missing'
export type NotificationType =
  | 'assignment'
  | 'contact'
  | 'instruction'
  | 'schedule'
  | 'materials'
  | 'note'

export interface Contact {
  id: string
  name: string
  role: string
  phone: string
  email?: string
  isCrew?: boolean
  associatedJobIds?: string[]
}

export interface ChecklistItem {
  id: string
  label: string
  completed: boolean
}

export interface MaterialItem {
  id: string
  name: string
  quantity: string
  status: MaterialStatus
  notes?: string
}

export interface DocumentItem {
  id: string
  title: string
  type: string
  description: string
}

export interface Job {
  id: string
  jobNumber: string
  name: string
  customer: string
  description: string
  type: JobType
  status: JobStatus
  scheduledDate: string
  startTime: string
  address: string
  city: string
  state: string
  zip: string
  parkingInstructions: string
  entranceInfo: string
  accessInstructions: string
  scopeOfWork: string
  importantInstructions: string
  requiredMaterials: string
  safetyConsiderations: string
  siteNotes: string
  primaryContactId: string
  projectManagerId: string
  siteSupervisorId: string
  otherContactIds: string[]
  assignedCrewIds: string[]
  checklist: ChecklistItem[]
  materials: MaterialItem[]
  documents: DocumentItem[]
  notices: string[]
  lat: number
  lng: number
}

export interface DailyLog {
  id: string
  jobId: string
  date: string
  workCompleted: string
  materialsUsed: string
  issues: string
  notesForNext: string
  photoIds: string[]
  status: LogStatus
  createdAt: string
  updatedAt: string
  authorId: string
}

export interface JobNote {
  id: string
  jobId: string
  content: string
  authorId: string
  createdAt: string
}

export interface JobPhoto {
  id: string
  jobId: string
  category: PhotoCategory
  caption: string
  createdAt: string
  authorId: string
  /** IndexedDB blob key — same as id for uploaded photos */
  blobKey: string
  /** For demo seed photos without blobs */
  placeholderColor?: string
  placeholderLabel?: string
}

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  jobId?: string
  createdAt: string
  read: boolean
}

export interface ActivityItem {
  id: string
  jobId: string
  type: 'note' | 'photo' | 'log' | 'status' | 'checklist' | 'material'
  title: string
  body: string
  createdAt: string
  authorId?: string
}

export interface AppData {
  version: number
  currentUserId: string
  jobs: Job[]
  contacts: Contact[]
  dailyLogs: DailyLog[]
  notes: JobNote[]
  photos: JobPhoto[]
  notifications: AppNotification[]
  activity: ActivityItem[]
}

export const DATA_VERSION = 1
export const STORAGE_KEY = 'britton-field-data'
