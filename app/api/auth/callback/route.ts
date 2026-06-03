import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
