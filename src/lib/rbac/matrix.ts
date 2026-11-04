/**
 * Construction Roles & Permissions matrix (from Construction-Roles-and-Permissions.pdf).
 * Editable in Admin → Roles. Codes: C create, V view, E edit, D delete, A approve.
 * Scope: company | project | assigned | self | none
 */

export type PermissionCode = 'C' | 'V' | 'E' | 'D' | 'A'
export type DataScope = 'company' | 'project' | 'assigned' | 'self' | 'none'

export type AppRole =
  | 'admin'
  | 'general_manager'
  | 'operations_manager'
  | 'estimator'
  | 'office_manager'
  | 'bookkeeper'
  | 'project_manager'
  | 'project_coordinator'
  | 'project_engineer'
  | 'site_supervisor'
  | 'safety_officer'
  | 'crew_lead'
  | 'crew'
  | 'tradesperson'
  | 'equipment_operator'
  | 'laborer'
  | 'apprentice'
  | 'subcontractor'
  | 'client'

export type ModuleKey =
  | 'company_settings'
  | 'users_roles'
  | 'projects'
  | 'clients'
  | 'estimates_bids'
  | 'contracts'
  | 'change_orders'
  | 'schedules'
  | 'daily_logs'
  | 'photos_docs'
  | 'rfis'
  | 'submittals'
  | 'punch_lists'
  | 'safety'
  | 'time_attendance'
  | 'equipment'
  | 'materials'
  | 'purchase_orders'
  | 'invoices_payments'
  | 'reports'
  | 'job_costing'

export type ModulePermission = {
  codes: PermissionCode[]
  scope: DataScope
  note?: string
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Owner / Admin',
  general_manager: 'General Manager',
  operations_manager: 'Operations Manager',
  estimator: 'Estimator',
  office_manager: 'Office Manager',
  bookkeeper: 'Bookkeeper / Accounting',
  project_manager: 'Project Manager',
  project_coordinator: 'Project Coordinator / Admin',
  project_engineer: 'Project Engineer / Assistant PM',
  site_supervisor: 'Superintendent / Site Supervisor',
  safety_officer: 'Safety Officer',
  crew_lead: 'Foreman / Crew Lead',
  crew: 'Crew (legacy)',
  tradesperson: 'Tradesperson / Craft Worker',
  equipment_operator: 'Equipment Operator',
  laborer: 'Laborer',
  apprentice: 'Apprentice / Helper',
  subcontractor: 'Subcontractor Contact',
  client: 'Client / Owner Rep',
}

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Full system control. Company settings, users, billing, and all modules.',
  general_manager: 'Runs the business day-to-day. Full ops except owner-only settings.',
  operations_manager: 'Field + office coordination. Broad view; limited user admin.',
  estimator: 'Estimates, bids, and related project setup.',
  office_manager: 'Office workflows, clients, docs, and coordination.',
  bookkeeper: 'Invoices, payments, job costing, and financial reports.',
  project_manager: 'Owns assigned projects end-to-end.',
  project_coordinator: 'Supports PMs with schedules, RFIs, docs.',
  project_engineer: 'Technical project support on assigned jobs.',
  site_supervisor: 'Runs the jobsite day-to-day.',
  safety_officer: 'Safety program, incidents, and compliance.',
  crew_lead: 'Leads a crew on assigned projects.',
  crew: 'Legacy field role — prefer tradesperson / laborer / crew_lead.',
  tradesperson: 'Craft work on assigned projects.',
  equipment_operator: 'Equipment use and related logs on assigned jobs.',
  laborer: 'General labor on assigned projects.',
  apprentice: 'Training role with limited self-scoped access.',
  subcontractor: 'External partner — assigned project portal access.',
  client: 'Client portal — view-only on their projects.',
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  company_settings: 'Company Settings',
  users_roles: 'Users & Roles',
  projects: 'Projects',
  clients: 'Clients',
  estimates_bids: 'Estimates / Bids',
  contracts: 'Contracts',
  change_orders: 'Change Orders',
  schedules: 'Schedules',
  daily_logs: 'Daily Logs',
  photos_docs: 'Photos / Documents',
  rfis: 'RFIs',
  submittals: 'Submittals',
  punch_lists: 'Punch Lists',
  safety: 'Safety',
  time_attendance: 'Time & Attendance',
  equipment: 'Equipment',
  materials: 'Materials / Inventory',
  purchase_orders: 'Purchase Orders',
  invoices_payments: 'Invoices & Payments',
  reports: 'Reports',
  job_costing: 'Job Costing',
}

const ALL: PermissionCode[] = ['C', 'V', 'E', 'D', 'A']
const CVE: PermissionCode[] = ['C', 'V', 'E']
const CVED: PermissionCode[] = ['C', 'V', 'E', 'D']
const CV: PermissionCode[] = ['C', 'V']
const VE: PermissionCode[] = ['V', 'E']
const V: PermissionCode[] = ['V']
const VA: PermissionCode[] = ['V', 'A']
const none = (note?: string): ModulePermission => ({ codes: [], scope: 'none', note })
const p = (codes: PermissionCode[], scope: DataScope, note?: string): ModulePermission => ({
  codes,
  scope,
  note,
})

