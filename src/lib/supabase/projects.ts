import type { Job, JobStatus } from '../../types'
import { getSupabase } from './client'
import type { ProjectRow } from './database.types'

export interface ProjectNotice {
  id: string
  project_id: string
  body: string
  author_id: string | null
  created_at: string
}

export function projectToJob(
  row: ProjectRow,
  extras?: {
    notices?: string[]
    assignedCrewIds?: string[]
    primaryContactId?: string
    projectManagerId?: string
    siteSupervisorId?: string
  },
): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    name: row.name,
    customer: row.client,
    description: row.description,
    type: row.job_type as Job['type'],
    status: row.status,
    scheduledDate: row.scheduled_date ?? '',
    startTime: row.start_time,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    parkingInstructions: row.parking_instructions,
    entranceInfo: row.entrance_info,
    accessInstructions: row.access_instructions,
    scopeOfWork: row.scope_of_work,
    importantInstructions: row.important_instructions,
    requiredMaterials: row.required_materials,
    safetyConsiderations: row.safety_considerations,
    siteNotes: row.site_notes,
    primaryContactId: extras?.primaryContactId ?? '',
    projectManagerId: extras?.projectManagerId ?? '',
    siteSupervisorId: extras?.siteSupervisorId ?? '',
    otherContactIds: [],
    assignedCrewIds: extras?.assignedCrewIds ?? [],
    checklist: Array.isArray(row.checklist) ? (row.checklist as unknown as Job['checklist']) : [],
    materials: Array.isArray(row.materials) ? (row.materials as unknown as Job['materials']) : [],
    documents: Array.isArray(row.documents) ? (row.documents as unknown as Job['documents']) : [],
    notices: extras?.notices ?? [],
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
  }
}

export async function fetchProjects(opts?: { includeArchived?: boolean }): Promise<ProjectRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  let query = supabase
    .from('projects')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
  if (!opts?.includeArchived) {
    query = query.neq('status', 'archived')
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchNoticesForProjects(projectIds: string[]): Promise<ProjectNotice[]> {
  const supabase = getSupabase()
  if (!supabase || projectIds.length === 0) return []
  const { data, error } = await supabase
    .from('project_notices')
    .select('*')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjectNotice[]
}

export async function updateProjectStatus(projectId: string, status: JobStatus): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId)
  if (error) throw error

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('activity').insert({
    project_id: projectId,
    author_id: user?.id ?? null,
    activity_type: 'status',
    title: 'Status updated',
    body: `Job marked ${status.replace('_', ' ')}`,
  })
}

export async function addProjectNotice(projectId: string, body: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { error } = await supabase.from('project_notices').insert({
    project_id: projectId,
    body,
    author_id: user.id,
  })
  if (error) throw error

  await supabase.from('activity').insert({
    project_id: projectId,
    author_id: user.id,
    activity_type: 'note',
    title: 'Site notice posted',
    body,
  })
}
