import type { AppRole, Profile } from '../../types/auth'
import type {
  AssignmentStatus,
  Company,
  DocumentCategory,
  InsurancePolicy,
  License,
  Personnel,
  PersonnelActivity,
  PersonnelAffiliation,
  PersonnelCertification,
  PersonnelDocument,
  PersonnelInput,
  PersonnelListItem,
  PersonnelProjectAssignment,
  PersonnelSensitive,
  PersonnelSkill,
  SensitiveInput,
  VerificationStatus,
} from '../../types/personnel'
import { personnelDisplayName } from '../../types/personnel'
import { getSupabase } from './client'
import { inviteUser } from './admin'

export type PersonnelFilters = {
  search?: string
  classification?: string
  status?: string
  companyId?: string
  department?: string
  sort?: 'name' | 'start_date' | 'status'
  sortDir?: 'asc' | 'desc'
  includeArchived?: boolean
}

type AffiliationJoin = {
  id: string
  is_primary: boolean
  company_id: string
  companies: Company | null
}

function toListItem(row: Personnel & { personnel_company_affiliations?: AffiliationJoin[] }): PersonnelListItem {
  const primary =
    (row.personnel_company_affiliations ?? []).find((a) => a.is_primary) ??
    (row.personnel_company_affiliations ?? [])[0]
  const { personnel_company_affiliations: _aff, ...rest } = row
  return {
    ...rest,
    primary_company: primary?.companies ?? null,
    display_name: personnelDisplayName(rest),
  }
}

