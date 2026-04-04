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
  const supabase = createClient()

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    trackClientAuthEvent('signup', 'attempt')

    const normalizedEmail = email.trim().toLowerCase()

    setLoading(true)
    setError(null)
    setSuccess(null)

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">RG</span>
          <span className="text-xl font-semibold text-gray-700">RevisionGrade™</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                <p>{success}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href="/login" className="font-medium text-green-800 underline hover:text-green-900">
                    Continue to sign in
                  </Link>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
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
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setSafePassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use at least {PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a number.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setSafeConfirmPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
