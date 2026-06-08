import type { User } from "@supabase/supabase-js";

/**
 * Returns true when the authenticated user is permitted to view operational
 * evaluation details (raw errors, Phase 0 telemetry, heartbeat/retry fields,
 * pipeline stage internals, failure codes).
 *
 * Gate logic:
 *  1. User email MUST be in EVALUATION_OPERATOR_EMAILS environment variable
 *     (comma-separated list, case-insensitive)
 *
 * NEVER hard-code email addresses in source. Use the environment variable.
 */
export function canViewEvaluationOperationalDetails(
  user: User | null | undefined,
): boolean {
  if (!user) return false;

  const email = user.email?.trim().toLowerCase();
  if (!email) return false;

  const allowedEmails = (process.env.EVALUATION_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email);
}
