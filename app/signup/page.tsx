'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  'Authentication is unavailable in this environment. Use production deployment for sign-up.'

const PASSWORD_MIN_LENGTH = 10

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include uppercase, lowercase, and a number.'
  }
  return null
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const setSafeEmail = (value: string) => {
    setEmail(value)
    if (error) setError(null)
  }

  const setSafePassword = (value: string) => {
    setPassword(value)
    if (error) setError(null)
  }

  const setSafeConfirmPassword = (value: string) => {
    setConfirmPassword(value)
    if (error) setError(null)
  }

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    trackClientAuthEvent('signup', 'attempt')

    const normalizedEmail = email.trim().toLowerCase()

    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!hasSupabaseAuthConfig) {
      trackClientAuthEvent('signup', 'blocked_backoff', { reason: 'missing_supabase_env' })
      setError(AUTH_UNAVAILABLE_MESSAGE)
      setLoading(false)
      return
    }

    const supabase = createClient()

    const backoffMs = getAuthBackoffMs('signup')
    if (backoffMs > 0) {
      trackClientAuthEvent('signup', 'blocked_backoff')
      setError(`Too many sign-up attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`)
      setLoading(false)
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      trackClientAuthEvent('signup', 'validation_failed', { reason: 'invalid_email' })
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(password)
    if (passwordValidation) {
      trackClientAuthEvent('signup', 'validation_failed', { reason: 'password_policy' })
      setError(passwordValidation)
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      trackClientAuthEvent('signup', 'validation_failed', { reason: 'password_mismatch' })
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        recordAuthFailure('signup')
        trackClientAuthEvent('signup', 'failed', { provider: 'password' })
        setError(getSafeAuthErrorMessage(error.message))
        return
      }

      clearAuthFailures('signup')

      if (data.session) {
        trackClientAuthEvent('signup', 'succeeded', { provider: 'password', mode: 'instant_session' })
        await waitForServerSession()
        router.push('/dashboard')
        router.refresh()
        return
      }

      trackClientAuthEvent('signup', 'succeeded', { provider: 'password', mode: 'email_confirmation' })
      setSuccess('Account created. Check your email for a confirmation link, then sign in.')
    } catch {
      recordAuthFailure('signup')
      trackClientAuthEvent('signup', 'unexpected_error', { provider: 'password' })
      setError('Sign-up failed unexpectedly. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'block w-full bg-rg-ink border border-rg-cream2/30 text-rg-cream font-rg-serif text-sm px-4 py-3 ' +
    'placeholder:text-rg-cream2/40 focus:outline-none focus:border-rg-gold transition-colors duration-150'

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
        <span className="text-rg-red mr-2">&bull;</span>
        Create Account
      </p>

      {/* Card */}
      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-sm px-8 py-10">

        <h1 className="font-rg-serif text-rg-cream text-2xl mb-6 text-center">
          Sign up
        </h1>

        {/* Error message */}
        {error && (
          <div className="mb-5 border border-rg-red/60 bg-rg-red/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mb-5 border border-rg-gold/60 bg-rg-gold/10 px-4 py-3 font-rg-mono text-xs text-rg-cream2 leading-relaxed">
            <p>{success}</p>
            <div className="mt-3">
              <Link href="/login" className="font-rg-mono text-xs text-rg-gold hover:text-rg-cream transition-colors underline">
                Continue to sign in
              </Link>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSignup}>
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
            <label htmlFor="password" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
              Password
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
            />
            <p className="mt-1 font-rg-mono text-xs text-rg-cream2/50">
              At least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
              Confirm Password
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
            />
          </div>

          <button
            type="submit"
            disabled={loading || !hasSupabaseAuthConfig}
            className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center font-rg-mono text-xs text-rg-cream2">
          Already have an account?{' '}
          <Link href="/login" className="text-rg-gold hover:text-rg-cream transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
