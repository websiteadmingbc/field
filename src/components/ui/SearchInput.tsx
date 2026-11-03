import { Search } from 'lucide-react'
import { cn } from '../../lib/utils'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-border bg-surface-raised pl-11 pr-4 text-sm text-ink placeholder:text-ink-subtle outline-none transition focus:border-gold-line focus:ring-2 focus:ring-teal-soft"
      />
    </div>
  )
}