export async function fetchPersonnelList(filters: PersonnelFilters = {}): Promise<PersonnelListItem[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  let query = supabase
    .from('personnel')
    .select(
      `
      *,
      personnel_company_affiliations (
        id,
        is_primary,
        company_id,
        companies (*)
      )
    `,
    )

  if (!filters.includeArchived) {
    query = query.neq('status', 'archived')
  }

  if (filters.classification) {
    query = query.eq('classification', filters.classification)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.department?.trim()) {
    query = query.ilike('department', `%${filters.department.trim()}%`)
  }

  const sort = filters.sort ?? 'name'
  const ascending = (filters.sortDir ?? 'asc') === 'asc'
  if (sort === 'name') {
    query = query.order('last_name', { ascending }).order('first_name', { ascending })
  } else if (sort === 'start_date') {
    query = query.order('start_date', { ascending, nullsFirst: false })
  } else {
    query = query.order('status', { ascending })
  }

  const { data, error } = await query
  if (error) throw error

  let items = ((data ?? []) as (Personnel & { personnel_company_affiliations?: AffiliationJoin[] })[]).map(
    toListItem,
  )

  if (filters.companyId) {
    items = items.filter((p) => p.primary_company?.id === filters.companyId)
  }

  const q = filters.search?.trim().toLowerCase()
  if (q) {
    items = items.filter((p) => {
      const hay = [
        p.display_name,
        p.first_name,
        p.last_name,
        p.preferred_name,
        p.personnel_code,
        p.job_title,
        p.work_email,
        p.mobile_phone,
        p.work_phone,
        p.primary_company?.name ?? '',
        p.department,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  return items
}

export async function fetchPersonnel(id: string): Promise<Personnel | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('personnel').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Personnel | null
}

export async function fetchPersonnelSensitive(
  personnelId: string,
): Promise<PersonnelSensitive | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('personnel_sensitive')
    .select('*')
    .eq('personnel_id', personnelId)
    .maybeSingle()
  if (error) {
    // Ops Manager may not have access — treat as empty
    if (error.code === 'PGRST116' || /permission|policy|RLS/i.test(error.message)) return null
    throw error
  }
  return data as PersonnelSensitive | null
}

export async function fetchPersonnelAffiliations(
  personnelId: string,
): Promise<PersonnelAffiliation[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('personnel_company_affiliations')
    .select('*, companies (*)')
    .eq('personnel_id', personnelId)
  if (error) throw error
  return ((data ?? []) as (PersonnelAffiliation & { companies: PersonnelAffiliation['company'] })[]).map(
    (row) => ({
      id: row.id,
      personnel_id: row.personnel_id,
      company_id: row.company_id,
      is_primary: row.is_primary,
      notes: row.notes,
      created_at: row.created_at,
      company: row.companies ?? undefined,
    }),
  )
}

async function setPrimaryAffiliation(
  personnelId: string,
  companyId: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  await supabase.from('personnel_company_affiliations').delete().eq('personnel_id', personnelId)

  if (!companyId) return

  const { error } = await supabase.from('personnel_company_affiliations').insert({
    personnel_id: personnelId,
    company_id: companyId,
    is_primary: true,
  })
  if (error) throw error
}

export async function createPersonnel(
  input: PersonnelInput,
  sensitive?: SensitiveInput,
  actorId?: string | null,
): Promise<Personnel> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { company_id, ...fields } = input
  const { data, error } = await supabase
    .from('personnel')
    .insert({
      first_name: fields.first_name.trim(),
      middle_name: fields.middle_name.trim(),
      last_name: fields.last_name.trim(),
      preferred_name: fields.preferred_name.trim(),
      work_email: fields.work_email.trim(),
      mobile_phone: fields.mobile_phone.trim(),
      work_phone: fields.work_phone.trim(),
      preferred_contact_method: fields.preferred_contact_method,
      business_address: fields.business_address.trim(),
      city: fields.city.trim(),
      state: fields.state.trim(),
      zip: fields.zip.trim(),
      classification: fields.classification,
      job_title: fields.job_title.trim(),
      department: fields.department.trim(),
      primary_role: fields.primary_role.trim(),
      additional_roles: fields.additional_roles,
      reports_to: fields.reports_to,
      status: fields.status,
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      work_arrangement: fields.work_arrangement.trim(),
      primary_work_location: fields.primary_work_location.trim(),
      service_territory: fields.service_territory.trim(),
      availability: fields.availability.trim(),
    })
    .select('*')
    .single()

  if (error) throw error
  const person = data as Personnel

  await setPrimaryAffiliation(person.id, company_id)

  if (sensitive) {
    await upsertSensitive(person.id, sensitive)
  }

  await logActivity({
    personnel_id: person.id,
    actor_id: actorId ?? null,
    action: 'profile_created',
    entity_type: 'personnel',
    entity_id: person.id,
  })

  return person
}

export async function updatePersonnel(
  id: string,
  input: PersonnelInput,
  sensitive?: SensitiveInput,
  actorId?: string | null,
): Promise<Personnel> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { company_id, ...fields } = input
  const { data, error } = await supabase
    .from('personnel')
    .update({
      first_name: fields.first_name.trim(),
      middle_name: fields.middle_name.trim(),
      last_name: fields.last_name.trim(),
      preferred_name: fields.preferred_name.trim(),
      work_email: fields.work_email.trim(),
      mobile_phone: fields.mobile_phone.trim(),
      work_phone: fields.work_phone.trim(),
      preferred_contact_method: fields.preferred_contact_method,
      business_address: fields.business_address.trim(),
      city: fields.city.trim(),
      state: fields.state.trim(),
      zip: fields.zip.trim(),
      classification: fields.classification,
      job_title: fields.job_title.trim(),
      department: fields.department.trim(),
      primary_role: fields.primary_role.trim(),
      additional_roles: fields.additional_roles,
      reports_to: fields.reports_to,
      status: fields.status,
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      work_arrangement: fields.work_arrangement.trim(),
      primary_work_location: fields.primary_work_location.trim(),
      service_territory: fields.service_territory.trim(),
      availability: fields.availability.trim(),
      archived_at: fields.status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  const person = data as Personnel

  await setPrimaryAffiliation(id, company_id)

  if (sensitive) {
    await upsertSensitive(id, sensitive)
  }

  await logActivity({
    personnel_id: id,
    actor_id: actorId ?? null,
    action: 'profile_updated',
    entity_type: 'personnel',
    entity_id: id,
  })

  return person
}

export async function upsertSensitive(
  personnelId: string,
  input: SensitiveInput,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { error } = await supabase.from('personnel_sensitive').upsert({
    personnel_id: personnelId,
    personal_email: input.personal_email.trim(),
    emergency_contact_name: input.emergency_contact_name.trim(),
    emergency_contact_relationship: input.emergency_contact_relationship.trim(),
    emergency_contact_phone: input.emergency_contact_phone.trim(),
    internal_notes: input.internal_notes.trim(),
  })
  if (error) throw error
}

export async function archivePersonnel(
  id: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('personnel')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  await logActivity({
    personnel_id: id,
    actor_id: actorId ?? null,
    action: 'status_changed',
    entity_type: 'personnel',
    entity_id: id,
    metadata: { status: 'archived' },
  })
}

export async function linkPersonnelUser(
  personnelId: string,
  userId: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('personnel')
    .update({ linked_user_id: userId })
    .eq('id', personnelId)
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'access_linked',
    entity_type: 'personnel',
    entity_id: personnelId,
  })
}

