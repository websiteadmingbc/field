import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Mic, MicOff, MessageSquareText, Sparkles, Square, Volume2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, SectionHeader } from '../../components/ui/Card'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import {
  ASK_FIELD_ASSISTANT_NAME,
  ASK_FIELD_PRESETS,
  askField,
  blobToBase64,
  speakAskFieldAnswer,
  transcribeAskFieldAudio,
  type AskFieldPresetId,
} from '../../lib/supabase/askField'

const areaClass =
  'mt-1.5 min-h-[110px] w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-gold-line'

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export function AdminAskFieldPage() {
  const { profile } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [activePreset, setActivePreset] = useState<AskFieldPresetId | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [toolsUsed, setToolsUsed] = useState<string[]>([])
  const [model, setModel] = useState<string | null>(null)
  const [assistantName, setAssistantName] = useState(ASK_FIELD_ASSISTANT_NAME)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoSpeakRef = useRef(true)

  useEffect(() => {
    return () => {
      stopMediaTracks()
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function stopMediaTracks() {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
  }

  async function runAsk(nextPrompt: string, preset: AskFieldPresetId | null) {
    const trimmed = nextPrompt.trim()
    if (!trimmed || loading || recording || transcribing) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    setToolsUsed([])
    setModel(null)
    setActivePreset(preset)
    setVoiceStatus(null)
    stopSpeaking()
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Ask Field needs a live Supabase connection (not demo mode).')
      }
      const result = await askField({ prompt: trimmed, preset })
      setAnswer(result.answer)
      setToolsUsed(result.tools_used ?? [])
      setModel(result.model ?? null)
      if (result.assistant_name) setAssistantName(result.assistant_name)
      if (autoSpeakRef.current && result.answer) {
        void playAnswer(result.answer)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask Field failed')
    } finally {
      setLoading(false)
    }
  }

  function onPreset(id: AskFieldPresetId) {
    const preset = ASK_FIELD_PRESETS.find((p) => p.id === id)
    if (!preset) return
    void runAsk(preset.prompt, id)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void runAsk(prompt, null)
  }

  async function startRecording() {
    setError(null)
    setVoiceStatus(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support microphone recording.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = () => {
        void finishRecording(recorder.mimeType || mimeType || 'audio/webm')
      }
      recorder.start()
      setRecording(true)
      setVoiceStatus('Listening… tap Stop when finished')
    } catch (err) {
      stopMediaTracks()
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access microphone. Allow mic permission and try again.',
      )
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false)
      stopMediaTracks()
      return
    }
    recorder.stop()
    setRecording(false)
    setVoiceStatus('Transcribing with Whisper…')
  }

  async function finishRecording(mimeType: string) {
    setTranscribing(true)
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      stopMediaTracks()
      if (blob.size < 500) {
        throw new Error('Recording was too short. Hold a bit longer and try again.')
      }
      const audioBase64 = await blobToBase64(blob)
      const text = await transcribeAskFieldAudio({ audioBase64, mimeType })
      setPrompt(text)
      setActivePreset(null)
      setTranscribing(false)
      setVoiceStatus('Transcribed — asking Field…')
      await runAsk(text, null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice transcription failed')
      setVoiceStatus(null)
      setTranscribing(false)
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }

  async function playAnswer(text: string) {
    stopSpeaking()
    setSpeaking(true)
    setVoiceStatus('Generating speech…')
    setError(null)
    try {
      const { audioUrl } = await speakAskFieldAnswer(text)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => {
        setSpeaking(false)
        setVoiceStatus(null)
        audioRef.current = null
      }
      audio.onerror = () => {
        setSpeaking(false)
        setVoiceStatus(null)
        setError('Could not play speech audio.')
      }
      setVoiceStatus('Speaking…')
      await audio.play()
    } catch (err) {
      setSpeaking(false)
      setVoiceStatus(null)
      setError(err instanceof Error ? err.message : 'Text-to-speech failed')
    }
  }

  const busy = loading || recording || transcribing || speaking

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <SectionHeader
          title="Ask Field"
          subtitle={`${assistantName} — read-only ops briefings from live Field data. Type, use a preset, or talk (Whisper → ${assistantName} → voice).`}
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Presets</p>
          <div className="flex flex-wrap gap-2">
            {ASK_FIELD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
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
              placeholder="Type a question — or tap the mic and talk. e.g. What’s on hold in San Francisco?"
              disabled={busy && !recording}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !prompt.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Asking Field…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Ask {assistantName}
                </>
              )}
            </Button>

            {!recording ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void startRecording()}
              >
                <Mic className="h-4 w-4" />
                Talk
              </Button>
            ) : (
              <Button type="button" variant="danger" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            )}

            {transcribing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Whisper…
              </span>
            )}

            {profile?.full_name ? (
              <p className="text-xs text-ink-subtle">Signed in as {profile.full_name}</p>
            ) : null}
          </div>
          {voiceStatus && (
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              {recording ? <MicOff className="h-3.5 w-3.5 text-rose" /> : null}
              {voiceStatus}
            </p>
          )}
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
            title={`${assistantName} answered`}
            subtitle={
              loading
                ? `${assistantName} is querying Field data…`
                : model
                  ? `Grounded in live Field tools${toolsUsed.length ? ` · used ${toolsUsed.join(', ')}` : ''} · ${model}`
                  : 'Grounded in live Field tools'
            }
            action={
              answer ? (
                <div className="flex gap-2">
                  {speaking ? (
                    <Button type="button" size="sm" variant="outline" onClick={stopSpeaking}>
                      <Square className="h-4 w-4" />
                      Stop voice
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading || transcribing}
                      onClick={() => void playAnswer(answer)}
                    >
                      <Volume2 className="h-4 w-4" />
                      Play voice
                    </Button>
                  )}
                  <MessageSquareText className="hidden h-5 w-5 text-teal sm:block" />
                </div>
              ) : (
                <MessageSquareText className="h-5 w-5 text-teal" />
              )
            }
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
