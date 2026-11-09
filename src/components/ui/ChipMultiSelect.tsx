import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type Props = {
  value: string[]
  onChange: (value: string[]) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ChipMultiSelect({
  value,
  onChange,
  options,
  placeholder = 'Add a role…',
  disabled,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const available = useMemo(() => {
    const selected = new Set(value.map((v) => v.toLowerCase()))
    const q = query.trim().toLowerCase()
    return options.filter((o) => {
      if (selected.has(o.toLowerCase())) return false
      if (!q) return true
      return o.toLowerCase().includes(q)
    })
  }, [options, query, value])

  function add(role: string) {
    const next = role.trim()
    if (!next) return
    if (value.some((v) => v.toLowerCase() === next.toLowerCase())) return
    onChange([...value, next])
    setQuery('')
    setOpen(false)
  }

  function remove(role: string) {
    onChange(value.filter((v) => v !== role))
  }

  return (
    <div ref={rootRef} className={cn('relative mt-1.5', className)}>
      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5',
          disabled && 'opacity-60',
        )}
      >
        {value.map((role) => (
          <span
            key={role}
            className="inline-flex items-center gap-1 rounded-md border border-gold-line/40 bg-teal-soft px-2 py-1 text-xs font-semibold text-ink"
          >
            {role}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${role}`}
                className="text-ink-muted hover:text-ink"
                onClick={() => remove(role)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          disabled={disabled}
          value={query}
          placeholder={value.length === 0 ? placeholder : 'Add another…'}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink outline-none"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && value.length > 0) {
              remove(value[value.length - 1]!)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              if (available[0]) add(available[0])
              else if (query.trim()) add(query)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="Add role"
          className="flex h-8 w-8 items-center justify-center text-ink-muted hover:text-ink"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg">
          {available.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm text-ink hover:bg-teal-soft"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
          {available.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">
              {query.trim() ? `Press Enter to add “${query.trim()}”` : 'All options selected.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