export async function invitePersonnelToApp(input: {
  personnelId: string
  email: string
  full_name: string
  title: string
  phone: string
  app_role: AppRole
  actorId?: string | null
}): Promise<void> {
  const result = await inviteUser({
    email: input.email,
    full_name: input.full_name,
    title: input.title,
    phone: input.phone,
    app_role: input.app_role,
    personnelId: input.personnelId,
  })

  if (result.userId) {
    await logActivity({
      personnel_id: input.personnelId,
      actor_id: input.actorId ?? null,
      action: 'access_invited',
      entity_type: 'personnel',
      entity_id: input.personnelId,
    })
    return
  }

  // Fallback: resolve by email if edge function did not return id
  const supabase = getSupabase()
  if (!supabase) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', input.email.trim().toLowerCase())
    .maybeSingle()

  if (profile?.id) {
    await linkPersonnelUser(input.personnelId, profile.id, input.actorId)
  }
}

export async function fetchLinkedProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function logActivity(entry: {
  personnel_id: string | null
  actor_id: string | null
  action: string
  entity_type?: string
  entity_id?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.from('personnel_activity_log').insert({
    personnel_id: entry.personnel_id,
    actor_id: entry.actor_id,
    action: entry.action,
    entity_type: entry.entity_type ?? 'personnel',
    entity_id: entry.entity_id ?? null,
    metadata: entry.metadata ?? {},
  })
}

export async function fetchActivity(personnelId: string): Promise<PersonnelActivity[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('personnel_activity_log')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as PersonnelActivity[]
}

// ---------------------------------------------------------------------------
// Phase 2 helpers
// ---------------------------------------------------------------------------

export async function fetchSkills(personnelId: string): Promise<PersonnelSkill | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('personnel_skills')
    .select('*')
    .eq('personnel_id', personnelId)
    .maybeSingle()
  if (error) throw error
  return data as PersonnelSkill | null
}

export async function upsertSkills(
  personnelId: string,
  input: {
    primary_trade: string
    secondary_trades: string[]
    specialties: string[]
    notes: string
  },
  actorId?: string | null,
): Promise<PersonnelSkill> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const existing = await fetchSkills(personnelId)
  if (existing) {
    const { data, error } = await supabase
      .from('personnel_skills')
      .update(input)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    await logActivity({
      personnel_id: personnelId,
      actor_id: actorId ?? null,
      action: 'skills_updated',
      entity_type: 'skills',
      entity_id: existing.id,
    })
    return data as PersonnelSkill
  }

  const { data, error } = await supabase
    .from('personnel_skills')
    .insert({ personnel_id: personnelId, ...input })
    .select('*')
    .single()
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'skills_updated',
    entity_type: 'skills',
    entity_id: (data as PersonnelSkill).id,
  })
  return data as PersonnelSkill
}

export async function fetchCertifications(
  personnelId: string,
): Promise<PersonnelCertification[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('personnel_certifications')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('expiration_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as PersonnelCertification[]
}

export async function upsertCertification(
  cert: {
    id?: string
    personnel_id: string
    name: string
    issuer?: string
    certification_number?: string
    issue_date?: string | null
    expiration_date?: string | null
    verification_status?: VerificationStatus
    verification_date?: string | null
    notes?: string
  },
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const payload = {
    personnel_id: cert.personnel_id,
    name: cert.name.trim(),
    issuer: (cert.issuer ?? '').trim(),
    certification_number: (cert.certification_number ?? '').trim(),
    issue_date: cert.issue_date || null,
    expiration_date: cert.expiration_date || null,
    verification_status: cert.verification_status ?? ('pending_verification' as VerificationStatus),
    verification_date: cert.verification_date || null,
    notes: (cert.notes ?? '').trim(),
  }

  if (cert.id) {
    const { error } = await supabase.from('personnel_certifications').update(payload).eq('id', cert.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('personnel_certifications').insert(payload)
    if (error) throw error
  }

  await logActivity({
    personnel_id: cert.personnel_id,
    actor_id: actorId ?? null,
    action: cert.id ? 'certification_updated' : 'certification_added',
    entity_type: 'certification',
    entity_id: cert.id ?? null,
  })
}

export async function deleteCertification(
  id: string,
  personnelId: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('personnel_certifications').delete().eq('id', id)
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'certification_removed',
    entity_type: 'certification',
    entity_id: id,
  })
}

