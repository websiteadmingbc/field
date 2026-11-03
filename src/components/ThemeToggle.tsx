import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { cn } from '../lib/utils'

export function ThemeToggle({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'sidebar' | 'icon'
  className?: string
}) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl border border-border text-ink transition hover:bg-surface',
          className,
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    )
  }

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white',
          className,
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
        <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {isDark ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
