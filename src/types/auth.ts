import {
  ADMIN_CONSOLE_ROLES,
  ROLE_LABELS,
  USER_MANAGER_ROLES,
  type AppRole,
} from '../lib/rbac/matrix'

export type { AppRole }

export interface Profile {
  id: string
  full_name: string
  title: string | null
  phone: string | null
  email: string
  app_role: AppRole
  active: boolean
  created_at: string
  updated_at: string
}

/** @deprecated Prefer canAccessAdminConsole — kept for call sites that mean Owner/Admin only */
export function isAdminRole(role: AppRole | null | undefined): boolean {
  return role === 'admin'
}

/** Owner/Admin, GM, Ops — can open Operations Admin console */
export function canAccessAdminConsole(role: AppRole | null | undefined): boolean {
  return !!role && ADMIN_CONSOLE_ROLES.includes(role)
}

/** Owner/Admin + GM — invite users and change roles */
export function canManageUsers(role: AppRole | null | undefined): boolean {
  return !!role && USER_MANAGER_ROLES.includes(role)
}

const OFFICE_ROLES: AppRole[] = [
  'admin',
  'general_manager',
  'operations_manager',
  'estimator',
  'office_manager',
  'bookkeeper',
  'project_manager',
  'project_coordinator',
  'project_engineer',
  'site_supervisor',
  'safety_officer',
]

export function isOfficeRole(role: AppRole | null | undefined): boolean {
  return !!role && OFFICE_ROLES.includes(role)
}

export function canChangeJobStatus(role: AppRole | null | undefined): boolean {
  return isOfficeRole(role)
}

export function canPostNotices(role: AppRole | null | undefined): boolean {
  return isOfficeRole(role)
}

/** Import / trash / metadata on job documents (Phase 1 Document Library). */
export function canManageJobDocuments(role: AppRole | null | undefined): boolean {
  if (!role) return false
  return (
    canAccessAdminConsole(role) ||
    role === 'project_manager' ||
    role === 'project_coordinator' ||
    role === 'project_engineer' ||
    role === 'site_supervisor' ||
    role === 'crew_lead' ||
    role === 'estimator' ||
    role === 'office_manager'
  )
}

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role
}
