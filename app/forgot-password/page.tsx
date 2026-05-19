'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

const PRODUCTION_URL = 'https://literary-ai-partner.vercel.app'

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getResetRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/reset-password`
  }
  return `${PRODUCTION_URL}/reset-password`
}

const inputCls =
  'block w-full bg-rg-ink border border-rg-cream2/30 text-rg-cream font-rg-serif text-sm px-4 py-3 ' +
  'placeholder:text-rg-dim focus:outline-none focus:border-rg-gold transition-colors duration-150'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setSafeEmail = (v: string) => {
    setEmail(v)
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    trackClientAuthEvent('reset', 'attempt')

    const normalizedEmail = email.trim().toLowerCase()
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
      setError(`Too many reset attempts. Try again in ${Math.ceil(backoffMs / 1000)}s.`)
      setLoading(false)
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      trackClientAuthEvent('reset', 'validation_failed', { reason: 'invalid_email' })
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getResetRedirectUrl(),
      })
      if (error) {
        recordAuthFailure('reset')
        trackClientAuthEvent('reset', 'failed', { provider: 'password' })
        setError(getSafeAuthErrorMessage(error.message))
        return
      }
      clearAuthFailures('reset')
      trackClientAuthEvent('reset', 'succeeded', { provider: 'password' })
      setSuccess('Check your email for a reset link. The link will expire shortly for security.')
    } catch {
      recordAuthFailure('reset')
      trackClientAuthEvent('reset', 'unexpected_error', { provider: 'password' })
      setError('Reset request failed unexpectedly. Please try again.')
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

      <p className="font-rg-mono text-[10px] tracking-[0.25em] uppercase text-rg-dim mb-8">
        <span className="text-rg-red mr-2">●</span>
        Password Reset
      </p>

      <div className="border border-rg-cream2/20 bg-rg-ink2 w-full max-w-sm px-8 py-10">

        <h1 className="font-rg-serif text-rg-cream text-2xl mb-3 text-center">
          Reset your password
        </h1>
        <p className="font-rg-serif text-rg-dim text-xs text-center mb-6 leading-relaxed">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

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

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block font-rg-mono text-[10px] tracking-widest uppercase text-rg-dim mb-2">
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

          <button
            type="submit"
            disabled={loading || !hasSupabaseAuthConfig}
            className="mt-2 w-full border border-rg-cream2/50 text-rg-cream font-rg-mono text-xs tracking-widest uppercase px-6 py-3 hover:border-rg-gold hover:text-rg-gold transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-8 text-center font-rg-serif text-rg-dim text-xs">
          Remember your password?{' '}
          <Link href="/login" className="text-rg-cream2 hover:text-rg-gold transition-colors">
            Back to sign in
          </Link>
        </p>

      </div>

      <p className="mt-10 font-rg-mono text-[10px] tracking-[0.2em] uppercase text-rg-dim text-center">
        Powered by the WAVE Revision System · 13 Story Evaluation Criteria
      </p>

    </div>
  )
}