/** Baseline matrix — adjust in Admin → Roles UI notes; persisted overrides can come later. */
export const PERMISSION_MATRIX: Record<AppRole, Partial<Record<ModuleKey, ModulePermission>>> = {
  admin: Object.fromEntries(
    (Object.keys(MODULE_LABELS) as ModuleKey[]).map((m) => [m, p(ALL, 'company')]),
  ) as Record<ModuleKey, ModulePermission>,

  general_manager: {
    company_settings: p(V, 'company', 'Owner retains full CVED'),
    users_roles: p(CVED, 'company'),
    projects: p(CVED, 'company'),
    clients: p(CVED, 'company'),
    estimates_bids: p(ALL, 'company'),
    contracts: p(ALL, 'company'),
    change_orders: p(ALL, 'company'),
    schedules: p(CVED, 'company'),
    daily_logs: p(CVED, 'company'),
    photos_docs: p(CVED, 'company'),
    rfis: p(CVED, 'company'),
    submittals: p(CVED, 'company'),
    punch_lists: p(CVED, 'company'),
    safety: p(CVED, 'company'),
    time_attendance: p(CVED, 'company'),
    equipment: p(CVED, 'company'),
    materials: p(CVED, 'company'),
    purchase_orders: p(ALL, 'company'),
    invoices_payments: p(ALL, 'company'),
    reports: p(V, 'company'),
    job_costing: p(VE, 'company'),
  },

  operations_manager: {
    company_settings: none(),
    users_roles: p(V, 'company', 'View directory; cannot change roles'),
    projects: p(CVE, 'company'),
    clients: p(CVE, 'company'),
    estimates_bids: p(VA, 'company'),
    contracts: p(V, 'company'),
    change_orders: p(VA, 'company'),
    schedules: p(CVE, 'company'),
    daily_logs: p(CVE, 'company'),
    photos_docs: p(CVE, 'company'),
    rfis: p(CVE, 'company'),
    submittals: p(CVE, 'company'),
    punch_lists: p(CVE, 'company'),
    safety: p(CVE, 'company'),
    time_attendance: p(CVE, 'company'),
    equipment: p(CVE, 'company'),
    materials: p(CVE, 'company'),
    purchase_orders: p(VA, 'company'),
    invoices_payments: p(V, 'company'),
    reports: p(V, 'company'),
    job_costing: p(V, 'company'),
  },

  estimator: {
    projects: p(CV, 'company'),
    clients: p(CV, 'company'),
    estimates_bids: p(CVED, 'company'),
    contracts: p(V, 'company'),
    change_orders: p(V, 'project'),
    schedules: p(V, 'project'),
    photos_docs: p(CV, 'project'),
    reports: p(V, 'project'),
    job_costing: p(V, 'project'),
  },

  office_manager: {
    users_roles: p(V, 'company'),
    projects: p(V, 'company'),
    clients: p(CVE, 'company'),
    contracts: p(V, 'company'),
    schedules: p(VE, 'company'),
    daily_logs: p(V, 'company'),
    photos_docs: p(CVE, 'company'),
    rfis: p(CVE, 'company'),
    submittals: p(CVE, 'company'),
    time_attendance: p(VE, 'company'),
    purchase_orders: p(CV, 'company'),
    invoices_payments: p(CV, 'company'),
    reports: p(V, 'company'),
  },

  bookkeeper: {
    projects: p(V, 'company'),
    clients: p(V, 'company'),
    contracts: p(V, 'company'),
    change_orders: p(V, 'company'),
    time_attendance: p(V, 'company'),
    purchase_orders: p(VE, 'company'),
    invoices_payments: p(CVED, 'company'),
    reports: p(V, 'company'),
    job_costing: p(CVE, 'company'),
  },

  project_manager: {
    projects: p(CVE, 'assigned'),
    clients: p(VE, 'assigned'),
    estimates_bids: p(V, 'assigned'),
    contracts: p(V, 'assigned'),
    change_orders: p([...CVE, 'A'], 'assigned'),
    schedules: p(CVE, 'assigned'),
    daily_logs: p(CVE, 'assigned'),
    photos_docs: p(CVE, 'assigned'),
    rfis: p(CVE, 'assigned'),
    submittals: p(CVE, 'assigned'),
    punch_lists: p(CVE, 'assigned'),
    safety: p(CVE, 'assigned'),
    time_attendance: p(VE, 'assigned'),
    equipment: p(VE, 'assigned'),
    materials: p(VE, 'assigned'),
    purchase_orders: p(CVE, 'assigned'),
    invoices_payments: p(V, 'assigned'),
    reports: p(V, 'assigned'),
    job_costing: p(V, 'assigned'),
  },

  project_coordinator: {
    projects: p(V, 'assigned'),
    clients: p(V, 'assigned'),
    schedules: p(VE, 'assigned'),
    daily_logs: p(VE, 'assigned'),
    photos_docs: p(CVE, 'assigned'),
    rfis: p(CVE, 'assigned'),
    submittals: p(CVE, 'assigned'),
    punch_lists: p(VE, 'assigned'),
    time_attendance: p(V, 'assigned'),
    materials: p(V, 'assigned'),
    reports: p(V, 'assigned'),
  },

  project_engineer: {
    projects: p(V, 'assigned'),
    change_orders: p(CV, 'assigned'),
    schedules: p(VE, 'assigned'),
    daily_logs: p(CVE, 'assigned'),
    photos_docs: p(CVE, 'assigned'),
    rfis: p(CVE, 'assigned'),
    submittals: p(CVE, 'assigned'),
    punch_lists: p(CVE, 'assigned'),
    safety: p(V, 'assigned'),
    materials: p(V, 'assigned'),
  },

  site_supervisor: {
    projects: p(V, 'assigned'),
    schedules: p(VE, 'assigned'),
    daily_logs: p(CVE, 'assigned'),
    photos_docs: p(CVE, 'assigned'),
    rfis: p(CV, 'assigned'),
    punch_lists: p(CVE, 'assigned'),
    safety: p(CVE, 'assigned'),
    time_attendance: p(CVE, 'assigned'),
    equipment: p(VE, 'assigned'),
    materials: p(VE, 'assigned'),
  },

  safety_officer: {
    projects: p(V, 'company'),
    daily_logs: p(V, 'company'),
    photos_docs: p(CV, 'company'),
    safety: p(CVED, 'company'),
    time_attendance: p(V, 'company'),
    reports: p(V, 'company'),
  },

  crew_lead: {
    projects: p(V, 'assigned'),
    schedules: p(V, 'assigned'),
    daily_logs: p(CVE, 'assigned'),
    photos_docs: p(CVE, 'assigned'),
    punch_lists: p(VE, 'assigned'),
    safety: p(CVE, 'assigned'),
    time_attendance: p(CVE, 'assigned'),
    equipment: p(V, 'assigned'),
    materials: p(V, 'assigned'),
  },

  crew: {
    projects: p(V, 'assigned'),
    daily_logs: p(CV, 'assigned'),
    photos_docs: p(CV, 'assigned'),
    safety: p(V, 'assigned'),
    time_attendance: p(CVE, 'self'),
  },

  tradesperson: {
    projects: p(V, 'assigned'),
    daily_logs: p(CV, 'assigned'),
    photos_docs: p(CV, 'assigned'),
    punch_lists: p(V, 'assigned'),
    safety: p(V, 'assigned'),
    time_attendance: p(CVE, 'self'),
  },

  equipment_operator: {
    projects: p(V, 'assigned'),
    daily_logs: p(CV, 'assigned'),
    safety: p(V, 'assigned'),
    time_attendance: p(CVE, 'self'),
    equipment: p(VE, 'assigned'),
  },

  laborer: {
    projects: p(V, 'assigned'),
    daily_logs: p(['C'], 'assigned'),
    safety: p(V, 'assigned'),
    time_attendance: p(CVE, 'self'),
  },

  apprentice: {
    projects: p(V, 'assigned'),
    safety: p(V, 'assigned'),
    time_attendance: p(CV, 'self'),
  },

  subcontractor: {
    projects: p(V, 'assigned'),
    schedules: p(V, 'assigned'),
    photos_docs: p(CV, 'assigned'),
    rfis: p(CV, 'assigned'),
    submittals: p(CV, 'assigned'),
    punch_lists: p(V, 'assigned'),
    safety: p(V, 'assigned'),
  },

  client: {
    projects: p(V, 'assigned'),
    schedules: p(V, 'assigned'),
    photos_docs: p(V, 'assigned'),
    change_orders: p(V, 'assigned'),
    punch_lists: p(V, 'assigned'),
    invoices_payments: p(V, 'assigned'),
  },
}

export const APP_ROLES = Object.keys(ROLE_LABELS) as AppRole[]

export const ADMIN_CONSOLE_ROLES: AppRole[] = ['admin', 'general_manager', 'operations_manager']
export const USER_MANAGER_ROLES: AppRole[] = ['admin', 'general_manager']

export function getModulePermission(role: AppRole, module: ModuleKey): ModulePermission {
  return PERMISSION_MATRIX[role]?.[module] ?? none()
}

export function can(role: AppRole, module: ModuleKey, code: PermissionCode): boolean {
  return getModulePermission(role, module).codes.includes(code)
}

export function formatCodes(codes: PermissionCode[]): string {
  return codes.length ? codes.join('') : '—'
}

export function scopeLabel(scope: DataScope): string {
  switch (scope) {
    case 'company':
      return 'All company'
    case 'project':
      return 'Project'
    case 'assigned':
      return 'Assigned only'
    case 'self':
      return 'Own records'
    default:
      return 'No access'
  }
}
