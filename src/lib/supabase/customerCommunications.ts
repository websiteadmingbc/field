import type { CustomerCommunication } from '../../types'
import { getSupabase } from './client'
import type { Database } from './database.types'

export type CustomerCommunicationRow =
  Database['public']['Tables']['customer_communications']['Row']
export type CustomerCommunicationInsert =
  Database['public']['Tables']['customer_communications']['Insert']
export type CustomerCommunicationUpdate =
  Database['public']['Tables']['customer_communications']['Update']

export function rowToCustomerCommunication(row: CustomerCommunicationRow): CustomerCommunication {
  return {
    id: row.id,
    jobId: row.project_id,
    recipientName: row.recipient_name,
    senderName: row.sender_name,
    communicatedOn: row.communicated_on,
    communicatedAt: row.communicated_at,
    deviceType: row.device_type,
    messageType: row.message_type,
    priority: row.priority,
    visibility: row.visibility,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCustomerCommunications(projectId?: string): Promise<CustomerCommunication[]> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  let query = supabase
    .from('customer_communications')
    .select('*')
    .order('communicated_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(rowToCustomerCommunication)
}

export async function createCustomerCommunication(
  input: CustomerCommunicationInsert,
): Promise<CustomerCommunication> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('customer_communications')
    .insert(input)
    .select('*')
    .single()

  if (error) throw error
  return rowToCustomerCommunication(data)
}

export async function updateCustomerCommunication(
  id: string,
  input: CustomerCommunicationUpdate,
): Promise<CustomerCommunication> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('customer_communications')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return rowToCustomerCommunication(data)
}

export async function deleteCustomerCommunication(id: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { error } = await supabase.from('customer_communications').delete().eq('id', id)
  if (error) throw error
}
