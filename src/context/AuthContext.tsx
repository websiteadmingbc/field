import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase/client'
import type { Profile } from '../types/auth'
import { isOfficeRole } from '../types/auth'

interface AuthContextValue {
  configured: boolean
  ready: boolean
  session: Session | null
  profile: Profile | null
  isOffice: boolean
  signInWithOtp: (email: string) => Promise<{ error: string | null }>
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.error('Failed to load profile', error)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [ready, setReady] = useState(!configured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    const {
      data: { session: current },
    } = await supabase.auth.getSession()
    if (!current?.user) {
      setProfile(null)
      return
    }
    const next = await fetchProfile(current.user.id)
    setProfile(next)
  }, [])

  useEffect(() => {
    if (!configured) return
    const supabase = getSupabase()
    if (!supabase) return

    let cancelled = false

    ;(async () => {
      const {
        data: { session: initial },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(initial)
      if (initial?.user) {
        setProfile(await fetchProfile(initial.user.id))
      }
      setReady(true)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        void fetchProfile(nextSession.user.id).then((p) => {
          if (!cancelled) setProfile(p)
        })
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured])

  const signInWithOtp = useCallback(async (email: string) => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Supabase is not configured.' }

    const redirectTo = `${window.location.origin}/auth/callback`
    // Invite-only: do not create Auth users from the login form.
    // New accounts must be provisioned via Operations → invite (Edge Function).
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    })
    if (!error) return { error: null }

    const message = error.message ?? ''
    if (/signups?\s+not\s+allowed|user\s+not\s+found|unable to (find|create)|not registered/i.test(message)) {
      return {
        error:
          'This email is not invited. Ask an Owner/Admin, General Manager, or Operations Manager to send an invite from Operations.',
      }
    }
    return { error: message }
  }, [])

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Supabase is not configured.' }

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      session,
      profile,
      isOffice: isOfficeRole(profile?.app_role),
      signInWithOtp,
      verifyEmailOtp,
      signOut,
      refreshProfile,
    }),
    [configured, ready, session, profile, signInWithOtp, verifyEmailOtp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
