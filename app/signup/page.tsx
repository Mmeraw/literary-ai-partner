'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import OAuthProviderButtons from '@/components/auth/OAuthProviderButtons'
import {
  clearAuthFailures,
  getAuthBackoffMs,
  getSafeAuthErrorMessage,
  recordAuthFailure,
} from '@/lib/auth/clientAuthGuards'
import { trackClientAuthEvent } from '@/lib/auth/telemetry'
import type { OAuthProviderId } from '@/lib/auth/oauthProviders'

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

  const handleOAuthLogin = async (provider: OAuthProviderId) => {
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
      setError('OAuth sign-up failed unexpectedly. Please try again.')
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
            <p className="mt-1 font-rg-mono text-xs text-rg-cream2/50">
              At least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-rg-mono text-xs tracking-widest uppercase text-rg-cream2 mb-2">
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
                className={inputCls + ' pr-10'}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rg-cream2/50 hover:text-rg-gold transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
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
            className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-rg-cream2/15" />
          <span className="font-rg-mono text-xs tracking-widest uppercase text-rg-cream2">or</span>
          <div className="flex-1 h-px bg-rg-cream2/15" />
        </div>

        {/* OAuth buttons */}
        <OAuthProviderButtons
          loading={loading}
          hasSupabaseAuthConfig={hasSupabaseAuthConfig}
          onProviderClick={handleOAuthLogin}
        />

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
