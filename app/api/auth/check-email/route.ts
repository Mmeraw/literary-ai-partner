import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enforceApiRateLimit } from '@/lib/security/apiRateLimit';
import { normalizeFreeDiagnosticEmail } from '@/lib/freeDiagnostic/claims';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rateLimitDenied = enforceApiRateLimit(req, {
    bucket: 'auth_check_email',
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitDenied) return rateLimitDenied;

  let email: string | null = null;
  try {
    const body = await req.json();
    email = normalizeFreeDiagnosticEmail(typeof body?.email === 'string' ? body.email : null);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ ok: false, error: 'Valid email is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      return NextResponse.json({ ok: false, error: 'Unable to check account status' }, { status: 503 });
    }

    const exists = (data.users ?? []).some((user) => user.email?.trim().toLowerCase() === email);
    return NextResponse.json({ ok: true, exists }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to check account status' }, { status: 503 });
  }
}
