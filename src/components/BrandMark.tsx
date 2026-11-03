import { cn } from '../lib/utils'

/** Compact mark inspired by Great Britton Construction branding */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 40 40"
        className="h-10 w-10 shrink-0"
        aria-hidden
        fill="none"
      >
        <rect
          width="40"
          height="40"
          rx="4"
          fill="#0e0e0e"
          stroke="#d4af37"
          strokeWidth="1.5"
        />
        {/* Claw hammer — head */}
        <path
          d="M9 15.5c0-.8.7-1.5 1.5-1.5H22c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5h-2.2l-1.8 2.4c-.3.4-.9.4-1.2 0L15 21.5h-4.5c-.8 0-1.5-.7-1.5-1.5v-4.5z"
          fill="#d4af37"
        />
        {/* Claw notch */}
        <path
          d="M22 14h5.5c.6 0 1 .5.8 1.1l-1.8 4.4c-.1.3-.4.5-.7.5H22V14z"
          fill="#e8c547"
        />
        {/* Handle */}
        <path
          d="M17.2 22.5h3.1c.4 0 .7.3.7.7V31c0 .6-.5 1-1.1 1h-2.3c-.6 0-1.1-.4-1.1-1v-7.8c0-.4.3-.7.7-.7z"
          fill="#d4af37"
        />
      </svg>
      <div className="min-w-0 leading-tight">
        <p className="font-display text-lg font-semibold uppercase tracking-[0.06em] text-white">
          Britton Field
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
          Great Britton Construction
        </p>
      </div>
    </div>
  )
}
