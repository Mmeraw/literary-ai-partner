'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  clearAuthFailures,
  getAuthBackoffMs,
  getSafeAuthErrorMessage,
  recordAuthFailure,
} from '@/lib/auth/clientAuthGuards'
import { trackClientAuthEvent } from '@/lib/auth/telemetry'

const hasSupabaseAuthConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const AUTH_UNAVAILABLE_MESSAGE =
  'Authentication is unavailable in this environment. Use production deployment for password reset.'

const PASSWORD_MIN_LENGTH = 10

function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include uppercase, lowercase, and a number.'
  }
  return null
}

const inputCls =
  'block w-full bg-rg-ink border border-rg-cream2/30 text-rg-cream font-rg-serif text-sm px-4 py-3 ' +
  'placeholder:text-rg-cream2/40 focus:outline-none focus:border-rg-gold transition-colors duration-150'

type SessionStatus = 'pending' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('pending')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setSafePassword = (v: string) => {
    setPassword(v)
    if (error) setError(null)
  }
  const setSafeConfirmPassword = (v: string) => {
    setConfirmPassword(v)
    if (error) setError(null)
  }

  // Detect Supabase recovery session from URL hash. The browser client auto-parses
  // the hash on init (detectSessionInUrl: true); we observe the resulting state.
  useEffect(() => {
    if (!hasSupabaseAuthConfig) {
      setSessionStatus('invalid')
      return
    }

    const supabase = createClient()
    supabaseRef.current = supabase

    let isMounted = true
    let resolved = false

    const markReady = () => {
      if (!isMounted || resolved) return
      resolved = true
      setSessionStatus('ready')
    }

    const markInvalid = () => {
      if (!isMounted || resolved) return
      resolved = true
      setSessionStatus('invalid')
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        markReady()
        return
      }
      if (event === 'SIGNED_OUT') {
        markInvalid()
      }
    })

    // Fallback: if the hash has already been consumed before the listener attached,
    // check for an existing session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    // If no recovery event arrives within a short window, treat the link as invalid.
    const timeout = window.setTimeout(() => {
      markInvalid()
    }, 4000)

    return () => {
      isMounted = false
      window.clearTimeout(timeout)
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (sessionStatus !== 'ready') return
    trackClientAuthEvent('reset', 'attempt')

    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!hasSupabaseAuthConfig) {
      trackClientAuthEvent('reset', 'blocked_backoff', { reason: 'missing_supabase_env' })
      setError(AUTH_UNAVAILABLE_MESSAGE)
      setLoading(false)
      return
    }

    const backoffMs = getAuthBackoffMs('reset')
    if (backoffMs > 0) {
      trackClientAuthEvent('reset', 'blocked_backoff')
      setError(`Too many attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`)
      setLoading(false)
      return
    }

    const validationError = validatePassword(password)
    if (validationError) {
      trackClientAuthEvent('reset', 'validation_failed', { reason: 'weak_password' })
      setError(validationError)
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      trackClientAuthEvent('reset', 'validation_failed', { reason: 'password_mismatch' })
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const supabase = supabaseRef.current ?? createClient()

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        recordAuthFailure('reset')
        trackClientAuthEvent('reset', 'failed', { provider: 'password' })
        setError(getSafeAuthErrorMessage(error.message))
        return
      }
      clearAuthFailures('reset')
      trackClientAuthEvent('reset', 'succeeded', { provider: 'password' })
      setSuccess('Password updated. Redirecting to your dashboard…')
      window.setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1200)
    } catch {
      recordAuthFailure('reset')
      trackClientAuthEvent('reset', 'unexpected_error', { provider: 'password' })
      setError('Password update failed unexpectedly. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-rg-ink flex flex-col items-center justify-center px-6 py-16">

      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors">
          R
        </span>
        <span className="font-rg-serif text-rg-cream text-sm tracking-wide">RevisionGrade&#8482;</span>
      </Link>

      <p className="font-rg-mono text-xs tracking-[0.25em] uppercase text-rg-cream2 mb-8">
        <span className="text-rg-red mr-2">●</span>
        Set New Password
      </p>

      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-sm px-8 py-10">

        <h1 className="font-rg-serif text-rg-cream text-2xl mb-6 text-center">
          Choose a new password
        </h1>

        {sessionStatus === 'pending' && (
          <div className="mb-5 border border-rg-cream2/20 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed text-center">
            Verifying reset link…
          </div>
        )}

        {sessionStatus === 'invalid' && (
          <div className="mb-5 border border-rg-red/60 bg-rg-red/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            This reset link is invalid, expired, or has already been used. Request a new one to continue.
          </div>
        )}

        {error && (
          <div className="mb-5 border border-rg-red/60 bg-rg-red/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 border border-rg-gold/50 bg-rg-gold/5 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            {success}
          </div>
        )}

        {sessionStatus !== 'invalid' && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setSafePassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                disabled={sessionStatus !== 'ready'}
              />
              <p className="mt-2 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
                At least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setSafeConfirmPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
                disabled={sessionStatus !== 'ready'}
              />
            </div>

            <button
              type="submit"
              disabled={loading || sessionStatus !== 'ready' || !hasSupabaseAuthConfig}
              className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center font-rg-serif text-rg-cream2 text-xs">
          {sessionStatus === 'invalid' ? (
            <Link href="/forgot-password" className="text-rg-cream2 hover:text-rg-gold transition-colors">
              Request a new reset link
            </Link>
          ) : (
            <Link href="/login" className="text-rg-cream2 hover:text-rg-gold transition-colors">
              Back to sign in
            </Link>
          )}
        </p>

      </div>

      <p className="mt-10 font-rg-mono text-xs tracking-[0.2em] uppercase text-rg-cream2 text-center">
        Powered by the WAVE Revision System · 13 Story Evaluation Criteria
      </p>

    </div>
  )
}
