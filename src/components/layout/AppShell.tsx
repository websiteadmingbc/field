import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Briefcase,
  Building2,
  Camera,
  CircleHelp,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { BrandMark } from '../BrandMark'
import { ThemeToggle } from '../ThemeToggle'
import { cn } from '../../lib/utils'
import { canAccessAdminConsole, isOfficeRole, roleLabel } from '../../types/auth'

type NavItem = {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  /** When set, item stays active for any path under this prefix (e.g. Operations → /admin/*). */
  activePrefix?: string
}

export function AppShell() {
  const { currentUser, unreadCount, resetDemo, remote } = useApp()
  const { configured, profile, signOut, isOffice } = useAuth()
  const showAdmin = canAccessAdminConsole(profile?.app_role)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const navItems = useMemo<NavItem[]>(() => {
    const field: NavItem[] = [
      ...(isOffice
        ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        : [{ to: '/', label: 'Today', icon: Home, end: true }]),
      { to: '/jobs', label: 'My Jobs', icon: Briefcase },
      { to: '/log', label: 'Daily Log', icon: ClipboardList },
      { to: '/photos', label: 'Photos', icon: Camera },
      { to: '/team', label: 'Team', icon: Users },
      { to: '/customers', label: 'Customers', icon: Building2 },
      { to: '/notifications', label: 'Updates', icon: Bell },
      ...(showAdmin
        ? [{ to: '/admin/people', label: 'Operations', icon: Settings2, activePrefix: '/admin' }]
        : []),
      { to: '/help', label: 'Help', icon: CircleHelp },
      { to: '/privacy', label: 'Privacy', icon: Shield },
    ]
    if (isOffice && !field.some((i) => i.to === '/')) {
      field.splice(1, 0, { to: '/', label: 'Today', icon: Home, end: true })
    }
    return field
  }, [isOffice, showAdmin])

  const mobileNav = useMemo<NavItem[]>(() => {
    if (isOffice) {
      return [
        { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
        { to: '/jobs', label: 'Jobs', icon: Briefcase },
        ...(showAdmin
          ? [{ to: '/admin/people', label: 'Ops', icon: Settings2, activePrefix: '/admin' }]
          : []),
        { to: '/photos', label: 'Photos', icon: Camera },
        { to: '/notifications', label: 'Updates', icon: Bell },
      ]
    }
    return [
      { to: '/', label: 'Today', icon: Home, end: true },
      { to: '/jobs', label: 'Jobs', icon: Briefcase },
      { to: '/log', label: 'Log', icon: ClipboardList },
      { to: '/photos', label: 'Photos', icon: Camera },
      { to: '/notifications', label: 'Updates', icon: Bell },
    ]
  }, [isOffice, showAdmin])

  const roleText =
    profile && isOfficeRole(profile.app_role)
      ? roleLabel(profile.app_role)
      : currentUser?.role

  function navItemActive(item: NavItem, isActive: boolean): boolean {
    if (item.activePrefix) {
      return (
        location.pathname === item.activePrefix ||
        location.pathname.startsWith(`${item.activePrefix}/`)
      )
    }
    return isActive
  }

  return (
    <div className="min-h-dvh bg-surface lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gold-line/20 bg-charcoal text-white lg:flex">
        <div className="border-b border-gold-line/25 px-5 py-6">
          <BrandMark />
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-white/55">
            Every job. Every crew.
            <span className="text-teal"> One place.</span>
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-wide transition',
                  navItemActive(item, isActive)
                    ? 'bg-teal-fill text-on-teal'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gold-line/20 p-4">
          <div className="rounded-md border border-gold-line/30 bg-white/5 px-3 py-3">
            <p className="text-sm font-semibold">
              {profile?.full_name ?? currentUser?.name ?? 'Crew member'}
            </p>
            <p className="text-xs uppercase tracking-wider text-teal">{roleText}</p>
            {remote && (
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">Live · Supabase</p>
            )}
          </div>
          <div className="mt-2">
            <ThemeToggle variant="sidebar" />
          </div>
          {configured ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs uppercase tracking-wider text-white/40 transition hover:bg-white/5 hover:text-white/70"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset all demo data to the original sample set?')) {
                  void resetDemo()
                }
              }}
              className="mt-1 w-full rounded-md px-3 py-2 text-left text-xs uppercase tracking-wider text-white/40 transition hover:bg-white/5 hover:text-white/70"
            >
              Reset Demo Data
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface-raised/90 px-4 py-3 backdrop-blur lg:hidden">
          <div>
            <p className="font-display text-base font-semibold uppercase tracking-[0.06em] text-ink">
              Britton Field
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
              Great Britton Construction
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <NavLink
              to="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-md border border-gold-line/50 text-ink"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-fill px-1 text-[10px] font-bold text-on-teal">
                  {unreadCount}
                </span>
              )}
            </NavLink>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gold-line/50 text-ink"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 animate-fade-in"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-0 flex h-full w-72 flex-col border-l border-gold-line/25 bg-charcoal text-white shadow-2xl animate-fade-up">
              <div className="flex items-center justify-between border-b border-gold-line/25 px-4 py-4">
                <div>
                  <p className="font-display font-semibold uppercase tracking-wide">Menu</p>
                  <p className="text-xs text-teal">
                    {profile?.full_name ?? currentUser?.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-gold-line/40 bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold uppercase tracking-wide',
                        navItemActive(item, isActive)
                          ? 'bg-teal-fill text-on-teal'
                          : 'hover:bg-white/5',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="space-y-2 border-t border-gold-line/20 p-4">
                <ThemeToggle variant="sidebar" />
                {configured ? (
                  <button
                    type="button"
                    onClick={() => {
                      void signOut()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-gold-line/30 px-3 py-2.5 text-sm uppercase tracking-wide text-white/70"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset all demo data to the original sample set?')) {
                        void resetDemo()
                        setMenuOpen(false)
                      }
                    }}
                    className="w-full rounded-md border border-gold-line/30 px-3 py-2.5 text-sm uppercase tracking-wide text-white/70"
                  >
                    Reset Demo Data
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <main
          key={location.pathname}
          className="flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8"
        >
          <div className={cn('mx-auto', isOffice ? 'max-w-6xl' : 'max-w-5xl')}>
            <Outlet />
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-lg items-stretch justify-around py-2">
            {mobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-w-[64px] flex-col items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition',
                    navItemActive(item, isActive) ? 'text-teal' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => {
                  const active = navItemActive(item, isActive)
                  return (
                    <>
                      <item.icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                      {item.label}
                      {item.to === '/notifications' && unreadCount > 0 && (
                        <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-teal-fill" />
                      )}
                    </>
                  )
                }}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