export async function fetchPersonnelProjectAssignments(
  personnelId: string,
): Promise<PersonnelProjectAssignment[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('personnel_project_assignments')
    .select(
      `
      *,
      projects ( id, name, job_number, address, city, state )
    `,
    )
    .eq('personnel_id', personnelId)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error

  type AssignRow = PersonnelProjectAssignment & {
    projects: PersonnelProjectAssignment['project'] | PersonnelProjectAssignment['project'][] | null
  }

  return ((data ?? []) as unknown as AssignRow[]).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
    return {
      id: row.id,
      personnel_id: row.personnel_id,
      project_id: row.project_id,
      assigned_role: row.assigned_role,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project: project ?? undefined,
    }
  })
}

/** Also surface linked-user project_assignments as directory assignments */
export async function fetchLinkedUserAssignments(
  linkedUserId: string,
): Promise<PersonnelProjectAssignment[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('project_assignments')
    .select(
      `
      project_id,
      assignment_role,
      created_at,
      projects ( id, name, job_number, address, city, state )
    `,
    )
    .eq('user_id', linkedUserId)
  if (error) throw error

  type LinkedRow = {
    project_id: string
    assignment_role: string
    created_at: string
    projects: PersonnelProjectAssignment['project'] | PersonnelProjectAssignment['project'][] | null
  }

  return ((data ?? []) as unknown as LinkedRow[]).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
    return {
      id: `linked-${row.project_id}`,
      personnel_id: '',
      project_id: row.project_id,
      assigned_role: row.assignment_role,
      start_date: null,
      end_date: null,
      status: 'active' as AssignmentStatus,
      created_at: row.created_at,
      updated_at: row.created_at,
      project: project ?? undefined,
    }
  })
}

export async function upsertPersonnelProjectAssignment(
  input: {
    id?: string
    personnel_id: string
    project_id: string
    assigned_role: string
    start_date: string | null
    end_date: string | null
    status: AssignmentStatus
  },
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const payload = {
    personnel_id: input.personnel_id,
    project_id: input.project_id,
    assigned_role: input.assigned_role.trim(),
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status,
  }

  if (input.id && !input.id.startsWith('linked-')) {
    const { error } = await supabase
      .from('personnel_project_assignments')
      .update(payload)
      .eq('id', input.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('personnel_project_assignments').upsert(payload, {
      onConflict: 'personnel_id,project_id',
    })
    if (error) throw error
  }

  await logActivity({
    personnel_id: input.personnel_id,
    actor_id: actorId ?? null,
    action: 'project_assignment_updated',
    entity_type: 'project_assignment',
    entity_id: input.project_id,
  })
}

export async function deletePersonnelProjectAssignment(
  id: string,
  personnelId: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  if (id.startsWith('linked-')) return
  const { error } = await supabase.from('personnel_project_assignments').delete().eq('id', id)
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'project_assignment_removed',
    entity_type: 'project_assignment',
    entity_id: id,
  })
}

export async function fetchLicenses(personnelId: string): Promise<License[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('expiration_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as License[]
}

export async function upsertLicense(
  license: {
    id?: string
    personnel_id: string | null
    company_id?: string | null
    license_type: string
    license_number?: string
    issuing_authority?: string
    license_classification?: string
    issue_date?: string | null
    expiration_date?: string | null
    verification_date?: string | null
    verification_status?: VerificationStatus
    notes?: string
  },
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const payload = {
    personnel_id: license.personnel_id,
    company_id: license.company_id ?? null,
    license_type: license.license_type.trim(),
    license_number: (license.license_number ?? '').trim(),
    issuing_authority: (license.issuing_authority ?? '').trim(),
    license_classification: (license.license_classification ?? '').trim(),
    issue_date: license.issue_date || null,
    expiration_date: license.expiration_date || null,
    verification_date: license.verification_date || null,
    verification_status: license.verification_status ?? ('pending_verification' as VerificationStatus),
    notes: (license.notes ?? '').trim(),
  }
  if (license.id) {
    const { error } = await supabase.from('licenses').update(payload).eq('id', license.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('licenses').insert(payload)
    if (error) throw error
  }
  await logActivity({
    personnel_id: license.personnel_id,
    actor_id: actorId ?? null,
    action: license.id ? 'license_updated' : 'license_added',
    entity_type: 'license',
    entity_id: license.id ?? null,
  })
}

export async function deleteLicense(
  id: string,
  personnelId: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('licenses').delete().eq('id', id)
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'license_removed',
    entity_type: 'license',
    entity_id: id,
  })
}

