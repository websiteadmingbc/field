import type { ReactNode } from 'react'
import { Shield, MapPin, EyeOff, FileText } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ThemeToggle } from '../components/ThemeToggle'
import { useApp } from '../context/AppContext'

export function PrivacyPage() {
  const { resetDemo } = useApp()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="animate-fade-up">
        <p className="text-sm font-semibold text-teal">Built for the crew</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
          Privacy & trust
        </h1>
        <p className="mt-2 text-ink-muted">
          Britton Field is a tool for contractors — not a tool to monitor them. This proof of
          concept stores data only on your device.
        </p>
      </header>

      <Card className="space-y-5 p-6 animate-fade-up stagger-1">
        <Principle
          icon={<EyeOff className="h-5 w-5" />}
          title="No employee tracking"
          body="No continuous GPS tracking, background location, geofencing, automatic attendance, productivity scores, or hidden usage monitoring."
        />
        <Principle
          icon={<MapPin className="h-5 w-5" />}
          title="Location stays optional"
          body="Job site addresses are job information. Directions open in your maps app when you choose. Viewing a job never requires sharing your current location."
        />
        <Principle
          icon={<FileText className="h-5 w-5" />}
          title="Logs document the job — not you"
          body="Daily logs capture work progress and hand-off notes. There are no individual performance dashboards or rankings by activity."
        />
        <Principle
          icon={<Shield className="h-5 w-5" />}
          title="What is saved locally"
          body="Job details, notes, logs, notifications, and photos you add are stored in this browser (localStorage and IndexedDB). In this POC, nothing is sent to a server. Your crew would only see shared job information that is intentionally entered."
        />
      </Card>

      <Card className="p-6 animate-fade-up stagger-2">
        <h2 className="font-display text-lg font-semibold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Switch between light and dark. Your choice is saved on this device.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </Card>

      <Card className="p-6 animate-fade-up stagger-2">
        <h2 className="font-display text-lg font-semibold text-ink">Demo controls</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Reset restores the original sample South Bay jobs and clears photos you uploaded in this browser.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            if (confirm('Reset all demo data?')) void resetDemo()
          }}
        >
          Reset Demo Data
        </Button>
      </Card>

      <p className="text-center text-xs text-ink-subtle animate-fade-up stagger-3">
        Britton Field · Great Britton Construction · Demonstration data only
      </p>
    </div>
  )
}

function Principle({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-soft text-teal">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  )
}
