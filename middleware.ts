import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackAuthBypass, trackAuthCheck, trackAuthRedirect } from '@/lib/auth/telemetry'

const isProduction = process.env.NODE_ENV === 'production'

function buildContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Next.js currently needs unsafe-inline/unsafe-eval in some runtime/dev paths.
    // Keep the policy enforced but compatible; tighten later with nonce/hash once app shell is stable.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.perplexity.ai https://api.resend.com https://vercel.live https://*.vercel-insights.com https://*.vercel-analytics.com",
    "frame-src 'self' https://vercel.live",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ]

  return directives.join('; ')
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()'
  )
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy())

  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  return response
}

function secureNextResponse(request: NextRequest): NextResponse {
  return applySecurityHeaders(NextResponse.next({ request }))
}

function secureRedirect(url: URL): NextResponse {
  return applySecurityHeaders(NextResponse.redirect(url))
}

export async function middleware(request: NextRequest) {
    const matchesPath = (pathname: string, basePath: string): boolean => {
      if (basePath === '/') return pathname === '/'
      return pathname === basePath || pathname.startsWith(`${basePath}/`)
    }

  const allowHeaderActorInTestMode =
    process.env.TEST_MODE === 'true' &&
    process.env.ALLOW_HEADER_USER_ID === 'true'

  const hasHeaderActor = Boolean(request.headers.get('x-user-id')?.trim())

  const shouldBypassProtectedApiAuthGate =
    allowHeaderActorInTestMode &&
    hasHeaderActor &&
    matchesPath(request.nextUrl.pathname, '/api')

  let supabaseResponse = secureNextResponse(request)

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = secureNextResponse(request)
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
    if (shouldBypassProtectedApiAuthGate) {
      trackAuthBypass('header_actor_test_mode')
      return supabaseResponse
    }

    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    trackAuthRedirect('login_required')
    return secureRedirect(redirectUrl)
  }

  // Redirect logged-in users away from auth entry pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    trackAuthRedirect('already_authenticated')
    return secureRedirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
