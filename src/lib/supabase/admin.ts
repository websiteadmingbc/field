import type { AppRole, Profile } from '../../types/auth'
import type { JobStatus, JobType } from '../../types'
import { getSupabase } from './client'
import type { ProjectRow } from './database.types'

export type ProjectInput = {
  job_number: string
  name: string
  client: string
  description: string
  job_type: string
  status: JobStatus
  scheduled_date: string | null
  start_time: string
  address: string
  city: string
  state: string
  zip: string
  parking_instructions: string
  entrance_info: string
  access_instructions: string
  scope_of_work: string
  important_instructions: string
  required_materials: string
  safety_considerations: string
  site_notes: string
  lat: number | null
  lng: number | null
}

export type SiteContactRow = {
  id: string
  project_id: string
  full_name: string
  contact_role: string
  phone: string
  email: string | null
  is_primary: boolean
  created_at: string
}

export type AssignmentRow = {
  project_id: string
  user_id: string
  assignment_role: string
  created_at: string
}

export const JOB_TYPE_OPTIONS: JobType[] = [
  'Residential Remodeling',
  'Kitchen Renovation',
  'Commercial Tenant Improvement',
  'Exterior Renovation',
  'General Construction',
  'Property Maintenance',
]

export const JOB_STATUS_OPTIONS: JobStatus[] = [
  'scheduled',
  'in_progress',
  'completed',
  'on_hold',
]

export const APP_ROLE_OPTIONS: AppRole[] = [
  'admin',
  'general_manager',
  'operations_manager',
  'estimator',
  'office_manager',
  'bookkeeper',
  'project_manager',
  'project_coordinator',
  'project_engineer',
  'site_supervisor',
  'safety_officer',
  'crew_lead',
  'crew',
  'tradesperson',
  'equipment_operator',
  'laborer',
  'apprentice',
  'subcontractor',
  'client',
]

export function emptyProjectInput(): ProjectInput {
  return {
    job_number: '',
    name: '',
    client: '',
    description: '',
    job_type: 'General Construction',
    status: 'scheduled',
    scheduled_date: new Date().toISOString().slice(0, 10),
    start_time: '07:00',
    address: '',
    city: '',
    state: 'CA',
    zip: '',
    parking_instructions: '',
    entrance_info: '',
    access_instructions: '',
    scope_of_work: '',
    important_instructions: '',
    required_materials: '',
    safety_considerations: '',
    site_notes: '',
    lat: null,
    lng: null,
  }
}

export function projectToInput(row: ProjectRow): ProjectInput {
  return {
    job_number: row.job_number,
    name: row.name,
    client: row.client,
    description: row.description,
    job_type: row.job_type,
    status: row.status,
    scheduled_date: row.scheduled_date,
    start_time: row.start_time,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    parking_instructions: row.parking_instructions,
    entrance_info: row.entrance_info,
    access_instructions: row.access_instructions,
    scope_of_work: row.scope_of_work,
    important_instructions: row.important_instructions,
    required_materials: row.required_materials,
    safety_considerations: row.safety_considerations,
    site_notes: row.site_notes,
    lat: row.lat,
    lng: row.lng,
  }
}

export async function createProject(input: ProjectInput): Promise<ProjectRow> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.from('projects').insert(input).select('*').single()
  if (error) throw error
  return data as ProjectRow
}

export async function updateProject(id: string, input: ProjectInput): Promise<ProjectRow> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ProjectRow
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function fetchProject(id: string): Promise<ProjectRow | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as ProjectRow | null
}

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'full_name' | 'title' | 'phone' | 'app_role' | 'active'>>,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw error
}

export async function fetchAssignments(projectId: string): Promise<AssignmentRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_assignments')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []) as AssignmentRow[]
}

export async function setProjectAssignments(
  projectId: string,
  userIds: string[],
  roleByUser: Record<string, string> = {},
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { error: delError } = await supabase
    .from('project_assignments')
    .delete()
    .eq('project_id', projectId)
  if (delError) throw delError

  if (userIds.length === 0) return

  const rows = userIds.map((user_id) => ({
    project_id: projectId,
    user_id,
    assignment_role: roleByUser[user_id] || 'crew',
  }))
  const { error } = await supabase.from('project_assignments').insert(rows)
  if (error) throw error
}

export async function fetchSiteContacts(projectId: string): Promise<SiteContactRow[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_contacts')
    .select('*')
    .eq('project_id', projectId)
    .order('is_primary', { ascending: false })
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as SiteContactRow[]
}

export async function upsertSiteContact(
  contact: Omit<SiteContactRow, 'id' | 'created_at'> & { id?: string },
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  if (contact.is_primary) {
    await supabase
      .from('site_contacts')
      .update({ is_primary: false })
      .eq('project_id', contact.project_id)
  }

  if (contact.id) {
    const { error } = await supabase
      .from('site_contacts')
      .update({
        full_name: contact.full_name,
        contact_role: contact.contact_role,
        phone: contact.phone,
        email: contact.email,
        is_primary: contact.is_primary,
      })
      .eq('id', contact.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('site_contacts').insert({
    project_id: contact.project_id,
    full_name: contact.full_name,
    contact_role: contact.contact_role,
    phone: contact.phone,
    email: contact.email,
    is_primary: contact.is_primary,
  })
  if (error) throw error
}

export async function deleteSiteContact(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('site_contacts').delete().eq('id', id)
  if (error) throw error
}

export async function inviteUser(input: {
  email: string
  full_name: string
  title: string
  phone: string
  app_role: AppRole
  personnelId?: string
}): Promise<{ userId?: string }> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { personnelId, ...body } = input
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body,
  })

  if (error) {
    throw new Error(error.message || 'Invite failed. Deploy the invite-user Edge Function.')
  }
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Invite failed')
  }

  const userId = typeof data?.id === 'string' ? data.id : undefined

  if (personnelId && userId) {
    const { error: linkError } = await supabase
      .from('personnel')
      .update({ linked_user_id: userId })
      .eq('id', personnelId)
    if (linkError) throw linkError
  }

  return { userId }
}
