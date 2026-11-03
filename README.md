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

With Supabase configured, users sign in at `/login` via **email one-time code** (invite-only; works across devices). Optionally update **Authentication → Email Templates → Magic Link** using `supabase/email-template-magic-link.html` so the email shows the code and a cross-device clickable link.

## Supabase setup (version 1)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run `supabase/migrations/20261103000000_initial.sql`.
3. **Authentication → URL configuration**
   - Site URL: `https://field.greatbrittongc.com`
   - Redirect URLs: `https://field.greatbrittongc.com/auth/callback`, `http://localhost:5173/auth/callback`
4. **Authentication → Providers → Email**: enable magic link / OTP (disable public sign-ups if offered).
5. Copy Project URL + `anon` key into `.env.local` (and GitHub Actions secrets for production).
6. **Authentication → Users**: invite people; then set `app_role` on `profiles` (`admin` | `project_manager` | `site_supervisor` | `crew`).
7. Enter **projects**, **site_contacts**, and **project_assignments** in the Table Editor (admin).

Roles and RLS match the proposal: crew see assigned jobs only; admin/PM see all; supervisors manage assigned jobs.

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
