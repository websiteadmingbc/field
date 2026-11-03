import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase/client'
import { useAuth } from '../context/AuthContext'
import { isOfficeRole } from '../types/auth'

export function AuthCallbackPage() {
  const { configured, profile, ready, session } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!configured) {
      setDone(true)
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      setError('Supabase is not configured.')
      setDone(true)
      return
    }

    let cancelled = false
    ;(async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type') as EmailOtpType | null

      // Cross-device friendly: token_hash from custom email template
      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
        if (otpError && !cancelled) {
          setError(otpError.message)
          setDone(true)
          return
        }
      } else if (code) {
        // Same-browser PKCE exchange (legacy / default ConfirmURL)
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError && !cancelled) {
          const pkce = /code verifier|pkce/i.test(exchangeError.message)
          setError(
            pkce
              ? 'That email link only works in the same browser that requested it. Go back to Sign in and enter the 6-digit code from the email instead — that works on any device.'
              : exchangeError.message,
          )
          setDone(true)
          return
        }
      }

      if (!cancelled) setDone(true)
    })()

    return () => {
      cancelled = true
    }
  }, [configured])

  if (!configured) return <Navigate to="/" replace />

  if (!done || !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Signing you in…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-4">
        <p className="max-w-md text-center text-rose">{error}</p>
        <a href="/login" className="text-sm font-semibold uppercase tracking-wide text-teal">
          Back to sign in
        </a>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const home = isOfficeRole(profile?.app_role) ? '/dashboard' : '/'
  return <Navigate to={home} replace />
}
