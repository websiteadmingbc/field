# Britton Field

Crew companion app for **Great Britton Construction**.

Live: https://field.greatbrittongc.com

## Develop

```bash
cp .env.example .env.local
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Without `.env.local`, the app runs in **demo mode** (localStorage POC data, no login).

With Supabase configured, users sign in at `/login` via **email one-time code**. Access is **invite-only**: the login form will not create accounts (`shouldCreateUser: false`). New users must be invited from **Operations** (Edge Function `invite-user`). Optionally update **Authentication → Email Templates → Magic Link** using `supabase/email-template-magic-link.html` so the email shows the code and a cross-device clickable link.

## Supabase setup (version 1)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run `supabase/migrations/20261103000000_initial.sql`.
3. **Authentication → URL configuration**
   - Site URL: `https://field.greatbrittongc.com`
   - Redirect URLs: `https://field.greatbrittongc.com/auth/callback`, `http://localhost:5173/auth/callback`
4. **Authentication → Providers → Email**: enable magic link / OTP. Turn **Allow new users to sign up** **OFF** so only invited Auth users can request a code.
5. Copy Project URL + `anon` key into `.env.local` (and GitHub Actions secrets for production).
6. **Authentication → Users**: invite people; then set `app_role` on `profiles` (`admin` | `project_manager` | `site_supervisor` | `crew`).
7. Enter **projects**, **site_contacts**, and **project_assignments** in the Table Editor (admin).

Roles and RLS match the proposal: crew see assigned jobs only; admin/PM see all; supervisors manage assigned jobs.

### Admin screens

Admins use **Admin** in the app (`/admin/projects`, `/admin/people`) to manage projects, assignments, site contacts, and invites.

**Job title** (`profiles.title`) is display-only. **App role** (`profiles.app_role`) controls permissions: `admin` | `project_manager` | `site_supervisor` | `crew`.

Invite emails need the Edge Function deployed once:

```bash
npx supabase login
npx supabase functions deploy invite-user --remote=znkucrtehtyoatxfnozw
npx supabase secrets set SITE_URL=https://field.greatbrittongc.com --remote=znkucrtehtyoatxfnozw
```

### Estimates & invoices (Operations)

**Operations → Billing** (and **All Jobs → [job] → Billing**) supports Joist-style estimates and invoices: line items, tax, status, convert estimate → invoice, manual payment log, and **Export PDF**. Email send is deferred.

Apply migration `supabase/migrations/20261119000000_estimates_invoices.sql` in the Supabase SQL editor (or your usual migrate flow) before using billing against live data.

### Ask Field (Operations)

**Operations → Ask Field** runs read-only LLM briefings (presets + free-text) using the same Field query surface as the MCP tools.

```bash
npx supabase functions deploy ask-field --remote=znkucrtehtyoatxfnozw --yes
npx supabase functions deploy ask-field-transcribe --remote=znkucrtehtyoatxfnozw --yes
npx supabase functions deploy ask-field-speak --remote=znkucrtehtyoatxfnozw --yes
npx supabase secrets set OPENAI_API_KEY=sk-... --remote=znkucrtehtyoatxfnozw --yes
# optional:
npx supabase secrets set OPENAI_MODEL=gpt-4o-mini --remote=znkucrtehtyoatxfnozw --yes
npx supabase secrets set OPENAI_TTS_VOICE=alloy --remote=znkucrtehtyoatxfnozw --yes
# optional persona name (default Scotty):
npx supabase secrets set ASK_FIELD_ASSISTANT_NAME=Scotty --remote=znkucrtehtyoatxfnozw --yes
```

Only Owner/Admin, General Manager, and Operations Manager can call it. The OpenAI key stays server-side.

**Voice:** Talk uses Whisper (`ask-field-transcribe`); answers can play via OpenAI TTS (`ask-field-speak`). Allow microphone permission in the browser. The assistant persona defaults to **Scotty**.

## LLM demo (MCP)

A read-only MCP server under `mcp/` lets Cursor (or other MCP clients) query live Field data.

```bash
cd mcp && npm install
```

Project config: `.cursor/mcp.json`. Reload MCP in Cursor Settings, then ask things like “What’s on hold in Field?” See `mcp/README.md`.

## Deploy

Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.

Add repository secrets (or Variables) for the Vite build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Wire them into the workflow `env` for the build step when you are ready for production auth.

- `public/CNAME` → `field.greatbrittongc.com`
- DNS: `field` CNAME → `websiteadmingbc.github.io`

## Stack

React · TypeScript · Vite · Tailwind · React Router · Lucide · Supabase
