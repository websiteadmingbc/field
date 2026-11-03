/**
 * Seed sample projects + assignments (service role — no app login needed).
 *   node scripts/seed-demo-projects.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key]) continue
    process.env[key] = raw.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvLocal()

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function api(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(`${method} ${path}: ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  }
  return data
}

const today = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (n) => {
  const d = new Date(today)
  d.setDate(d.getDate() + n)
  return iso(d)
}

const users = await api('/auth/v1/admin/users?per_page=200')
const byEmail = new Map((users.users ?? users ?? []).map((u) => [u.email?.toLowerCase(), u]))

const dylan = byEmail.get('dylansimpson@greatbrittongc.com')
const eli = byEmail.get('eli@greatbrittongc.com')
const paula = byEmail.get('paulalcantar@greatbrittongc.com')

if (!dylan || !eli || !paula) {
  console.error('Missing seeded users. Run scripts/invite-users.mjs first.')
  process.exit(1)
}

const projects = [
  {
    job_number: 'GBC-26001',
    name: 'Harbor View Kitchen',
    client: 'Nguyen Residence',
    description: 'Full kitchen remodel with island and new appliances.',
    job_type: 'Kitchen Renovation',
    status: 'in_progress',
    scheduled_date: addDays(0),
    start_time: '07:30',
    address: '412 Harbor View Dr',
    city: 'San Pedro',
    state: 'CA',
    zip: '90731',
    parking_instructions: 'Street parking on Harbor View; do not block driveway.',
    entrance_info: 'Side gate on the left — code 4412.',
    access_instructions: 'Dogs in backyard until 8am. Call before entry.',
    scope_of_work: 'Demo remaining cabinets, set island, rough plumbing check, install.',
    important_instructions: 'Protect hardwood in dining room with Ram Board.',
    required_materials: 'Island base, quartz top (delivering Wednesday), LED undercabinet kit.',
    safety_considerations: 'Live circuits in pantry wall — lockout before cutting.',
    site_notes: 'Homeowner on site mornings only.',
    lat: 33.7361,
    lng: -118.2923,
    checklist: [
      { id: 'c1', label: 'Protect floors', completed: true },
      { id: 'c2', label: 'Set island base', completed: false },
      { id: 'c3', label: 'Confirm appliance delivery', completed: false },
    ],
    materials: [
      { id: 'm1', name: 'Island base cabinets', quantity: '1 set', status: 'delivered' },
      { id: 'm2', name: 'Quartz countertop', quantity: '1', status: 'ordered' },
    ],
    documents: [],
  },
  {
    job_number: 'GBC-26002',
    name: 'Palos Verdes Bath Remodel',
    client: 'Torres Family',
    description: 'Primary bath gut remodel.',
    job_type: 'Residential Remodeling',
    status: 'scheduled',
    scheduled_date: addDays(1),
    start_time: '08:00',
    address: '28 Via del Monte',
    city: 'Palos Verdes Estates',
    state: 'CA',
    zip: '90274',
    parking_instructions: 'Park in the circular drive — leave space for HOA.',
    entrance_info: 'Front door — lockbox code 9027.',
    access_instructions: 'Quiet hours after 5pm.',
    scope_of_work: 'Demo tile, set shower pan, rough plumbing, waterproof.',
    important_instructions: 'HOA requires dust barriers at hallway.',
    required_materials: 'Schluter pan kit, Kerdi, thinset.',
    safety_considerations: 'Lead paint test already clear — keep report on site.',
    site_notes: 'Water shutoff in garage.',
    lat: 33.787,
    lng: -118.396,
    checklist: [
      { id: 'c1', label: 'Dust barrier up', completed: false },
      { id: 'c2', label: 'Demo complete', completed: false },
    ],
    materials: [
      { id: 'm1', name: 'Schluter pan kit', quantity: '1', status: 'needed' },
    ],
    documents: [],
  },
  {
    job_number: 'GBC-26003',
    name: 'Torrance TI Punch',
    client: 'South Bay Dental',
    description: 'Tenant improvement punch and paint.',
    job_type: 'Commercial Tenant Improvement',
    status: 'on_hold',
    scheduled_date: addDays(3),
    start_time: '07:00',
    address: '2345 Crenshaw Blvd',
    city: 'Torrance',
    state: 'CA',
    zip: '90501',
    parking_instructions: 'Suite rear lot — spaces 12–14 reserved.',
    entrance_info: 'Loading door B.',
    access_instructions: 'Waiting on final paint color approval from landlord.',
    scope_of_work: 'Punch list, paint touch-up, install remaining hardware.',
    important_instructions: 'Do not proceed until color confirmed.',
    required_materials: 'Touch-up paint (TBD).',
    safety_considerations: 'Occupied suite — coordinate with office manager.',
    site_notes: 'On hold pending landlord finish selection.',
    lat: 33.8307,
    lng: -118.339,
    checklist: [],
    materials: [],
    documents: [],
  },
]

// Skip if job_number already exists
const existing = await api('/rest/v1/projects?select=job_number')
const existingNumbers = new Set((existing ?? []).map((p) => p.job_number))

const created = []
for (const p of projects) {
  if (existingNumbers.has(p.job_number)) {
    console.log(`skip (exists): ${p.job_number} ${p.name}`)
    const rows = await api(`/rest/v1/projects?job_number=eq.${encodeURIComponent(p.job_number)}&select=*`)
    if (rows?.[0]) created.push(rows[0])
    continue
  }
  const rows = await api('/rest/v1/projects', { method: 'POST', body: p })
  const row = Array.isArray(rows) ? rows[0] : rows
  created.push(row)
  console.log(`created: ${row.job_number} ${row.name}`)
}

const assignments = []
for (const project of created) {
  const specs = [
    { user_id: dylan.id, assignment_role: 'admin' },
    { user_id: eli.id, assignment_role: 'project_manager' },
    { user_id: paula.id, assignment_role: 'project_manager' },
  ]
  // Harbor + bath get crew-style presence; TI still assigned so office can see
  for (const spec of specs) {
    assignments.push({
      project_id: project.id,
      user_id: spec.user_id,
      assignment_role: spec.assignment_role,
    })
  }
}

if (assignments.length) {
  await api('/rest/v1/project_assignments', {
    method: 'POST',
    body: assignments,
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
  console.log(`assignments: ${assignments.length}`)
}

// Sample notices on first active job
const harbor = created.find((p) => p.job_number === 'GBC-26001')
if (harbor) {
  await api('/rest/v1/project_notices', {
    method: 'POST',
    body: {
      project_id: harbor.id,
      body: 'Quartz top delivery moved to Wednesday 10am — clear the driveway.',
      author_id: paula.id,
    },
    prefer: 'return=minimal',
  })
  console.log('notice: added on Harbor View Kitchen')
}

console.log('\nDone. Open the app dashboard after you can sign in again.')
