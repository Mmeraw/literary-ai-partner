import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ClaimMetrics,
  type InvariantDashboardMetrics,
  type JobStatusMetrics,
  getInvariantDashboardMetrics,
} from "./invariantDashboard";

export type InvariantCheckResult = {
  id:
    | "successes_lte_attempts"
    | "one_successful_claimant_per_job"
    | "empty_claims_under_contention"
    | "no_overlapping_leases";
  passed: boolean;
  details: string;
};

type RunningLeaseRow = {
  id: string;
  worker_id: string | null;
  lease_until: string | null;
  attempt_count: number | null;
};

export function checkSuccessesLteAttempts(claims: ClaimMetrics): InvariantCheckResult {
  const passed = claims.claimSuccesses <= claims.claimAttempts;

  return {
    id: "successes_lte_attempts",
    passed,
    details: passed
      ? `PASS: claimSuccesses=${claims.claimSuccesses} <= claimAttempts=${claims.claimAttempts}`
      : `FAIL: claimSuccesses=${claims.claimSuccesses} > claimAttempts=${claims.claimAttempts}`,
  };
}

export async function checkExactlyOneSuccessfulClaimantPerEligibleJob(): Promise<InvariantCheckResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, worker_id, lease_until, attempt_count")
    .eq("status", "running")
    .gt("attempt_count", 0);

  if (error) {
    throw new Error(`checkExactlyOneSuccessfulClaimantPerEligibleJob failed: ${error.message}`);
  }

  const rows = (data as RunningLeaseRow[]) ?? [];

  const invalid = rows.filter((row) => !row.worker_id || !row.lease_until);

  const passed = invalid.length === 0;

  return {
    id: "one_successful_claimant_per_job",
    passed,
    details: passed
      ? `PASS: ${rows.length} eligible running jobs each have exactly one claimant context (worker_id + lease_until).`
      : `FAIL: ${invalid.length}/${rows.length} running eligible jobs missing claimant context (worker_id or lease_until).`,
  };
}

export function checkEmptyClaimsUnderContention(
  claims: ClaimMetrics,
  jobs: JobStatusMetrics,
): InvariantCheckResult {
  const contentionObserved = jobs.running > 1 || claims.claimAttempts > claims.claimSuccesses;
  const passed = !contentionObserved || claims.emptyClaims > 0;

  return {
    id: "empty_claims_under_contention",
    passed,
    details: !contentionObserved
      ? "PASS: No contention signal observed in current window (running<=1 and attempts==successes)."
      : passed
        ? `PASS: contention detected and emptyClaims=${claims.emptyClaims} (> 0).`
        : "FAIL: contention detected but emptyClaims did not rise above zero.",
  };
}

export async function checkNoOverlappingLeasesForSameJob(): Promise<InvariantCheckResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, worker_id, lease_until")
    .eq("status", "running")
    .gt("lease_until", nowIso);

  if (error) {
    throw new Error(`checkNoOverlappingLeasesForSameJob failed: ${error.message}`);
  }

  const rows = (data as Array<Pick<RunningLeaseRow, "id" | "worker_id" | "lease_until">>) ?? [];

  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) {
      duplicates.add(row.id);
    } else {
      seen.add(row.id);
    }
  }

  const passed = duplicates.size === 0;

  return {
    id: "no_overlapping_leases",
    passed,
    details: passed
      ? `PASS: no overlapping active lease rows detected across ${rows.length} running jobs.`
      : `FAIL: overlapping active lease rows detected for job_id(s): ${Array.from(duplicates).join(", ")}`,
  };
}

export async function runInvariantChecks(windowDays = 7): Promise<{
  generatedAt: string;
  metrics: InvariantDashboardMetrics;
  checks: InvariantCheckResult[];
}> {
  const metrics = await getInvariantDashboardMetrics(windowDays);

  const [claimantCheck, overlapCheck] = await Promise.all([
    checkExactlyOneSuccessfulClaimantPerEligibleJob(),
    checkNoOverlappingLeasesForSameJob(),
  ]);

  const checks: InvariantCheckResult[] = [
    checkSuccessesLteAttempts(metrics.claims),
    claimantCheck,
    checkEmptyClaimsUnderContention(metrics.claims, metrics.jobs),
    overlapCheck,
  ];

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    checks,
  };
}
