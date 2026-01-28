/**
 * Phase 2D-1 Atomic Claim Concurrency
 *
 * Proves:
 * - Two concurrent claims against one queued job
 * - Exactly one worker receives the job, the other gets null
 * - DB row shows single worker_id + lease_token + lease_until
 *
 * Run: npx jest phase2d1-atomic-claim-concurrency.test.ts
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createTestManuscript } from "./tests/test-helpers/manuscript-factory";
import { claimNextJob } from "./workers/claimJob";

const supabase = getSupabaseAdminClient();
const hasSupabase = !!supabase;

const run = hasSupabase ? describe : describe.skip;

run("Phase 2D-1 Atomic claim concurrency", () => {
  it("allows only one worker to claim a job", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
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
      expect(claims).toHaveLength(1);

      const expectedWorker = claimA?.id ? "worker-A" : "worker-B";

      const { data: row, error: rowError } = await admin
        .from("evaluation_jobs")
        .select("status, worker_id, lease_token, lease_until")
        .eq("id", jobId)
        .single();

      if (rowError || !row) {
        throw new Error(`Failed to read job after claim: ${rowError?.message || "unknown"}`);
      }

      expect(row.status).toBe("running");
      expect(row.worker_id).toBe(expectedWorker);
      expect(row.lease_token).toBeTruthy();
      expect(row.lease_until).toBeTruthy();
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
