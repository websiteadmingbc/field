export type AppRole = 'admin' | 'project_manager' | 'site_supervisor' | 'crew'

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

export function isOfficeRole(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'project_manager' || role === 'site_supervisor'
}

export function canChangeJobStatus(role: AppRole | null | undefined): boolean {
  return isOfficeRole(role)
}

export function canPostNotices(role: AppRole | null | undefined): boolean {
  return isOfficeRole(role)
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'project_manager':
      return 'Project Manager'
    case 'site_supervisor':
      return 'Site Supervisor'
    case 'crew':
      return 'Crew'
  }
}
