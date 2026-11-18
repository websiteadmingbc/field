// Supabase Edge Function: Operations "Ask Field" — read-only LLM briefing over Field data.
// Deploy: npx supabase functions deploy ask-field --remote=znkucrtehtyoatxfnozw
// Secrets: OPENAI_API_KEY (required), OPENAI_MODEL (optional, default gpt-4o-mini)
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPS_ROLES = new Set(['admin', 'general_manager', 'operations_manager'])
const MAX_TOOL_ROUNDS = 6

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'field_summary',
      description:
        'Company-wide snapshot: project counts by status, active people, jobs scheduled today, recent notices.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description:
        'List jobs. Filter by status (scheduled, in_progress, completed, on_hold, archived) or search name/client/job number/city.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['scheduled', 'in_progress', 'completed', 'on_hold', 'archived'],
          },
          search: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project',
      description: 'Full detail for one job by job_number or project_id, including contacts and crew.',
      parameters: {
        type: 'object',
        properties: {
          job_number: { type: 'string' },
          project_id: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_people',
      description: 'Active company directory — names, titles, app roles.',
      parameters: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          active_only: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_daily_logs',
      description: 'Recent daily logs, optionally for one project.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          job_number: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notices',
      description: 'Recent site notices / updates posted on jobs.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_customer_communications',
      description: 'Customer communication logs for jobs (recipient, sender, type, priority, visibility).',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          job_number: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
] as const

const SYSTEM_PROMPT = `You are Ask Field for Great Britton Construction Operations.
You answer using ONLY the read-only Field tools provided. Never invent jobs, people, or communications.
If data is missing, say so clearly. Prefer short spoken-style briefings with bullets and suggested next actions.
Do not claim you can change data — you are read-only.
When useful, start with field_summary, then drill into list_projects / notices / customer communications / people.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

    if (!openaiKey) {
      return json(
        {
          error:
            'Ask Field is not configured. Set the OPENAI_API_KEY secret on the ask-field Edge Function.',
        },
        503,
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles')
      .select('app_role, active, full_name')
      .eq('id', caller.id)
      .maybeSingle()

    if (
      profileError ||
      !callerProfile?.active ||
      !OPS_ROLES.has(String(callerProfile.app_role))
    ) {
      return json(
        { error: 'Only Owner/Admin, General Manager, or Operations Manager can use Ask Field' },
        403,
      )
    }

    const body = await req.json().catch(() => ({}))
    const prompt = String(body.prompt || '').trim()
    const preset = body.preset ? String(body.preset) : null
    if (!prompt) return json({ error: 'Prompt is required' }, 400)
    if (prompt.length > 4000) return json({ error: 'Prompt is too long' }, 400)

    const toolsUsed: string[] = []
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: preset
          ? `Preset: ${preset}\n\nRequest:\n${prompt}`
          : prompt,
      },
    ]

    let answer = ''
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await openaiChat(openaiKey, model, messages)
      const choice = completion.choices?.[0]?.message
      if (!choice) throw new Error('No response from model')

      const toolCalls = (choice.tool_calls ?? []) as ToolCall[]
      if (toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: choice.content ?? null,
          tool_calls: toolCalls,
        })
        for (const call of toolCalls) {
          const name = call.function?.name || 'unknown'
          toolsUsed.push(name)
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.function?.arguments || '{}')
          } catch {
            args = {}
          }
          const result = await runTool(admin, name, args)
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name,
            content: JSON.stringify(result),
          })
        }
        continue
      }

      answer = String(choice.content || '').trim()
      break
    }

    if (!answer) {
      answer =
        'I gathered Field data but could not finish a briefing. Try a narrower question or a preset.'
    }

    return json({
      ok: true,
      answer,
      preset,
      tools_used: [...new Set(toolsUsed)],
      model,
      asked_by: callerProfile.full_name,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

async function openaiChat(apiKey: string, model: string, messages: ChatMessage[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOL_DEFS,
      tool_choice: 'auto',
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI error (${res.status}): ${text.slice(0, 400)}`)
  }
  return await res.json()
}

