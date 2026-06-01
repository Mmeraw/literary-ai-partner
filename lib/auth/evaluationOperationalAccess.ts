import type { User } from "@supabase/supabase-js";

/**
 * Returns true when the authenticated user is permitted to view operational
 * evaluation details (raw errors, Phase 0 telemetry, heartbeat/retry fields,
 * pipeline stage internals, failure codes).
 *
 * Gate logic (OR):
 *  1. User role is "admin" or "superadmin" (app_metadata.role)
 *  2. User email is in the EVALUATION_OPERATOR_EMAILS environment variable
 *     (comma-separated list, case-insensitive)
 *
 * NEVER hard-code email addresses in source. Use the environment variable.
 */
export function canViewEvaluationOperationalDetails(
  user: User | null | undefined,
): boolean {
  if (!user) return false;

  const role = (user.app_metadata as Record<string, unknown> | undefined)
    ?.role as string | undefined;
  if (role === "admin" || role === "superadmin") return true;

  const email = user.email?.trim().toLowerCase();
  if (!email) return false;

  const allowedEmails = (process.env.EVALUATION_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return allowedEmails.includes(email);
}
