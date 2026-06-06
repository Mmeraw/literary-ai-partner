import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { requireAdmin as requireAdminSession } from '@/lib/admin/requireAdmin';

export async function requireUser(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>> }
  | { ok: false; response: NextResponse }
> {
  const user = await getAuthenticatedUser();
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  return requireAdminSession(req);
}

export function requireWorkerSecret(req: Request | NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    return null;
  }

  const expectedWorkerSecret = process.env.WORKER_SECRET?.trim();
  if (!expectedWorkerSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unauthorized',
        code: 'WORKER_SECRET_REQUIRED',
      },
      { status: 401 },
    );
  }

  const presentedWorkerSecret = req.headers.get('x-worker-secret')?.trim() ?? '';
  if (presentedWorkerSecret !== expectedWorkerSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unauthorized',
        code: 'WORKER_SECRET_REQUIRED',
      },
      { status: 401 },
    );
  }

  return null;
}