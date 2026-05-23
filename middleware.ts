import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackAuthBypass, trackAuthCheck, trackAuthRedirect } from '@/lib/auth/telemetry'

export async function middleware(request: NextRequest) {
    const matchesPath = (pathname: string, basePath: string): boolean => {
      if (basePath === '/') return pathname === '/'
      return pathname === basePath || pathname.startsWith(`${basePath}/`)
    }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Fail closed if env vars missing (prevents crash loops in CI)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // In CI, bypass auth to prevent crash loops; in prod, fail fast
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.warn('Supabase env vars missing in CI/test, bypassing auth')
      trackAuthBypass('ci_test_missing_env')
      return supabaseResponse
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: unknown = null
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()
    if (error) {
      trackAuthCheck('error')
      user = null
    } else {
      user = authUser
      trackAuthCheck(authUser ? 'authenticated' : 'anonymous')
    }
  } catch {
    // Fail closed for protected routes while preserving middleware stability.
    trackAuthCheck('error')
    user = null
  }

  // Public paths that don't require auth.
  // Private beta should be an access layer, not a separate site surface.
  // Marketing and informational routes remain public; only app/workflow routes are gated.
  const publicPaths = [
    '/',
    '/revise',
    '/queue',
    '/pricing',
    '/resources',
    '/reliability',
    '/methodology',
    '/privacy',
    '/terms',
    '/contact',
    '/convert',
    '/output',
    '/storygate',
    '/your-writing',
    '/private-beta',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/api/auth/callback',
    '/auth/callback',
    '/marketing-preview',
    '/api/cron',
    '/api/workers',
    '/api/admin/proof/jobs',
    '/api/health',
    '/api/evaluate',
    '/api/dev/metrics-smoke',
  ]

  const protectedPrefixes = [
    '/dashboard',
    '/evaluate',
    '/workbench',
    '/admin',
    '/reports',
    '/api/jobs',
    '/api/evaluations',
    '/api/internal',
    '/api/manuscripts',
    '/api/report-shares',
    '/api/reports',
    '/api/workflows/evaluate',
  ]

  const isPublicPath = publicPaths.some(path =>
    matchesPath(request.nextUrl.pathname, path)
  )
  const isProtectedPath = protectedPrefixes.some(path =>
    matchesPath(request.nextUrl.pathname, path)
  )

  // Gate only protected paths for unauthenticated users.
  if (!user && isProtectedPath && !isPublicPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/private-beta'
    trackAuthRedirect('login_required')
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect logged-in users away from private-beta and auth entry pages
  if (user && (request.nextUrl.pathname === '/private-beta' || request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    trackAuthRedirect('already_authenticated')
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
