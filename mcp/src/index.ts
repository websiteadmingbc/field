/**
 * Britton Field MCP — read-only tools over live Supabase data for LLM demos.
 * Uses PostgREST over fetch (no Realtime) so Node 20 demos stay reliable.
 * Logging must go to stderr (stdio transport uses stdout for JSON-RPC).
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')

loadEnv({ path: resolve(root, '.env.local'), quiet: true })
loadEnv({ path: resolve(root, '.env'), quiet: true })
loadEnv({ path: resolve(__dirname, '../.env'), quiet: true })

type Creds = { url: string; key: string }

function getCreds(): Creds {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.FIELD_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.FIELD_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or keep them in the app .env.local).',
    )
  }
  return { url: url.replace(/\/$/, ''), key }
}

async function rest<T = unknown>(
  table: string,
  {
    select,
    filters = [],
    order,
    limit,
    single = false,
  }: {
    select: string
    filters?: string[]
    order?: string
    limit?: number
    single?: boolean
  },
): Promise<T> {
  const { url, key } = getCreds()
  const qs = new URLSearchParams()
  qs.set('select', select)
  for (const f of filters) {
    const eq = f.indexOf('=')
    if (eq === -1) continue
    qs.append(f.slice(0, eq), f.slice(eq + 1))
  }
  if (order) qs.set('order', order)
  if (limit != null) qs.set('limit', String(limit))

  const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: single ? 'application/vnd.pgrst.object+json' : 'application/json',
    },
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Supabase ${table}: ${res.status} ${body}`)
  }
  if (!body) return (single ? null : []) as T
  return JSON.parse(body) as T
}

function text(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  }
}

function createServer() {
  const server = new McpServer({
    name: 'britton-field',
    version: '0.1.0',
  })

  server.registerTool(
    'field_summary',
    {
      title: 'Field summary',
      description:
        'Company-wide snapshot for Great Britton Field: project counts by status, active people, and recent notices. Start here for demos.',
      inputSchema: z.object({}),
    },
    async () => {
      const [projects, people, notices] = await Promise.all([
        rest<
          Array<{
            id: string
            status: string
            scheduled_date: string | null
            name: string
            job_number: string
          }>
        >('projects', {
          select: 'id,status,scheduled_date,name,job_number',
        }),
        rest<Array<{ id: string; active: boolean; app_role: string }>>('profiles', {
          select: 'id,active,app_role',
          filters: ['active=eq.true'],
        }),
        rest<Array<{ id: string; body: string; created_at: string; project_id: string }>>(
          'project_notices',
          {
            select: 'id,body,created_at,project_id',
            order: 'created_at.desc',
            limit: 5,
          },
        ),
      ])

      const byStatus: Record<string, number> = {}
      for (const p of projects) {
        byStatus[p.status] = (byStatus[p.status] ?? 0) + 1
      }

      const today = new Date().toISOString().slice(0, 10)
      const todayJobs = projects.filter(
        (p) => p.scheduled_date === today && p.status !== 'completed' && p.status !== 'archived',
      )

      const peopleByRole = people.reduce<Record<string, number>>((acc, row) => {
        acc[row.app_role] = (acc[row.app_role] ?? 0) + 1
        return acc
      }, {})

      return text({
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
        recent_notices: notices,
      })
    },
  )

  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List Field jobs/projects. Filter by status (scheduled, in_progress, completed, on_hold, archived) or free-text search on name, client, job number, city.',
      inputSchema: z.object({
        status: z
          .enum(['scheduled', 'in_progress', 'completed', 'on_hold', 'archived'])
          .optional()
          .describe('Optional status filter'),
        search: z.string().optional().describe('Search name, client, job number, or city'),
        limit: z.number().int().min(1).max(50).optional().describe('Max rows (default 20)'),
      }),
    },
    async ({ status, search, limit }) => {
      const filters: string[] = []
      if (status) filters.push(`status=eq.${status}`)
      if (search?.trim()) {
        const s = `*${search.trim()}*`
        filters.push(`or=(name.ilike.${s},client.ilike.${s},job_number.ilike.${s},city.ilike.${s})`)
      }

      const projects = await rest('projects', {
        select: 'id,job_number,name,client,status,scheduled_date,city,address,job_type,updated_at',
        filters,
        order: 'scheduled_date.asc.nullslast',
        limit: limit ?? 20,
      })

      return text({
        count: Array.isArray(projects) ? projects.length : 0,
        projects,
      })
    },
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get project detail',
      description:
        'Full detail for one job: scope, site notes, contacts, and assigned crew. Pass job_number (preferred) or project id.',
      inputSchema: z.object({
        job_number: z.string().optional().describe('Job number, e.g. GBC-104'),
        project_id: z.string().uuid().optional().describe('Project UUID'),
      }),
    },
    async ({ job_number, project_id }) => {
      if (!job_number && !project_id) {
        return text({ error: 'Provide job_number or project_id' })
      }

      const filters = job_number
        ? [`job_number=eq.${job_number}`]
        : [`id=eq.${project_id}`]

      let project: Record<string, unknown> | null = null
      try {
        project = await rest('projects', {
          select: '*',
          filters,
          single: true,
        })
      } catch (e) {
        return text({ error: e instanceof Error ? e.message : 'Project not found' })
      }
      if (!project) return text({ error: 'Project not found' })

      const id = String(project.id)
      const [contacts, assignments] = await Promise.all([
        rest('site_contacts', {
          select: '*',
          filters: [`project_id=eq.${id}`],
        }),
        rest('project_assignments', {
          select: 'assignment_role,user_id,profiles(full_name,title,phone,email,app_role)',
          filters: [`project_id=eq.${id}`],
        }),
      ])

      return text({ project, site_contacts: contacts, assignments })
    },
  )

  server.registerTool(
    'list_people',
    {
      title: 'List people',
      description: 'Company directory from profiles — names, titles, app roles, active flag.',
      inputSchema: z.object({
        role: z.string().optional().describe('Filter by app_role, e.g. operations_manager'),
        active_only: z.boolean().optional().describe('Default true'),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async ({ role, active_only, limit }) => {
      const filters: string[] = []
      if (active_only !== false) filters.push('active=eq.true')
      if (role) filters.push(`app_role=eq.${role}`)

      const people = await rest('profiles', {
        select: 'id,full_name,title,email,phone,app_role,active',
        filters,
        order: 'full_name.asc',
        limit: limit ?? 50,
      })

      return text({
        count: Array.isArray(people) ? people.length : 0,
        people,
      })
    },
  )

  server.registerTool(
    'list_daily_logs',
    {
      title: 'List daily logs',
      description: 'Recent daily logs, optionally for one project.',
      inputSchema: z.object({
        project_id: z.string().uuid().optional(),
        job_number: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async ({ project_id, job_number, limit }) => {
      let resolvedId = project_id

      if (!resolvedId && job_number) {
        const project = await rest<{ id: string } | null>('projects', {
          select: 'id',
          filters: [`job_number=eq.${job_number}`],
          single: true,
        })
        if (!project) return text({ error: `No project for job_number ${job_number}` })
        resolvedId = project.id
      }

      const filters = resolvedId ? [`project_id=eq.${resolvedId}`] : []
      const daily_logs = await rest('daily_logs', {
        select:
          'id,project_id,log_date,status,work_completed,materials_used,issues,notes_for_next,created_at,author_id',
        filters,
        order: 'log_date.desc',
        limit: limit ?? 15,
      })

      return text({
        count: Array.isArray(daily_logs) ? daily_logs.length : 0,
        daily_logs,
      })
    },
  )

  server.registerTool(
    'list_notices',
    {
      title: 'List project notices',
      description: 'Recent site notices / updates posted on jobs.',
      inputSchema: z.object({
        project_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async ({ project_id, limit }) => {
      const filters = project_id ? [`project_id=eq.${project_id}`] : []
      const notices = await rest('project_notices', {
        select: 'id,project_id,body,created_at,author_id',
        filters,
        order: 'created_at.desc',
        limit: limit ?? 15,
      })

      return text({
        count: Array.isArray(notices) ? notices.length : 0,
        notices,
      })
    },
  )

  server.registerTool(
    'list_customer_communications',
    {
      title: 'List customer communications',
      description:
        'Recent customer communication logs for jobs (recipient, sender, type, priority, visibility). Optionally filter by project.',
      inputSchema: z.object({
        project_id: z.string().uuid().optional(),
        job_number: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async ({ project_id, job_number, limit }) => {
      let resolvedId = project_id

      if (!resolvedId && job_number) {
        const project = await rest<{ id: string } | null>('projects', {
          select: 'id',
          filters: [`job_number=eq.${job_number}`],
          single: true,
        })
        if (!project) return text({ error: `No project for job_number ${job_number}` })
        resolvedId = project.id
      }

      const filters = resolvedId ? [`project_id=eq.${resolvedId}`] : []
      const customer_communications = await rest('customer_communications', {
        select:
          'id,project_id,recipient_name,sender_name,communicated_on,communicated_at,device_type,message_type,priority,visibility,body,created_at,author_id',
        filters,
        order: 'communicated_on.desc',
        limit: limit ?? 15,
      })

      return text({
        count: Array.isArray(customer_communications) ? customer_communications.length : 0,
        customer_communications,
      })
    },
  )

  server.registerPrompt(
    'field_ops_briefing',
    {
      title: 'Field ops briefing',
      description: 'Prompt template that asks the model to brief leadership using Field MCP tools.',
      argsSchema: z.object({
        focus: z
          .string()
          .optional()
          .describe('Optional focus, e.g. on-hold jobs or today schedule'),
      }),
    },
    ({ focus }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'You are briefing Great Britton Construction leadership using the Britton Field MCP tools.',
              '1) Call field_summary.',
              '2) Call list_projects for on_hold and in_progress.',
              '3) Call list_notices for the latest site updates.',
              focus
                ? `4) Focus especially on: ${focus}.`
                : '4) Highlight risks and what needs a decision today.',
              'Return a short spoken-style briefing with bullets, then suggested next actions.',
            ].join('\n'),
          },
        },
      ],
    }),
  )

  return server
}

serveStdio(createServer, {
  onerror: (error) => console.error('Britton Field MCP error:', error),
})

console.error('Britton Field MCP running on stdio (read-only)')
