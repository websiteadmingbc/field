import type { Company, CompanyRelationshipStatus, CompanyType } from '../../types/personnel'
import { getSupabase } from './client'

export type CompanyInput = {
  name: string
  company_type: CompanyType
  business_phone: string
  business_email: string
  trade_specialty: string
  relationship_status: CompanyRelationshipStatus
}

export function emptyCompanyInput(): CompanyInput {
  return {
    name: '',
    company_type: 'subcontractor',
    business_phone: '',
    business_email: '',
    trade_specialty: '',
    relationship_status: 'active',
  }
}

export async function fetchCompanies(opts?: {
  search?: string
  includeArchived?: boolean
}): Promise<Company[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  let query = supabase.from('companies').select('*').order('name', { ascending: true })

  if (!opts?.includeArchived) {
    query = query.is('archived_at', null)
  }

  if (opts?.search?.trim()) {
    query = query.ilike('name', `%${opts.search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Company[]
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: input.name.trim(),
      company_type: input.company_type,
      business_phone: input.business_phone.trim(),
      business_email: input.business_email.trim(),
      trade_specialty: input.trade_specialty.trim(),
      relationship_status: input.relationship_status,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Company
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('companies')
    .update({
      name: input.name.trim(),
      company_type: input.company_type,
      business_phone: input.business_phone.trim(),
      business_email: input.business_email.trim(),
      trade_specialty: input.trade_specialty.trim(),
      relationship_status: input.relationship_status,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Company
}
