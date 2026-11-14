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
npx supabase functions deploy invite-user --project-ref znkucrtehtyoatxfnozw
npx supabase secrets set SITE_URL=https://field.greatbrittongc.com --project-ref znkucrtehtyoatxfnozw
```

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
