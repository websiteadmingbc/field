import type { AppData, Contact, DailyLog, JobPhoto } from '../../types'
import { DATA_VERSION } from '../../types'
import { getSupabase } from './client'
import { projectToJob } from './projects'
import type { ProjectRow } from './database.types'

export async function loadRemoteAppData(userId: string): Promise<AppData> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const [
    { data: projects, error: projectsError },
    { data: profiles, error: profilesError },
    { data: assignments, error: assignmentsError },
    { data: notices, error: noticesError },
    { data: logs, error: logsError },
    { data: photos, error: photosError },
    { data: activity, error: activityError },
    { data: siteContacts, error: siteContactsError },
  ] = await Promise.all([
    supabase.from('projects').select('*').order('scheduled_date', { ascending: true }),
    supabase.from('profiles').select('*').eq('active', true),
    supabase.from('project_assignments').select('*'),
    supabase.from('project_notices').select('*').order('created_at', { ascending: false }),
    supabase.from('daily_logs').select('*').order('log_date', { ascending: false }),
    supabase.from('photos').select('*').order('created_at', { ascending: false }),
    supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('site_contacts').select('*'),
  ])

  const firstError =
    projectsError ||
    profilesError ||
    assignmentsError ||
    noticesError ||
    logsError ||
    photosError ||
    activityError ||
    siteContactsError
  if (firstError) throw firstError

  const projectRows = (projects ?? []) as ProjectRow[]
  const assignmentRows = assignments ?? []
  const noticeRows = notices ?? []
  const siteContactRows = siteContacts ?? []

  const crewContacts: Contact[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    role: p.title || p.app_role,
    phone: p.phone ?? '',
    email: p.email,
    isCrew: true,
    associatedJobIds: assignmentRows.filter((a) => a.user_id === p.id).map((a) => a.project_id),
  }))

  const siteAsContacts: Contact[] = siteContactRows.map((c) => ({
    id: c.id,
    name: c.full_name,
    role: c.contact_role,
    phone: c.phone,
    email: c.email ?? undefined,
    isCrew: false,
    associatedJobIds: [c.project_id],
  }))

  const contacts = [...crewContacts, ...siteAsContacts]

  const jobs = projectRows.map((row) => {
    const projectNotices = noticeRows
      .filter((n) => n.project_id === row.id)
      .map((n) => n.body)
    const assignedCrewIds = assignmentRows
      .filter((a) => a.project_id === row.id)
      .map((a) => a.user_id)
    const primary = siteContactRows.find((c) => c.project_id === row.id && c.is_primary)
    const pm = assignmentRows.find(
      (a) => a.project_id === row.id && a.assignment_role === 'project_manager',
    )
    const supervisor = assignmentRows.find(
      (a) => a.project_id === row.id && a.assignment_role === 'site_supervisor',
    )
    return projectToJob(row, {
      notices: projectNotices,
      assignedCrewIds,
      primaryContactId: primary?.id ?? '',
      projectManagerId: pm?.user_id ?? '',
      siteSupervisorId: supervisor?.user_id ?? '',
    })
  })

  const dailyLogs: DailyLog[] = (logs ?? []).map((l) => ({
    id: l.id,
    jobId: l.project_id,
    date: l.log_date,
    workCompleted: l.work_completed,
    materialsUsed: l.materials_used,
    issues: l.issues,
    notesForNext: l.notes_for_next,
    photoIds: [],
    status: l.status,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    authorId: l.author_id,
  }))

  const jobPhotos: JobPhoto[] = (photos ?? []).map((p) => ({
    id: p.id,
    jobId: p.project_id,
    category: p.category,
    caption: p.caption,
    createdAt: p.created_at,
    authorId: p.author_id,
    blobKey: p.storage_path,
  }))

  return {
    version: DATA_VERSION,
    currentUserId: userId,
    jobs,
    contacts,
    dailyLogs,
    notes: [],
    photos: jobPhotos,
    notifications: [],
    activity: (activity ?? []).map((a) => ({
      id: a.id,
      jobId: a.project_id,
      type: (a.activity_type as AppData['activity'][number]['type']) || 'note',
      title: a.title,
      body: a.body,
      createdAt: a.created_at,
      authorId: a.author_id ?? undefined,
    })),
  }
}
