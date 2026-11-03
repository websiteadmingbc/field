import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

export function LoginPage() {
  const { configured, session, signInWithOtp, verifyEmailOtp } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!configured) {
    return <Navigate to="/" replace />
  }

  if (session) {
    return <Navigate to={from} replace />
  }

  async function sendCode() {
    setError(null)
    setSending(true)
    const result = await signInWithOtp(email)
    setSending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSent(true)
    setCode('')
  }

  async function onSendCode(e: FormEvent) {
    e.preventDefault()
    await sendCode()
  }

  async function onVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setVerifying(true)
    const result = await verifyEmailOtp(email, code)
    setVerifying(false)
    if (result.error) {
      setError(result.error)
    }
    // Session update via onAuthStateChange → Navigate when session is set
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,162,39,0.18), transparent), linear-gradient(180deg, #111 0%, transparent 42%)',
        }}
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle variant="icon" />
        </div>

        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex max-w-sm justify-center">
              <img
                src="/gbc-logo.png"
                alt="Great Britton Construction"
                width={960}
                height={320}
                className="h-auto w-full"
              />
            </div>
            <p className="text-ink-muted">
              Sign in with the email your office invited. We email a one-time code — works on any
              device.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-sm sm:p-8">
            {sent ? (
              <form onSubmit={onVerifyCode} className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-soft text-teal">
                    <Mail className="h-6 w-6" />
                  </div>
                  <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                    Enter your code
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">
                    We sent a 6-digit code to{' '}
                    <span className="font-semibold text-ink">{email}</span>. Check email on any
                    device, then type the code here.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="otp"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
                  >
                    One-time code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                    placeholder="123456"
                    className="h-12 w-full rounded-md border border-border bg-surface px-4 text-center font-mono text-xl tracking-[0.35em] text-ink outline-none ring-teal focus:border-gold-line focus:ring-2"
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifying || code.trim().length < 6}
                >
                  {verifying ? 'Signing in…' : 'Sign in'}
                </Button>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={sending}
                    onClick={() => void sendCode()}
                  >
                    {sending ? 'Sending…' : 'Resend code'}
                  </Button>
                  <button
                    type="button"
                    className="text-xs uppercase tracking-wider text-ink-subtle hover:text-ink-muted"
                    onClick={() => {
                      setSent(false)
                      setCode('')
                      setError(null)
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onSendCode} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted"
                  >
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@greatbrittongc.com"
                    className="h-12 w-full rounded-md border border-border bg-surface px-4 text-ink outline-none ring-teal focus:border-gold-line focus:ring-2"
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={sending || !email.trim()}>
                  {sending ? 'Sending code…' : 'Email me a code'}
                </Button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-ink-subtle">
            Need access? Ask an admin to invite you in Supabase.
            <br />
            <Link to="/privacy" className="mt-2 inline-block text-teal underline-offset-2 hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
