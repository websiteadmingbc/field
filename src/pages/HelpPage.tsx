import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  Briefcase,
  Camera,
  CircleHelp,
  ClipboardList,
  Home,
  KeyRound,
  LayoutDashboard,
  Settings2,
  Shield,
  UserPlus,
  Users,
  Building2,
  FileText,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { canAccessAdminConsole } from '../types/auth'

type HelpSection = {
  id: string
  title: string
  summary: string
  icon: typeof CircleHelp
  adminOnly?: boolean
  steps?: string[]
  tips?: string[]
  related?: Array<{ label: string; to: string }>
  body?: string[]
}

const SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'What Britton Field is and how to find your way around.',
    icon: CircleHelp,
    body: [
      'Britton Field is the crew companion for Great Britton Construction. Field roles use Today, Jobs, Daily Log, and Photos. Office roles also get Dashboard and (when permitted) Operations.',
      'Use the left sidebar on desktop, or the bottom bar / menu on mobile. Your name and role appear at the bottom of the sidebar.',
    ],
    tips: [
      'Office users see Dashboard as home; crew see Today.',
      'Operations appears only for Owner/Admin, General Manager, and Operations Manager.',
    ],
  },
  {
    id: 'sign-in',
    title: 'Sign in',
    summary: 'Invite-only email one-time code (no password).',
    icon: KeyRound,
    steps: [
      'Open the app and go to Sign in.',
      'Enter the work email you were invited with.',
      'Request a one-time code from email.',
      'Enter the code on the same device (or use the link in the email if you open it elsewhere).',
    ],
    tips: [
      'You must be invited first — public sign-up is not available.',
      'Codes expire; request a new one if it stops working.',
      'Use Sign out from the sidebar when you are done on a shared device.',
    ],
    related: [{ label: 'Sign in', to: '/login' }],
  },
  {
    id: 'today-dashboard',
    title: 'Today & Dashboard',
    summary: 'Day view for crew; company overview for office.',
    icon: Home,
    body: [
      'Today shows jobs scheduled for today, site notices, and recent activity for your assignments.',
      'Dashboard (office) summarizes job status across the company and recent notices — day-to-day work, separate from Operations admin.',
    ],
    related: [
      { label: 'Today', to: '/' },
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
  {
    id: 'jobs',
    title: 'My Jobs',
    summary: 'Open a job for status, checklist, notes, materials, map, and photos.',
    icon: Briefcase,
    steps: [
      'Open My Jobs from the sidebar (your assigned work).',
      'Tap a job to open details.',
      'Update status when allowed (office roles).',
      'Check off checklist items, add notes, and track materials as work progresses.',
      'Use Directions / location details when you need to get to the site — location sharing is optional.',
      'Capture or review photos tagged to that job.',
    ],
    tips: [
      'Crew typically see only jobs they are assigned to.',
      'Company-wide job setup lives under Operations → All Jobs.',
      'Site contacts (customer / GC / inspector) live on the job and in Customers — not in Team.',
    ],
    related: [{ label: 'My Jobs', to: '/jobs' }],
  },
  {
    id: 'daily-log',
    title: 'Daily Log',
    summary: 'Document work completed, materials, issues, and hand-off notes.',
    icon: ClipboardList,
    steps: [
      'Open Daily Log from the sidebar.',
      'Select the job and date.',
      'Fill Work completed, Materials used, Issues, and Notes for next.',
      'Use suggestion chips for common phrases when helpful.',
      'Save the log. Edit an existing entry by selecting it from the list.',
    ],
    tips: [
      'Logs document the job for hand-off — not personal performance scoring.',
      'You can deep-link from a job with a job query so the form opens pre-selected.',
    ],
    related: [{ label: 'Daily Log', to: '/log' }],
  },
  {
    id: 'photos',
    title: 'Photos',
    summary: 'Capture and organize job photos by job and category.',
    icon: Camera,
    steps: [
      'Open Photos, or capture from a job detail page.',
      'Choose the job and a category (Before, Estimation, Progress, After, Issue).',
      'Take or upload the photo and save.',
      'Filter the library by job or category to find shots later.',
    ],
    tips: [
      'Every photo is tagged to a job so it appears both in the library and on that job.',
      'Use Issue for problems that need follow-up visibility.',
    ],
    related: [{ label: 'Photos', to: '/photos' }],
  },
  {
    id: 'team-customers',
    title: 'Team & Customers',
    summary: 'Internal crew directory vs external site contacts.',
    icon: Users,
    body: [
      'Team lists Great Britton crew and related internal people you can reach for a job.',
      'Customers lists homeowners, clients, GCs, and other site contacts tied to jobs — not internal staff.',
    ],
    tips: [
      'To add or change a customer contact, edit Site contacts on the job in Operations → All Jobs (when you have access).',
      'Adding staff / crew members is done under Operations → Personnel — see “Add crew or staff” below.',
    ],
    related: [
      { label: 'Team', to: '/team' },
      { label: 'Customers', to: '/customers' },
    ],
  },
  {
    id: 'updates',
    title: 'Updates',
    summary: 'Notifications and activity relevant to your work.',
    icon: Bell,
    body: [
      'Updates collects notices and activity so you can catch up without hunting through each job.',
      'Unread counts show on the Updates nav item and the mobile header bell.',
    ],
    related: [{ label: 'Updates', to: '/notifications' }],
  },
  {
    id: 'add-personnel',
    title: 'Add crew or staff',
    summary: 'Create a personnel record in Operations (directory first, then app access).',
    icon: UserPlus,
    adminOnly: true,
    steps: [
      'Open Operations → Personnel.',
      'Tap Add Personnel (managers with user-management permission).',
      'Enter Personal & contact details (first/last name required; work email recommended for invites).',
      'Set Classification (e.g. Employee, Independent contractor, Subcontractor) — this is the personnel type, not the app permission role.',
      'Set Status (Active, Pending onboarding, etc.) and affiliate them with a company (create a company inline if needed).',
      'Under Website directory, choose Leadership, Field Crew, or Office if they should appear on greatbrittongc.com, and add a headshot.',
      'Add restricted fields only if you are a manager: personal email, emergency contact, internal notes.',
      'Save. You land on the person’s detail page — they are not on the public site yet.',
      'Confirm Publish to website on their profile when ready. Optional: Skills, Jobs, Compliance, then App access to invite them into the Field app.',
    ],
    tips: [
      'Personnel type (classification) is independent of App role and of Website category.',
      'Website category drives the Leadership / Field Crew / Office filter on the company site.',
      'Saving a person never publishes them — Publish requires an explicit confirm, plus category and photo.',
      'A directory record alone does not grant login — invite them under App access.',
      'Use Pending onboarding for people who are not ready to work jobs yet.',
    ],
    related: [
      { label: 'Personnel', to: '/admin/people' },
      { label: 'Add Personnel', to: '/admin/people/new' },
    ],
  },
  {
    id: 'invite-access',
    title: 'Invite someone to the app',
    summary: 'Link a personnel record to a login and set their app role.',
    icon: KeyRound,
    adminOnly: true,
    steps: [
      'Open the person in Operations → Personnel.',
      'Go to the App access tab.',
      'Confirm they have a work email on the record.',
      'Choose the App role (permissions for what they can see and do).',
      'Send invite & link. They receive an email and can sign in with a one-time code.',
      'After they sign in, assign them to jobs so crew-scoped roles see the right work.',
    ],
    tips: [
      'Only Owner/Admin and General Manager can invite and change roles.',
      'Job title on the profile is display-only; App role controls permissions.',
      'If invite fails, the invite-user Edge Function may need to be deployed (see project README).',
    ],
    related: [{ label: 'Personnel', to: '/admin/people' }],
  },
  {
    id: 'roles',
    title: 'Roles & permissions',
    summary: 'What each app role can create, view, edit, delete, or approve.',
    icon: Shield,
    adminOnly: true,
    body: [
      'Open Operations → Roles & permissions to inspect the matrix for any role.',
      'Codes: C create · V view · E edit · D delete · A approve. Scope limits data to company-wide, assigned jobs, or self.',
      'Assign the role when inviting or editing App access on a personnel record — not by changing classification alone.',
    ],
    related: [{ label: 'Roles & permissions', to: '/admin/roles' }],
  },
  {
    id: 'projects',
    title: 'Create & edit jobs',
    summary: 'Set up a job the field team can open and update (Operations → All Jobs).',
    icon: Briefcase,
    adminOnly: true,
    steps: [
      'Open Operations → All Jobs.',
      'Create a job and fill details (name, schedule, address, status, etc.).',
      'Save. Details are visible to assigned crew in the field app.',
      'Continue with Crew assignments, Site contacts, and Photos tabs on that job.',
    ],
    tips: [
      'After creating a job, assign crew next — otherwise field users may not see it.',
      'Photos on a job also feed the shared Photos library.',
      'My Jobs in the sidebar is your assigned list; All Jobs is company-wide management.',
      'Use Archive on a job to hide it from field lists without deleting. Toggle Show archived on All Jobs to find it again, or Unarchive from the job form.',
      'Delete permanently removes the job and related logs/photos/notices — prefer Archive when unsure.',
    ],
    related: [
      { label: 'All Jobs', to: '/admin/projects' },
      { label: 'New Job', to: '/admin/projects/new' },
    ],
  },
  {
    id: 'document-library',
    title: 'Job Document Library',
    summary: 'Full job Document Library — import through share, pin, and export (Phases 1–4).',
    icon: FileText,
    adminOnly: true,
    steps: [
      'Open Operations → All Jobs → a job → Documents tab (or open the job from My Jobs).',
      'Import, revise, archive, search, and export (CSV / ZIP / Closeout).',
      'Share individual docs with named subcontractors (Shared visibility).',
      'Link docs to daily logs or RFI/CO references. Field users can Pin for offline.',
      'Assigned subcontractors upload Submittals only — they do not see Internal docs.',
    ],
    tips: [
      'There is no global Documents sidebar — documents always live on a job.',
      'Pinned files stay on the device for weak-signal sites (plans & permits).',
      'Submittal uploads require the person to be assigned to the job with app role Subcontractor.',
      'Shared docs are visible only to people you explicitly share with (plus managers).',
    ],
    related: [{ label: 'All Jobs', to: '/admin/projects' }],
  },
  {
    id: 'crew-assignments',
    title: 'Assign crew to a job',
    summary: 'Control who can see and work a job.',
    icon: Users,
    adminOnly: true,
    steps: [
      'Open the job in Operations → All Jobs.',
      'Open the Crew assignments tab.',
      'Check the people who should have access.',
      'Set each person’s assignment role on that job if needed.',
      'Save assignments.',
    ],
    tips: [
      'People must exist as app users (invited / linked) to appear for assignment in most live setups.',
      'You can also manage job links from a personnel record’s Jobs tab.',
    ],
    related: [{ label: 'All Jobs', to: '/admin/projects' }],
  },
  {
    id: 'site-contacts',
    title: 'Site contacts (customers)',
    summary: 'Homeowners, GCs, inspectors — per job, shown under Customers.',
    icon: Building2,
    adminOnly: true,
    steps: [
      'Open the job → Site contacts tab.',
      'Add contact name, role, phone, email, and notes as needed.',
      'Save. Contacts appear on the job for the crew and in the Customers directory.',
    ],
    tips: [
      'Site contacts are not Great Britton staff — use Personnel for crew/staff.',
      'Editing a customer from Customers updates that job’s site contact.',
    ],
    related: [
      { label: 'All Jobs', to: '/admin/projects' },
      { label: 'Customers', to: '/customers' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations overview',
    summary: 'Company admin: personnel, roles, and jobs.',
    icon: Settings2,
    adminOnly: true,
    body: [
      'Operations is separate from your personal Dashboard. Use it to run the company directory, permission baseline, and job setup.',
      'Tabs: Personnel · Roles & permissions · All Jobs.',
    ],
    related: [{ label: 'Operations', to: '/admin/people' }],
  },
  {
    id: 'privacy',
    title: 'Privacy & trust',
    summary: 'No employee tracking; location stays optional.',
    icon: Shield,
    body: [
      'Britton Field is built for contractors — not to monitor them. There is no continuous GPS tracking, geofencing, or hidden usage monitoring.',
      'Daily logs document the job. Job addresses are site info; directions open in your maps app when you choose.',
    ],
    related: [{ label: 'Privacy', to: '/privacy' }],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    summary: 'Light / dark theme on this device.',
    icon: LayoutDashboard,
    body: [
      'Use the theme control in the sidebar (or mobile header) to switch light and dark. The choice is saved on this device.',
    ],
  },
]

export function HelpPage() {
  const { profile } = useAuth()
  const showAdmin = canAccessAdminConsole(profile?.app_role)
  const location = useLocation()
  const [activeId, setActiveId] = useState('getting-started')

  const sections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || showAdmin),
    [showAdmin],
  )

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (hash && sections.some((s) => s.id === hash)) {
      setActiveId(hash)
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [location.hash, sections])

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => !!n)

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    )

    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [sections])

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Support</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-[0.04em] text-ink sm:text-4xl">
          Help <span className="text-teal">& how-to</span>
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Step-by-step guidance for field work and Operations — including how to add crew or staff
          and invite them into the app.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Help topics"
          className="animate-fade-up stagger-1 lg:sticky lg:top-6"
        >
          <Card className="overflow-hidden p-0">
            <p className="border-b border-border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Topics
            </p>
            <ul className="max-h-[70dvh] space-y-0.5 overflow-y-auto p-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={() => setActiveId(section.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-semibold transition',
                      activeId === section.id
                        ? 'bg-teal-soft text-teal'
                        : 'text-ink-muted hover:bg-surface hover:text-ink',
                    )}
                  >
                    <section.icon className="h-4 w-4 shrink-0" />
                    <span className="leading-snug">{section.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </nav>

        <div className="space-y-5 animate-fade-up stagger-2">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              <Card className="space-y-4 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold-line/40 bg-teal-soft text-teal">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold uppercase tracking-[0.03em] text-ink">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">{section.summary}</p>
                  </div>
                </div>

                {section.body?.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-sm leading-relaxed text-ink-muted">
                    {paragraph}
                  </p>
                ))}

                {section.steps && section.steps.length > 0 && (
                  <ol className="space-y-2.5">
                    {section.steps.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-charcoal text-[11px] font-bold text-white dark:bg-teal-fill dark:text-on-teal">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {section.tips && section.tips.length > 0 && (
                  <div className="rounded-md border border-gold-line/30 bg-surface px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                      Tips
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                      {section.tips.map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {section.related && section.related.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {section.related.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="inline-flex items-center rounded-md border border-gold-line/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted transition hover:border-gold-line hover:text-ink"
                      >
                        Open {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
