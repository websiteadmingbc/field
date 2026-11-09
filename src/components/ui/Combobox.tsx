import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '../../lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
  allowCustom?: boolean
  emptyHint?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Search or type…',
  required,
  disabled,
  className,
  id,
  allowCustom = true,
  emptyHint = 'No matches — keep typing to use a custom value.',
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, query])

  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())

  function commit(next: string) {
    const trimmed = next.trim()
    onChange(trimmed)
    setQuery(trimmed)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (allowCustom) onChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0] && !allowCustom) commit(filtered[0])
              else commit(query)
            } else if (e.key === 'Escape') {
              setOpen(false)
              setQuery(value)
            }
          }}
          onBlur={() => {
            // Delay so option click can fire first
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                commit(query)
              }
            }, 120)
          }}
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-surface py-2 pl-3 pr-10 text-ink outline-none focus:border-gold-line disabled:opacity-60"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Toggle suggestions"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-ink-muted"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg"
        >
          {filtered.map((opt) => (
            <li key={opt} role="option" aria-selected={opt === value}>
              <button
                type="button"
                className={cn(
                  'flex w-full px-3 py-2 text-left text-sm text-ink hover:bg-teal-soft',
                  opt === value && 'bg-teal-soft font-semibold',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">
              {allowCustom ? emptyHint : 'No matches.'}
            </li>
          )}
          {allowCustom && query.trim() && !exactMatch && filtered.length > 0 && (
            <li role="option">
              <button
                type="button"
                className="flex w-full px-3 py-2 text-left text-sm font-semibold text-teal hover:bg-teal-soft"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(query)}
              >
                Use “{query.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
