'use client'

/**
 * Login page — RevisionGrade
 * All auth logic preserved verbatim. Only the visual shell is changed to
 * match the RG editorial design language (rg-ink / rg-cream / rg-gold).
 */

import { useEffect, useState } from 'react'
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
  'Authentication is unavailable in this environment. Use production deployment for sign-in.'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// ── Shared input class ──────────────────────────────────────────────────────
const inputCls =
  'block w-full bg-rg-ink border border-rg-cream2/30 text-rg-cream font-rg-serif text-lg px-5 py-4 ' +
  'placeholder:text-rg-cream2/40 focus:outline-none focus:border-rg-gold transition-colors duration-150'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // If user is already authenticated, redirect to dashboard immediately.
  // Also detect callback failures via ?error= param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'callback_failed') {
      setError('Sign-in failed. Please try again.')
    }

    fetch('/api/auth/user', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.user && data.user.email) {
          router.replace('/dashboard')
        }
      })
      .catch(() => {/* stay on login */})
  }, [router])

  const setSafeEmail    = (v: string) => { setEmail(v);    if (error) setError(null) }
  const setSafePassword = (v: string) => { setPassword(v); if (error) setError(null) }

  // Poll server-side auth to confirm the session cookie is established
  // before navigating. Prevents the middleware redirect-back race.
  const waitForServerSession = async (maxAttempts = 10, intervalMs = 300): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch('/api/auth/user', { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data?.user?.email) return true
        }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return false
  }

  // ── Email/password sign-in ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    trackClientAuthEvent('login', 'attempt')

    const normalizedEmail = email.trim().toLowerCase()
    setLoading(true)
    setError(null)

    if (!hasSupabaseAuthConfig) {
      trackClientAuthEvent('login', 'blocked_backoff', { reason: 'missing_supabase_env' })
      setError(AUTH_UNAVAILABLE_MESSAGE)
      setLoading(false)
      return
    }

    const supabase = createClient()

    const backoffMs = getAuthBackoffMs('login')
    if (backoffMs > 0) {
      trackClientAuthEvent('login', 'blocked_backoff')
      setError(`Too many sign-in attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`)
      setLoading(false)
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      trackClientAuthEvent('login', 'validation_failed', { reason: 'invalid_email' })
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        recordAuthFailure('login')
        trackClientAuthEvent('login', 'failed', { provider: 'password' })
        setError(getSafeAuthErrorMessage(error.message))
        return
      }
      clearAuthFailures('login')
      trackClientAuthEvent('login', 'succeeded', { provider: 'password' })
      await waitForServerSession()
      router.push('/dashboard')
      router.refresh()
    } catch {
      recordAuthFailure('login')
      trackClientAuthEvent('login', 'unexpected_error', { provider: 'password' })
      setError('Sign-in failed unexpectedly. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-rg-ink flex flex-col items-center justify-center px-6 py-16">

      {/* Logo lockup */}
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <span className="inline-flex h-8 w-8 items-center justify-center border border-rg-gold/60 text-rg-gold font-rg-serif text-sm group-hover:border-rg-gold transition-colors">
          R
        </span>
        <span className="font-rg-serif text-rg-cream text-lg tracking-wide">RevisionGrade&#8482;</span>
      </Link>

      {/* Section label */}
      <p className="font-rg-mono text-sm tracking-[0.25em] uppercase text-rg-cream2 mb-8">
        <span className="text-rg-red mr-2">●</span>
        Internal Access
      </p>

      {/* Card */}
      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-xl px-10 py-12 sm:px-12">

        <h1 className="font-rg-serif text-rg-cream text-4xl mb-8 text-center">
          Sign in
        </h1>

        {/* Error message */}
        {error && (
          <div className="mb-6 border border-rg-red/60 bg-rg-red/10 px-5 py-4 font-rg-mono text-sm text-rg-cream2 leading-relaxed">
            {error}
          </div>
        )}

        {/* Email/password form */}
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block font-rg-mono text-sm tracking-widest uppercase text-rg-cream2 mb-3">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setSafeEmail(e.target.value)}
              maxLength={254}
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="password" className="block font-rg-mono text-sm tracking-widest uppercase text-rg-cream2">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-rg-mono text-sm tracking-widest uppercase text-rg-cream2 hover:text-rg-gold transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setSafePassword(e.target.value)}
                className={inputCls + ' pr-10'}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rg-cream2/50 hover:text-rg-gold transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !hasSupabaseAuthConfig}
            className="mt-3 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-sm tracking-widest uppercase px-7 py-4 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Sign up link */}
        <p className="mt-9 text-center font-rg-serif text-rg-cream2 text-base">
          No account?{' '}
          <Link href="/signup" className="text-rg-cream2 hover:text-rg-gold transition-colors">
            Sign up
          </Link>
        </p>

      </div>

      {/* Footer doctrine line */}
      <p className="mt-10 font-rg-mono text-sm tracking-[0.2em] uppercase text-rg-cream2 text-center">
        Powered by the WAVE Revision System · 13 Story Evaluation Criteria
      </p>

    </div>
  )
}