export async function fetchInsurance(personnelId: string): Promise<InsurancePolicy[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('coverage_expiration', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as InsurancePolicy[]
}

export async function upsertInsurance(
  policy: {
    id?: string
    personnel_id: string | null
    company_id?: string | null
    insurance_type: string
    provider?: string
    policy_reference?: string
    coverage_expiration?: string | null
    workers_comp_status?: string
    verification_status?: VerificationStatus
    verification_date?: string | null
    notes?: string
  },
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const payload = {
    personnel_id: policy.personnel_id,
    company_id: policy.company_id ?? null,
    insurance_type: policy.insurance_type.trim(),
    provider: (policy.provider ?? '').trim(),
    policy_reference: (policy.policy_reference ?? '').trim(),
    coverage_expiration: policy.coverage_expiration || null,
    workers_comp_status: (policy.workers_comp_status ?? '').trim(),
    verification_status: policy.verification_status ?? ('pending_verification' as VerificationStatus),
    verification_date: policy.verification_date || null,
    notes: (policy.notes ?? '').trim(),
  }
  if (policy.id) {
    const { error } = await supabase.from('insurance_policies').update(payload).eq('id', policy.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('insurance_policies').insert(payload)
    if (error) throw error
  }
  await logActivity({
    personnel_id: policy.personnel_id,
    actor_id: actorId ?? null,
    action: policy.id ? 'insurance_updated' : 'insurance_added',
    entity_type: 'insurance',
    entity_id: policy.id ?? null,
  })
}

export async function deleteInsurance(
  id: string,
  personnelId: string,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('insurance_policies').delete().eq('id', id)
  if (error) throw error
  await logActivity({
    personnel_id: personnelId,
    actor_id: actorId ?? null,
    action: 'insurance_removed',
    entity_type: 'insurance',
    entity_id: id,
  })
}

export async function fetchDocuments(personnelId: string): Promise<PersonnelDocument[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('personnel_documents')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('upload_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as PersonnelDocument[]
}

export async function uploadPersonnelDocument(input: {
  personnelId: string
  file: File
  documentName: string
  category: DocumentCategory
  issueDate?: string | null
  expirationDate?: string | null
  notes?: string
  uploadedBy: string
  actorId?: string | null
}): Promise<PersonnelDocument> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const safeName = input.file.name.replace(/[^\w.\-]+/g, '_')
  const storagePath = `${input.personnelId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('personnel-documents')
    .upload(storagePath, input.file, { upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('personnel_documents')
    .insert({
      personnel_id: input.personnelId,
      document_name: input.documentName.trim() || input.file.name,
      category: input.category,
      storage_path: storagePath,
      uploaded_by: input.uploadedBy,
      issue_date: input.issueDate || null,
      expiration_date: input.expirationDate || null,
      notes: (input.notes ?? '').trim(),
      verification_status: 'pending_verification' as VerificationStatus,
    })
    .select('*')
    .single()

  if (error) throw error

  await logActivity({
    personnel_id: input.personnelId,
    actor_id: input.actorId ?? null,
    action: 'document_uploaded',
    entity_type: 'document',
    entity_id: (data as PersonnelDocument).id,
    metadata: { category: input.category },
  })

  return data as PersonnelDocument
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from('personnel-documents')
    .createSignedUrl(storagePath, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function deletePersonnelDocument(
  doc: PersonnelDocument,
  actorId?: string | null,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  await supabase.storage.from('personnel-documents').remove([doc.storage_path])
  const { error } = await supabase.from('personnel_documents').delete().eq('id', doc.id)
  if (error) throw error

  await logActivity({
    personnel_id: doc.personnel_id,
    actor_id: actorId ?? null,
    action: 'document_deleted',
    entity_type: 'document',
    entity_id: doc.id,
    metadata: { category: doc.category },
  })
}

export function isExpiringSoon(dateStr: string | null | undefined, withinDays = 30): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  const limit = new Date()
  limit.setDate(now.getDate() + withinDays)
  return d >= now && d <= limit
}

export function isExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d < new Date()
}
