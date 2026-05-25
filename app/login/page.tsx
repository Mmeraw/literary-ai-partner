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
  'block w-full bg-rg-ink border border-rg-cream2/30 text-rg-cream font-rg-serif text-sm px-4 py-3 ' +
  'placeholder:text-rg-cream2/40 focus:outline-none focus:border-rg-gold transition-colors duration-150'

export default function LoginPage() {
  const router2 = useRouter()

  // If user is already authenticated, redirect to dashboard immediately
  useEffect(() => {
    fetch('/api/auth/user', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.user && data.user.email) {
          router2.replace('/dashboard')
        }
      })
      .catch(() => {/* stay on login */})
  }, [])

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const setSafeEmail    = (v: string) => { setEmail(v);    if (error) setError(null) }
  const setSafePassword = (v: string) => { setPassword(v); if (error) setError(null) }

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

  // ── OAuth sign-in ───────────────────────────────────────────────────────
  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    if (loading) return
    trackClientAuthEvent('oauth', 'attempt', { provider })
    setLoading(true)
    setError(null)

    if (!hasSupabaseAuthConfig) {
      trackClientAuthEvent('oauth', 'blocked_backoff', { provider, reason: 'missing_supabase_env' })
      setError(AUTH_UNAVAILABLE_MESSAGE)
      setLoading(false)
      return
    }

    const supabase = createClient()

    const backoffMs = getAuthBackoffMs('oauth')
    if (backoffMs > 0) {
      trackClientAuthEvent('oauth', 'blocked_backoff', { provider })
      setError(`Too many OAuth attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) {
        recordAuthFailure('oauth')
        trackClientAuthEvent('oauth', 'failed', { provider })
        setError(getSafeAuthErrorMessage(error.message))
        setLoading(false)
        return
      }
      if (!data?.url) {
        recordAuthFailure('oauth')
        trackClientAuthEvent('oauth', 'failed', { provider, reason: 'missing_redirect_url' })
        setError('Could not start OAuth redirect. Please try again.')
        setLoading(false)
        return
      }
      clearAuthFailures('oauth')
      trackClientAuthEvent('oauth', 'redirect_started', { provider })
    } catch {
      recordAuthFailure('oauth')
      trackClientAuthEvent('oauth', 'unexpected_error', { provider })
      setError('OAuth sign-in failed unexpectedly. Please try again.')
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
        <span className="font-rg-serif text-rg-cream text-sm tracking-wide">RevisionGrade&#8482;</span>
      </Link>

      {/* Section label */}
      <p className="font-rg-mono text-xs tracking-[0.25em] uppercase text-rg-cream2 mb-8">
        <span className="text-rg-red mr-2">●</span>
        Internal Access
      </p>

      {/* Card */}
      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-sm px-8 py-10">

        <h1 className="font-rg-serif text-rg-cream text-2xl mb-6 text-center">
          Sign in
        </h1>

        {/* Error message */}
        {error && (
          <div className="mb-5 border border-rg-red/60 bg-rg-red/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            {error}
          </div>
        )}

        {/* Email/password form */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
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
              <label htmlFor="password" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 hover:text-rg-gold transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setSafePassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !hasSupabaseAuthConfig}
            className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-rg-cream2/15" />
          <span className="font-rg-mono text-xs tracking-widest uppercase text-rg-cream2">or</span>
          <div className="flex-1 h-px bg-rg-cream2/15" />
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            disabled={loading || !hasSupabaseAuthConfig}
            className="w-full flex items-center justify-center gap-3 border border-rg-cream2/30 text-rg-cream2 font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-cream2/60 hover:text-rg-cream transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {/* Google G */}
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('azure')}
            disabled={loading || !hasSupabaseAuthConfig}
            className="w-full flex items-center justify-center gap-3 border border-rg-cream2/30 text-rg-cream2 font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-cream2/60 hover:text-rg-cream transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {/* Microsoft logo */}
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
              <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </button>
        </div>

        {/* Sign up link */}
        <p className="mt-8 text-center font-rg-serif text-rg-cream2 text-xs">
          No account?{' '}
          <Link href="/signup" className="text-rg-cream2 hover:text-rg-gold transition-colors">
            Sign up
          </Link>
        </p>

      </div>

      {/* Footer doctrine line */}
      <p className="mt-10 font-rg-mono text-xs tracking-[0.2em] uppercase text-rg-cream2 text-center">
        Powered by the WAVE Revision System · 13 Story Evaluation Criteria
      </p>

    </div>
  )
}
