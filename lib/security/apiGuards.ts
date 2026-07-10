import 'server-only';

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { requireAdmin as requireAdminSession } from '@/lib/admin/requireAdmin';
import { getDevHeaderActor } from '@/lib/auth/devHeaderActor';

type RequiredUser = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>> | { id: string };

export async function requireUser(req?: Request): Promise<
  | { ok: true; user: RequiredUser }
  | { ok: false; response: NextResponse }
> {
  const devActor = req ? getDevHeaderActor(req) : null;
  if (devActor?.userId) {
    return { ok: true, user: { id: devActor.userId } };
  }

  const user = await getAuthenticatedUser();
  if (user?.id) {
    return { ok: true, user };
  }

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

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  return requireAdminSession(req);
}

function timingSafeSecretEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function extractBearer(authHeader: string | null): string | null {
  const match = authHeader?.trim().match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isVercelCronInvocation(req: Request | NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' &&
    Boolean(req.headers.get('x-vercel-id')) &&
    (process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV))
  );
}

export function requireWorkerSecret(req: Request | NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
    return null;
  }

  // Vercel Cron cannot send custom x-worker-secret headers. Internal worker
  // dispatches use Authorization: Bearer $CRON_SECRET. Let those canonical
  // route-local auth paths through instead of blocking before route auth runs.
  if (isVercelCronInvocation(req)) {
    return null;
  }

  const expectedCronSecret = process.env.CRON_SECRET?.trim();
  const bearer = extractBearer(req.headers.get('authorization'));
  if (expectedCronSecret && bearer && timingSafeSecretEqual(bearer, expectedCronSecret)) {
    return null;
  }

  const expectedWorkerSecret = process.env.WORKER_SECRET?.trim();
  if (!expectedWorkerSecret) {
    return null;
  }

  const presentedWorkerSecret = req.headers.get('x-worker-secret')?.trim() ?? '';
  if (!timingSafeSecretEqual(presentedWorkerSecret, expectedWorkerSecret)) {
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