async function runTool(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'field_summary':
      return await toolFieldSummary(admin)
    case 'list_projects':
      return await toolListProjects(admin, args)
    case 'get_project':
      return await toolGetProject(admin, args)
    case 'list_people':
      return await toolListPeople(admin, args)
    case 'list_daily_logs':
      return await toolListDailyLogs(admin, args)
    case 'list_notices':
      return await toolListNotices(admin, args)
    case 'list_customer_communications':
      return await toolListCustomerCommunications(admin, args)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function toolFieldSummary(admin: SupabaseClient) {
  const [projectsRes, peopleRes, noticesRes] = await Promise.all([
    admin.from('projects').select('id,status,scheduled_date,name,job_number'),
    admin.from('profiles').select('id,active,app_role').eq('active', true),
    admin
      .from('project_notices')
      .select('id,body,created_at,project_id')
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  if (projectsRes.error) throw projectsRes.error
  if (peopleRes.error) throw peopleRes.error
  if (noticesRes.error) throw noticesRes.error

  const projects = projectsRes.data ?? []
  const byStatus: Record<string, number> = {}
  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
  }
  const today = new Date().toISOString().slice(0, 10)
  const todayJobs = projects.filter(
    (p) => p.scheduled_date === today && p.status !== 'completed' && p.status !== 'archived',
  )
  const people = peopleRes.data ?? []
  const peopleByRole = people.reduce<Record<string, number>>((acc, row) => {
    acc[row.app_role] = (acc[row.app_role] ?? 0) + 1
    return acc
  }, {})

  return {
    generated_at: new Date().toISOString(),
    project_count: projects.length,
    projects_by_status: byStatus,
    jobs_scheduled_today: todayJobs.map((j) => ({
      job_number: j.job_number,
      name: j.name,
      status: j.status,
    })),
    active_people: people.length,
    people_by_role: peopleByRole,
    recent_notices: noticesRes.data ?? [],
  }
}

async function toolListProjects(admin: SupabaseClient, args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 20, 1, 50)
  let q = admin
    .from('projects')
    .select('id,job_number,name,client,status,scheduled_date,city,address,job_type,updated_at')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (typeof args.status === 'string' && args.status) q = q.eq('status', args.status)
  if (typeof args.search === 'string' && args.search.trim()) {
    const s = args.search.trim()
    q = q.or(`name.ilike.%${s}%,client.ilike.%${s}%,job_number.ilike.%${s}%,city.ilike.%${s}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return { count: data?.length ?? 0, projects: data ?? [] }
}

async function toolGetProject(admin: SupabaseClient, args: Record<string, unknown>) {
  const jobNumber = typeof args.job_number === 'string' ? args.job_number : ''
  const projectId = typeof args.project_id === 'string' ? args.project_id : ''
  if (!jobNumber && !projectId) return { error: 'Provide job_number or project_id' }

  let q = admin.from('projects').select('*')
  q = jobNumber ? q.eq('job_number', jobNumber) : q.eq('id', projectId)
  const { data: project, error } = await q.maybeSingle()
  if (error) throw error
  if (!project) return { error: 'Project not found' }

  const id = project.id as string
  const [contacts, assignments] = await Promise.all([
    admin.from('site_contacts').select('*').eq('project_id', id),
    admin
      .from('project_assignments')
      .select('assignment_role,user_id,profiles(full_name,title,phone,email,app_role)')
      .eq('project_id', id),
  ])
  if (contacts.error) throw contacts.error
  if (assignments.error) throw assignments.error

  return {
    project,
    site_contacts: contacts.data ?? [],
    assignments: assignments.data ?? [],
  }
}

async function toolListPeople(admin: SupabaseClient, args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 50, 1, 100)
  const activeOnly = args.active_only !== false
  let q = admin
    .from('profiles')
    .select('id,full_name,title,email,phone,app_role,active')
    .order('full_name', { ascending: true })
    .limit(limit)
  if (activeOnly) q = q.eq('active', true)
  if (typeof args.role === 'string' && args.role) q = q.eq('app_role', args.role)
  const { data, error } = await q
  if (error) throw error
  return { count: data?.length ?? 0, people: data ?? [] }
}

async function resolveProjectId(
  admin: SupabaseClient,
  projectId: unknown,
  jobNumber: unknown,
): Promise<string | null> {
  if (typeof projectId === 'string' && projectId) return projectId
  if (typeof jobNumber === 'string' && jobNumber) {
    const { data, error } = await admin
      .from('projects')
      .select('id')
      .eq('job_number', jobNumber)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }
  return null
}

async function toolListDailyLogs(admin: SupabaseClient, args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 15, 1, 50)
  const resolvedId = await resolveProjectId(admin, args.project_id, args.job_number)
  if ((args.project_id || args.job_number) && !resolvedId) {
    return { error: `No project for job_number ${args.job_number}` }
  }
  let q = admin
    .from('daily_logs')
    .select(
      'id,project_id,log_date,status,work_completed,materials_used,issues,notes_for_next,created_at,author_id',
    )
    .order('log_date', { ascending: false })
    .limit(limit)
  if (resolvedId) q = q.eq('project_id', resolvedId)
  const { data, error } = await q
  if (error) throw error
  return { count: data?.length ?? 0, daily_logs: data ?? [] }
}

async function toolListNotices(admin: SupabaseClient, args: Record<string, unknown>) {
  const limit = clampInt(args.limit, 15, 1, 50)
  let q = admin
    .from('project_notices')
    .select('id,project_id,body,created_at,author_id')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (typeof args.project_id === 'string' && args.project_id) {
    q = q.eq('project_id', args.project_id)
  }
  const { data, error } = await q
  if (error) throw error
  return { count: data?.length ?? 0, notices: data ?? [] }
}

async function toolListCustomerCommunications(
  admin: SupabaseClient,
  args: Record<string, unknown>,
) {
  const limit = clampInt(args.limit, 15, 1, 50)
  const resolvedId = await resolveProjectId(admin, args.project_id, args.job_number)
  if ((args.project_id || args.job_number) && !resolvedId) {
    return { error: `No project for job_number ${args.job_number}` }
  }
  let q = admin
    .from('customer_communications')
    .select(
      'id,project_id,recipient_name,sender_name,communicated_on,communicated_at,device_type,message_type,priority,visibility,body,created_at,author_id',
    )
    .order('communicated_on', { ascending: false })
    .limit(limit)
  if (resolvedId) q = q.eq('project_id', resolvedId)
  const { data, error } = await q
  if (error) throw error
  return { count: data?.length ?? 0, customer_communications: data ?? [] }
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
