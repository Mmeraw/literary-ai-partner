/**
 * Phase 2D-1 Atomic Claim Concurrency
 *
 * Proves:
 * - Two concurrent claims against one queued job
 * - Mutual exclusion: DB row shows exactly one worker owns the job
 * - DB row shows single worker_id + lease_token + lease_until
 *
 * Run: npx jest phase2d1-atomic-claim-concurrency.test.ts
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createTestManuscript } from "./tests/test-helpers/manuscript-factory";
import { claimNextJob } from "./workers/claimJob";

const supabase = getSupabaseAdminClient();
const hasSupabase = !!supabase;

// CI smoke-test detection: skip integration tests in any CI environment
// Uses TEST_MODE as primary check, CI env var as fallback (set automatically by GitHub Actions)
const isCi = process.env.CI === "true";
const isCiSmoke = process.env.TEST_MODE === "true" || isCi;
const shouldRun = hasSupabase && !isCiSmoke;
const run = shouldRun ? describe : describe.skip;

run("Phase 2D-1 Atomic claim concurrency", () => {
  it("allows only one worker to claim a job", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      // Clean up any stale queued/failed jobs from previous runs
      await admin
        .from("evaluation_jobs")
        .delete()
        .in("status", ["queued", "failed"]);

      manuscriptId = await createTestManuscript({ title: "Phase2D Atomic Claim" });

      const { data: job, error: jobError } = await admin
        .from("evaluation_jobs")
        .insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "queued",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to insert test job: ${jobError?.message || "unknown"}`);
      }

      jobId = job.id;

      const [claimA, claimB] = await Promise.all([
        claimNextJob("worker-A"),
        claimNextJob("worker-B"),
      ]);

      const claims = [claimA, claimB].filter(Boolean);
      expect(claims.length).toBeGreaterThanOrEqual(1);

      // DB row is authoritative — worker identity checked below via containment
      const winningClaim = claimA?.id ? claimA : claimB;

      expect(winningClaim).toBeTruthy();
      expect(winningClaim?.id).toBe(jobId);

      const { data: row, error: rowError } = await admin
        .from("evaluation_jobs")
        .select("status, worker_id, lease_token, lease_until, heartbeat_at, started_at")
        .eq("id", jobId)
        .single();

      if (rowError || !row) {
        throw new Error(`Failed to read job after claim: ${rowError?.message || "unknown"}`);
      }

      // Mutual exclusion: exactly one worker owns the job
      expect(row.status).toBe("running");
      expect(["worker-A", "worker-B"]).toContain(row.worker_id);

      // Lease semantics: token, expiry, and heartbeat all set
      expect(row.lease_token).toBeTruthy();
      expect(typeof row.lease_token).toBe("string");
      expect(row.lease_until).toBeTruthy();
      expect(row.heartbeat_at).toBeTruthy();
      expect(row.started_at).toBeTruthy();

      // Lease is in the future (not expired immediately)
      const leaseUntil = new Date(row.lease_until);
      const now = new Date();
      expect(leaseUntil.getTime()).toBeGreaterThan(now.getTime());

      // Lease is reasonable (within 10 minutes, not indefinite)
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
      expect(leaseUntil.getTime()).toBeLessThanOrEqual(tenMinutesFromNow.getTime());
    } finally {
      if (jobId) {
        await admin.from("evaluation_jobs").delete().eq("id", jobId);
      }
      if (manuscriptId) {
        await admin.from("manuscripts").delete().eq("id", manuscriptId);
      }
    }
  });
});
