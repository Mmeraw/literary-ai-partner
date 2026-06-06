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

const inputCls =
  'block w-full bg-rg-ink border border-rg-cream2/35 text-rg-cream font-rg-serif text-lg px-5 py-4 ' +
  'placeholder:text-rg-cream2/40 focus:outline-none focus:border-rg-gold transition-colors duration-150'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

  const waitForServerSession = async (maxAttempts = 10, intervalMs = 300): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch('/api/auth/user', { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data?.user?.email) return true
        }
      } catch {
        // Retry.
      }
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-rg-ink flex flex-col items-center justify-center px-6 py-14 md:py-20">
      <Link href="/" className="mb-10 flex items-center gap-4 group">
        <span className="inline-flex h-11 w-11 items-center justify-center border border-rg-gold/70 text-rg-gold font-rg-serif text-xl group-hover:border-rg-gold transition-colors">
          R
        </span>
        <span className="font-rg-serif text-rg-cream text-xl tracking-wide">RevisionGrade&#8482;</span>
      </Link>

      <p className="font-rg-mono text-sm tracking-[0.22em] uppercase text-rg-cream2 mb-8">
        <span className="text-rg-red mr-2">&bull;</span>
        Create Account
      </p>

      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-lg px-8 py-10 md:px-12 md:py-12">
        <h1 className="font-rg-serif text-rg-cream text-4xl mb-8 text-center">
          Create account
        </h1>

        {error && (
          <div className="mb-6 border border-rg-red/60 bg-rg-red/10 px-5 py-4 font-rg-mono text-sm text-rg-cream2 leading-relaxed">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 border border-rg-gold/60 bg-rg-gold/10 px-5 py-4 font-rg-mono text-sm text-rg-cream2 leading-relaxed">
            <p>{success}</p>
            <div className="mt-4">
              <Link href="/login" className="font-rg-mono text-sm text-rg-gold hover:text-rg-cream transition-colors underline">
                Continue to sign in
              </Link>
            </div>
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSignup}>
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
            <label htmlFor="password" className="block font-rg-mono text-sm tracking-widest uppercase text-rg-cream2 mb-3">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={password}
                onChange={(e) => setSafePassword(e.target.value)}
                className={inputCls + ' pr-24'}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 font-rg-mono text-sm uppercase tracking-widest text-rg-cream2/70 hover:text-rg-gold transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-3 font-rg-mono text-sm text-rg-cream2/70 leading-6">
              At least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-rg-mono text-sm tracking-widest uppercase text-rg-cream2 mb-3">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                value={confirmPassword}
                onChange={(e) => setSafeConfirmPassword(e.target.value)}
                className={inputCls + ' pr-24'}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 font-rg-mono text-sm uppercase tracking-widest text-rg-cream2/70 hover:text-rg-gold transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !hasSupabaseAuthConfig}
            className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-sm tracking-widest uppercase px-6 py-4 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-center font-rg-serif text-rg-cream2 text-lg">
          Already have an account?{' '}
          <Link href="/login" className="text-rg-gold hover:text-rg-cream transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
