import 'server-only';

import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FreeDiagnosticClaimResult =
  | { ok: true; claimId: string; ipHash: string | null }
  | { ok: false; status: number; code: string; message: string };

const DUPLICATE_EMAIL_CONSTRAINTS = [
  'free_diagnostic_claims_user_id_key',
  'free_diagnostic_claims_normalized_email_key',
];
const DUPLICATE_IP_CONSTRAINTS = ['free_diagnostic_claims_ip_hash_key'];

export function normalizeFreeDiagnosticEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  const ip = firstForwarded || req.headers.get('x-real-ip')?.trim() || req.headers.get('cf-connecting-ip')?.trim();
  return ip || null;
}

export function hashClientIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret =
    process.env.FREE_DIAGNOSTIC_IP_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRON_SECRET ||
    'revisiongrade-local-free-diagnostic-salt';

  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

function getConstraintName(error: unknown): string {
  const record = error as { code?: unknown; message?: unknown; details?: unknown; constraint?: unknown } | null;
  return [record?.constraint, record?.message, record?.details]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505';
}

function isDuplicateEmailOrUserClaim(error: unknown): boolean {
  const constraintText = getConstraintName(error);
  return isUniqueViolation(error) && DUPLICATE_EMAIL_CONSTRAINTS.some((name) => constraintText.includes(name));
}

function isDuplicateIpClaim(error: unknown): boolean {
  const constraintText = getConstraintName(error);
  return isUniqueViolation(error) && DUPLICATE_IP_CONSTRAINTS.some((name) => constraintText.includes(name));
}

export async function claimFreeDiagnostic(args: {
  supabase: SupabaseClient;
  req: Request;
  userId: string;
  email: string | null | undefined;
  manuscriptId: number | string;
}): Promise<FreeDiagnosticClaimResult> {
  const normalizedEmail = normalizeFreeDiagnosticEmail(args.email);
  if (!normalizedEmail) {
    return {
      ok: false,
      status: 403,
      code: 'FREE_DIAGNOSTIC_EMAIL_REQUIRED',
      message: 'A verified email address is required to use the free diagnostic.',
    };
  }

  const ipHash = hashClientIp(getClientIp(args.req));
  const { data, error } = await args.supabase
    .from('free_diagnostic_claims')
    .insert({
      user_id: args.userId,
      normalized_email: normalizedEmail,
      ip_hash: ipHash,
      manuscript_id: String(args.manuscriptId),
    })
    .select('id')
    .single();

  if (!error && data?.id) {
    return { ok: true, claimId: String(data.id), ipHash };
  }

  if (isDuplicateEmailOrUserClaim(error)) {
    return {
      ok: false,
      status: 409,
      code: 'FREE_DIAGNOSTIC_ALREADY_USED',
      message: 'This account or email has already used the free diagnostic. Please choose a paid evaluation to continue.',
    };
  }

  if (isDuplicateIpClaim(error)) {
    return {
      ok: false,
      status: 409,
      code: 'FREE_DIAGNOSTIC_NETWORK_ALREADY_USED',
      message: 'This network has already used the free diagnostic. Please sign in with the original account or choose a paid evaluation.',
    };
  }

  return {
    ok: false,
    status: 503,
    code: 'FREE_DIAGNOSTIC_CLAIM_FAILED',
    message: 'Unable to verify free diagnostic eligibility. Please try again shortly.',
  };
}

export async function attachFreeDiagnosticJob(args: {
  supabase: SupabaseClient;
  claimId: string | null;
  jobId: string;
}): Promise<void> {
  if (!args.claimId) return;
  await args.supabase
    .from('free_diagnostic_claims')
    .update({ job_id: args.jobId })
    .eq('id', args.claimId);
}
