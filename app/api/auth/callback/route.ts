import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const RESET_PASSWORD_PATH = '/reset-password'

function recoveryFailureRedirect(requestUrl: URL): NextResponse {
  const redirectUrl = new URL('/forgot-password', requestUrl.origin)
  redirectUrl.searchParams.set('error', 'recovery_link_invalid')
  return NextResponse.redirect(redirectUrl, { status: 303 })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    // Code exchange failed — redirect to login with error indicator
    // so the user sees a clear message instead of a silent loop.
    return NextResponse.redirect(`${origin}/login?error=callback_failed`)
  }

  // No code parameter — redirect to login
  return NextResponse.redirect(`${origin}/login`)
}

/**
 * Completes a password-recovery confirmation only after an explicit user POST.
 *
 * Recovery emails intentionally land on /reset-password/confirm first. Email
 * security scanners may prefetch GET links, so verifying the one-time token on
 * GET would consume it before the user can act. The confirmation page posts the
 * token here; verifyOtp establishes the cookie-backed recovery session and the
 * user is then sent to the existing new-password form.
 */
export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const form = await request.formData()
  const tokenHash = form.get('token_hash')
  const type = form.get('type')

  if (typeof tokenHash !== 'string' || !tokenHash.trim() || type !== 'recovery') {
    return recoveryFailureRedirect(requestUrl)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash.trim(),
    type: 'recovery',
  })

  if (error) {
    return recoveryFailureRedirect(requestUrl)
  }

  return NextResponse.redirect(new URL(RESET_PASSWORD_PATH, requestUrl.origin), {
    status: 303,
  })
}
