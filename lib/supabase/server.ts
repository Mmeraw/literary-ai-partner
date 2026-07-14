// lib/supabase/server.ts
// Server-side Supabase client for server components and API routes

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}


/**
 * Get the authenticated user from Supabase session cookies.
 * For use in API routes to validate authenticated requests.
 * Returns null if no valid session exists.
 */
export async function getAuthenticatedUser() {
  try {
    // Dev/test mode: allow the middleware bypass header to provide the user id
    // so service/API scripts can run end-to-end without a real Supabase session.
    if (
      process.env.ALLOW_HEADER_USER_ID === 'true' &&
      process.env.TEST_MODE === 'true'
    ) {
      try {
        const headerStore = await headers();
        const userId = headerStore.get('x-user-id')?.trim();
        if (userId) {
          return { id: userId, email: headerStore.get('x-user-email') || null } as any;
        }
      } catch {
        // not inside a request context (e.g. a script) — fall through to cookie auth
      }
    }

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  } catch (err) {
    console.error('[getAuthenticatedUser] Error:', err);
    return null;
  }
}