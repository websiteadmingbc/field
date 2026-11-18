import { useState, type FormEvent } from 'react'
import { Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  ASK_FIELD_PRESETS,
  askField,
  type AskFieldPresetId,
} from '../../lib/supabase/askField'

const areaClass =
  'mt-1.5 min-h-[110px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

export function AdminAskFieldPage() {
  const { profile } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [activePreset, setActivePreset] = useState<AskFieldPresetId | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [toolsUsed, setToolsUsed] = useState<string[]>([])
  const [model, setModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function runAsk(nextPrompt: string, preset: AskFieldPresetId | null) {
    const trimmed = nextPrompt.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    setToolsUsed([])
    setModel(null)
    setActivePreset(preset)
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Ask Field needs a live Supabase connection (not demo mode).')
      }
      const result = await askField({ prompt: trimmed, preset })
      setAnswer(result.answer)
      setToolsUsed(result.tools_used ?? [])
      setModel(result.model ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask Field failed')
    } finally {
      setLoading(false)
    }
  }

  function onPreset(id: AskFieldPresetId) {
    const preset = ASK_FIELD_PRESETS.find((p) => p.id === id)
    if (!preset) return
    // Presets run their own prompt; leave free-text empty so only placeholder shows.
    void runAsk(preset.prompt, id)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void runAsk(prompt, null)
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <SectionHeader
          title="Ask Field"
          subtitle="Read-only ops briefings from live Field data. Same query surface as the MCP tools — initiated here in Operations."
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Presets</p>
          <div className="flex flex-wrap gap-2">
            {ASK_FIELD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => onPreset(p.id)}
                title={p.description}
                className={
                  activePreset === p.id && loading
                    ? 'rounded-md bg-teal-fill px-3 py-2 text-left text-sm font-semibold text-on-teal'
                    : 'rounded-md border border-gold-line/40 bg-surface-raised px-3 py-2 text-left text-sm font-semibold text-ink hover:border-teal/50 disabled:opacity-60'
                }
              >
                <span className="block">{p.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold">
            Free-text ask
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                if (e.target.value.trim()) setActivePreset(null)
              }}
              rows={4}
              className={areaClass}
              placeholder="Type a question — e.g. What’s on hold in San Francisco, and any customer communications we should follow up?"
              disabled={loading}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Asking Field…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Ask Field
                </>
              )}
            </Button>
            {profile?.full_name ? (
              <p className="text-xs text-ink-subtle">Signed in as {profile.full_name}</p>
            ) : null}
          </div>
        </form>

        {error && (
          <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}
      </Card>

      {(answer || loading) && (
        <Card className="space-y-3 p-5">
          <SectionHeader
            title="Answer"
            subtitle={
              loading
                ? 'Querying Field data…'
                : model
                  ? `Grounded in live Field tools${toolsUsed.length ? ` · used ${toolsUsed.join(', ')}` : ''} · ${model}`
                  : 'Grounded in live Field tools'
            }
            action={<MessageSquareText className="h-5 w-5 text-teal" />}
          />
          {loading && !answer ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building briefing…
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{answer}</div>
          )}
        </Card>
      )}
    </div>
  )
}
