import { NavLink, Outlet } from 'react-router-dom'
import { Briefcase, Shield, Users } from 'lucide-react'
import { cn } from '../../lib/utils'

const tabs = [
  { to: '/admin/people', label: 'Personnel', icon: Users },
  { to: '/admin/roles', label: 'Roles & permissions', icon: Shield },
  { to: '/admin/projects', label: 'Projects', icon: Briefcase },
]

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">Operations</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-[0.04em] text-ink sm:text-4xl">
          Company <span className="text-teal">admin</span>
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Your personal <span className="font-semibold text-ink">Dashboard</span> is day-to-day work.
          This area is where General Manager and Operations Manager run the company — personnel,
          roles, and projects. Personnel type is independent of app role permissions.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3 animate-fade-up stagger-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide transition',
                isActive
                  ? 'bg-teal-fill text-on-teal'
                  : 'border border-gold-line/40 bg-surface-raised text-ink-muted hover:text-ink',
              )
            }
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
