import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-teal-fill text-on-teal hover:bg-teal-fill-hover shadow-sm shadow-black/25 active:scale-[0.98]',
  secondary:
    'bg-charcoal text-white hover:bg-charcoal-light border border-gold-line/40 active:scale-[0.98]',
  ghost:
    'bg-transparent text-ink hover:bg-surface active:scale-[0.98]',
  danger:
    'bg-rose-soft text-rose hover:opacity-90 active:scale-[0.98]',
  outline:
    'bg-transparent text-ink border border-gold-line hover:bg-teal-soft hover:text-teal active:scale-[0.98] dark:text-white dark:border-gold-line dark:hover:bg-teal-soft dark:hover:text-gold-bright',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-5 text-base gap-2 rounded-md',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold uppercase tracking-wide transition disabled:opacity-50 disabled:pointer-events-none [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
