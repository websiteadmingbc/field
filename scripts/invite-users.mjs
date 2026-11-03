/**
 * Invite / create the initial Britton Field users via Supabase Admin API.
 *
 * Usage:
 *   node scripts/invite-users.mjs
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
  )
  process.exit(1)
}

const users = [
  {
    email: 'paulalcantar@greatbrittongc.com',
    full_name: 'Paul Alcantar',
    app_role: 'admin',
    title: 'General Manager',
    phone: '408-876-9483',
  },
  {
    email: 'eli@greatbrittongc.com',
    full_name: 'Eli Mohammadi',
    app_role: 'admin',
    title: 'Operations Manager',
    phone: '510-432-8461',
  },
  {
    email: 'dylansimpson@greatbrittongc.com',
    full_name: 'Dylan Simpson',
    app_role: 'admin',
    title: 'Director of Growth',
    phone: '408-455-3800',
  },
]

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function listUsers() {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers: authHeaders,
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.msg || body?.message || res.statusText)
  return body.users ?? []
}

async function createUser(email, full_name, app_role) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { full_name, app_role },
    }),
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.msg || body?.message || res.statusText
    const err = new Error(msg)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

async function upsertProfile(profile) {
  const res = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(profile),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || res.statusText)
  }
}

const existing = await listUsers()
const byEmail = new Map(existing.map((u) => [u.email?.toLowerCase(), u]))

for (const u of users) {
  let authUser = byEmail.get(u.email.toLowerCase())

  if (!authUser) {
    try {
      const created = await createUser(u.email, u.full_name, u.app_role)
      authUser = created
      console.log(`created: ${u.email}`)
    } catch (e) {
      if (/already|registered|exists/i.test(e.message)) {
        const refreshed = await listUsers()
        authUser = refreshed.find((x) => x.email?.toLowerCase() === u.email.toLowerCase())
        console.log(`exists: ${u.email}`)
      } else {
        console.error(`fail create: ${u.email}`, e.message)
        continue
      }
    }
  } else {
    console.log(`exists: ${u.email}`)
  }

  if (!authUser?.id) {
    console.error(`no id for ${u.email}`)
    continue
  }

  try {
    await upsertProfile({
      id: authUser.id,
      email: u.email,
      full_name: u.full_name,
      title: u.title,
      phone: u.phone ?? null,
      app_role: u.app_role,
      active: true,
    })
    console.log(`profile ok: ${u.email} → ${u.app_role}`)
  } catch (e) {
    console.error(`profile fail: ${u.email}`, e.message)
  }
}

console.log('\nDone. Sign in at /login with magic link (no password).')
