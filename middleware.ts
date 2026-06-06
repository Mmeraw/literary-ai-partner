import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { trackAuthBypass, trackAuthCheck, trackAuthRedirect } from '@/lib/auth/telemetry'

const isProduction = process.env.NODE_ENV === 'production'

const PUBLIC_API_PATHS = [
  '/api/auth/callback',
  '/api/auth/check-email',
  '/api/stripe/webhook',
  '/api/health',
  '/api/contact',
  '/api/analytics/track',
  '/api/dev/metrics-smoke',
]

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

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
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
      return applySecurityHeaders(supabaseResponse)
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
    '/api/auth/check-email',
    '/auth/callback',
    '/marketing-preview',
    '/api/cron',
  ]

  const protectedPrefixes = [
    '/dashboard',
    '/evaluate',
    '/workbench',
    '/admin',
    '/reports',
    '/api',
  ]

  const isPublicPath = publicPaths.some(path =>
    matchesPath(request.nextUrl.pathname, path)
  )
  const isProtectedPath = protectedPrefixes.some(path =>
    matchesPath(request.nextUrl.pathname, path)
  )

  if (matchesPath(request.nextUrl.pathname, '/api/workers')) {
    const workerSecret = process.env.WORKER_SECRET
    const presentedWorkerSecret = request.headers.get('x-worker-secret')?.trim() || ''
    const allowWorkerSecretBypass =
      process.env.NODE_ENV === 'test' ||
      process.env.CI === 'true'

    if (!allowWorkerSecretBypass && !workerSecret) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            error: 'Unauthorized',
            code: 'WORKER_SECRET_REQUIRED',
          },
          { status: 401 }
        )
      )
    }

    if (!allowWorkerSecretBypass && presentedWorkerSecret !== workerSecret) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            error: 'Unauthorized',
            code: 'WORKER_SECRET_REQUIRED',
          },
          { status: 401 }
        )
      )
    }
  }

  // Gate only protected paths for unauthenticated users.
  if (!user && isProtectedPath && !isPublicPath) {
    if (matchesPath(request.nextUrl.pathname, '/api') && isPublicApiPath(request.nextUrl.pathname)) {
      return applySecurityHeaders(supabaseResponse)
    }

    if (shouldBypassProtectedApiAuthGate) {
      trackAuthBypass('header_actor_test_mode')
      return applySecurityHeaders(supabaseResponse)
    }

    // API routes must return JSON auth errors (not HTML redirects)
    // so clients do not hit JSON parse errors on unauthorized calls.
    if (matchesPath(request.nextUrl.pathname, '/api')) {
      trackAuthRedirect('login_required')
      return applySecurityHeaders(
        NextResponse.json(
          {
            ok: false,
            error: 'Unauthorized',
            code: 'AUTH_REQUIRED',
          },
          { status: 401 }
        )
      )
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

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
