import { getSupabase } from './client'

export type DocumentShare = {
  id: string
  document_id: string
  personnel_id: string
  expires_at: string | null
  granted_by: string | null
  created_at: string
  personnel?: {
    id: string
    first_name: string
    last_name: string
    preferred_name: string | null
    email: string | null
  } | null
}

export type DocumentLink = {
  id: string
  document_id: string
  entity_type: string
  entity_id: string
  label: string
  created_at: string
}

export type ShareablePersonnel = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  email: string | null
  linked_user_id: string | null
  classification: string | null
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchDocumentShares(documentId: string): Promise<DocumentShare[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('document_shares')
    .select(
      `
      *,
      personnel:personnel_id ( id, first_name, last_name, preferred_name, email )
    `,
    )
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<DocumentShare & { personnel?: DocumentShare['personnel'] | DocumentShare['personnel'][] }>).map(
    (row) => ({
      ...row,
      personnel: unwrapOne(row.personnel),
    }),
  )
}

export async function fetchShareablePersonnel(): Promise<ShareablePersonnel[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('personnel')
    .select('id, first_name, last_name, preferred_name, email, linked_user_id, classification')
    .neq('status', 'archived')
    .order('last_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ShareablePersonnel[]
}

export async function grantDocumentShare(input: {
  documentId: string
  personnelId: string
  expiresAt?: string | null
}): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('document_shares').upsert(
    {
      document_id: input.documentId,
      personnel_id: input.personnelId,
      expires_at: input.expiresAt ?? null,
      granted_by: user?.id ?? null,
    },
    { onConflict: 'document_id,personnel_id' },
  )
  if (error) throw error

  // Ensure visibility is shared so named access applies
  await supabase
    .from('documents')
    .update({ visibility: 'shared' })
    .eq('id', input.documentId)
    .neq('visibility', 'shared')
}

export async function revokeDocumentShare(shareId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('document_shares').delete().eq('id', shareId)
  if (error) throw error
}

export async function fetchDocumentLinks(documentId: string): Promise<DocumentLink[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('document_links')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DocumentLink[]
}

export async function addDocumentLink(input: {
  documentId: string
  entityType: 'daily_log' | 'change_order' | 'rfi' | 'job'
  entityId: string
  label?: string
}): Promise<DocumentLink> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('document_links')
    .insert({
      document_id: input.documentId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      label: input.label?.trim() ?? '',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as DocumentLink
}

export async function removeDocumentLink(linkId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('document_links').delete().eq('id', linkId)
  if (error) throw error
}

