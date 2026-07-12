/**
 * Operator-nominated proof identity for C2 live-proof job creation.
 *
 * PROBLEM THIS SOLVES (root cause, grounded in a real live artifact):
 *   POST /api/jobs requires an authenticated author identity. The C2 proof
 *   harness authenticates with `Authorization: Bearer <CRON_SECRET>` (a worker
 *   credential), which clears middleware gating but carries no author identity.
 *   In production `ALLOW_HEADER_USER_ID` is (correctly) off, so `x-user-id` is
 *   ignored and the route returns 401 AUTH_REQUIRED. The `evaluation_job_identity`
 *   C2 boundary therefore fails before any evaluation runs.
 *
 * DESIGN (operator-nominated, NOT discovery-based — per operator direction):
 *   The operator EXPLICITLY nominates a real, existing author who owns the target
 *   manuscript. We never auto-derive the owner: the caller must assert
 *   `x-proof-user-id`, and we verify (read-only) that this user actually owns the
 *   requested manuscript. This keeps the run auditable and intentional:
 *   "create this evaluation as this real author who owns manuscript N",
 *   not "let the harness discover someone to impersonate".
 *
 * SAFETY CONTRACT (fail closed — returns null unless ALL hold):
 *   1. ALLOW_PROOF_JOB_IDENTITY === "true"        (off by default; explicit opt-in)
 *   2. Valid `Authorization: Bearer <CRON_SECRET>` (constant-time compare)
 *   3. `x-proof-user-id` header present and non-empty
 *   4. A numeric manuscript id is provided
 *   5. Read-only SELECT: manuscript exists AND manuscripts.user_id === x-proof-user-id
 *   6. If PROOF_JOB_ALLOWED_USER_IDS is set, the user id is in it
 *   7. If PROOF_JOB_ALLOWED_MANUSCRIPT_IDS is set, the manuscript id is in it
 *
 * It performs NO write, NO job creation, and NO OpenAI call. It never enables or
 * depends on ALLOW_HEADER_USER_ID. Any failure returns null so the caller falls
 * through to the existing 401 path.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface ProofJobIdentity {
  userId: string;
  source: "proof_job_identity";
}

export interface ResolveProofJobIdentityDeps {
  env?: NodeJS.ProcessEnv;
  // Injectable for tests; defaults to the real admin client factory.
  createAdmin?: typeof createAdminClient;
}

function timingSafeEqual(a: string, b: string): boolean {
  // Length-independent comparison without leaking length via early return.
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function parseBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : null;
}

function parseIdList(raw: string | undefined): string[] | null {
  if (!raw || raw.trim() === "") return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Resolve an operator-nominated proof identity for a job-creation request.
 * Returns a ProofJobIdentity ONLY when every safety condition holds; otherwise
 * returns null (caller falls through to normal auth / 401).
 *
 * `manuscriptId` is the manuscript the job will be created against (from the
 * request body). Ownership is verified against exactly this manuscript.
 */
export async function resolveProofJobIdentity(
  req: { headers: { get(name: string): string | null } },
  manuscriptId: string | number | null | undefined,
  deps: ResolveProofJobIdentityDeps = {}
): Promise<ProofJobIdentity | null> {
  const env = deps.env ?? process.env;
  const createAdmin = deps.createAdmin ?? createAdminClient;

  // 1. Explicit opt-in.
  if (env.ALLOW_PROOF_JOB_IDENTITY !== "true") return null;

  // 2. Valid worker bearer credential.
  const expected = env.CRON_SECRET;
  const presented = parseBearer(req.headers.get("authorization"));
  if (!expected || !presented || !timingSafeEqual(presented, expected)) return null;

  // 3. Explicit operator-nominated identity.
  const proofUserId = req.headers.get("x-proof-user-id")?.trim();
  if (!proofUserId) return null;

  // 4. Numeric manuscript id.
  if (manuscriptId == null || !/^\d+$/.test(String(manuscriptId))) return null;
  const numericManuscriptId = Number(manuscriptId);

  // 6/7. Allowlist checks (only enforced when configured).
  const allowedUsers = parseIdList(env.PROOF_JOB_ALLOWED_USER_IDS);
  if (allowedUsers && !allowedUsers.includes(proofUserId)) return null;
  const allowedManuscripts = parseIdList(env.PROOF_JOB_ALLOWED_MANUSCRIPT_IDS);
  if (allowedManuscripts && !allowedManuscripts.includes(String(numericManuscriptId))) return null;

  // 5. Read-only ownership verification. NO write, NO auto-derive: we verify the
  // asserted owner, we do not discover one.
  let admin;
  try {
    admin = createAdmin();
  } catch {
    return null;
  }
  if (!admin) return null;

  try {
    const { data, error } = await admin
      .from("manuscripts")
      .select("id, user_id")
      .eq("id", numericManuscriptId)
      .maybeSingle();
    if (error || !data) return null;
    if (String(data.user_id) !== proofUserId) return null;
  } catch {
    return null;
  }

  return { userId: proofUserId, source: "proof_job_identity" };
}
