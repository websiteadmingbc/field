/**
 * Dev-only: generate a login link/OTP without sending email (bypasses rate limit).
 *   node scripts/dev-login-link.mjs [email]
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
    if (!process.env[key]) process.env[key] = raw.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvLocal()

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.argv[2] || 'dylansimpson@greatbrittongc.com').toLowerCase()
const redirect = process.argv[3] || 'http://localhost:5173/auth/callback'

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'magiclink',
    email,
    options: { redirect_to: redirect },
  }),
})
const body = await res.json()
if (!res.ok) {
  console.error('FAILED', res.status, JSON.stringify(body, null, 2))
  process.exit(1)
}

const props = body.properties || body
const hashed = props.hashed_token || body.hashed_token
const otp = props.email_otp || body.email_otp

console.log(`email: ${email}`)
if (otp) console.log(`otp_code: ${otp}`)
if (hashed) {
  console.log(
    `open_this: http://localhost:5173/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=email`,
  )
}
