/**
 * Phase 2D-3 Reconciler Proof
 *
 * Proves:
 * - Expired leases can be reclaimed by new workers
 * - Heartbeat renewal extends lease for same token
 * - Heartbeat with different token does not steal lease
 * - reconcileExpiredLeases() resets stale running jobs
 *
 * Run: npx jest phase2d3-reconciler-proof.test.ts
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createTestManuscript } from "./tests/test-helpers/manuscript-factory";
import { claimNextJob, renewLease, reconcileExpiredLeases } from "./workers/claimJob";
import { randomUUID } from "crypto";

const supabase = getSupabaseAdminClient();
const hasSupabase = !!supabase;

const run = (hasSupabase && process.env.TEST_MODE !== 'true') ? describe : describe.skip;

run("Phase 2D-3 Reconciler", () => {
  // Clean up any stale test jobs before each test
  beforeEach(async () => {
    if (!supabase) return;
    
    // 1) Find any prior test manuscripts
    const { data: ms } = await supabase
      .from("manuscripts")
      .select("id")
      .like("title", "phase2d3:%");

    const ids = (ms || []).map(m => m.id);

    // 2) Delete dependent eval jobs first (FK-safe)
    if (ids.length) {
      await supabase.from("evaluation_jobs").delete().in("manuscript_id", ids);
    }

    // 3) Delete the manuscripts
    await supabase.from("manuscripts").delete().like("title", "phase2d3:%");
    
    // 4) Delete any orphaned jobs with test worker IDs
    await supabase
      .from("evaluation_jobs")
      .delete()
      .in("worker_id", ["old-worker", "new-worker", "worker-A", "worker-B", "expired-worker-1", "expired-worker-2", "active-worker"]);
  });

  it("allows reclaim of expired lease", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      // Use default factory title (phase2d3:UUID) for proper cleanup
      manuscriptId = await createTestManuscript({});

      const testToken = randomUUID();

      // Create job with expired lease (already in running state)
      const { data: job, error: jobError } = await admin
        .from("evaluation_jobs")
        .insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "running",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
          worker_id: "old-worker",
          lease_token: testToken,
          lease_until: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
          heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to insert test job: ${jobError?.message || "unknown"}`);
      }

      jobId = job.id;

      // Reconciler should detect the expired lease and reset to queued
      const reclaimed = await reconcileExpiredLeases(50);
      expect(reclaimed).toBeGreaterThanOrEqual(1); // At least our test job

      // Now new worker should be able to claim this job
      const claim = await claimNextJob("new-worker");

      expect(claim).toBeTruthy();
      expect(claim?.id).toBe(jobId);

      // Verify lease was refreshed
      const { data: row, error: rowError } = await admin
        .from("evaluation_jobs")
        .select("status, worker_id, lease_token, lease_until, heartbeat_at")
        .eq("id", jobId)
        .single();

      expect(rowError).toBeNull();
      expect(row!.status).toBe("running");
      expect(row!.worker_id).toBe("new-worker");
      expect(row!.lease_token).not.toBe(testToken); // Token rotated
      expect(row!.lease_token).toBeTruthy();

      // Lease should be in the future now
      const leaseUntil = new Date(row!.lease_until);
      const now = new Date();
      expect(leaseUntil.getTime()).toBeGreaterThan(now.getTime());
    } finally {
      if (jobId) {
        await admin.from("evaluation_jobs").delete().eq("id", jobId);
      }
      if (manuscriptId) {
        await admin.from("manuscripts").delete().eq("id", manuscriptId);
      }
    }
  });

  it("renewLease with correct token extends lease", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await createTestManuscript({ title: "Phase2D Renewal" });

      const testToken = randomUUID();

      // Create job directly in running state with active lease
      const { data: job, error: jobError } = await admin
        .from("evaluation_jobs")
        .insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "running",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
          worker_id: "worker-A",
          lease_token: testToken,
          lease_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
          heartbeat_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error(`Failed to insert test job: ${jobError?.message || "unknown"}`);
      }

      jobId = job.id;

      // Get initial state
      const { data: initial } = await admin
        .from("evaluation_jobs")
        .select("id, status, worker_id, lease_token, lease_until, heartbeat_at")
        .eq("id", jobId)
        .single();

      expect(initial!.lease_token).toBe(testToken);
      const originalLeaseUntil = new Date(initial!.lease_until).getTime();

      // Ground truth check before renewal
      console.log("Before renewal (DB ground truth):", {
        id: initial!.id,
        status: initial!.status,
        worker_id: initial!.worker_id,
        lease_token: initial!.lease_token,
        testToken: testToken,
        tokensMatch: initial!.lease_token === testToken
      });

      // Wait a bit to ensure time passes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Renew with correct token
      const renewal = await renewLease(jobId, "worker-A", testToken);

      console.log("Renewal result:", renewal);

      expect(renewal.success).toBe(true);
      expect(renewal.leaseUntil).toBeTruthy();
      expect(renewal.heartbeatAt).toBeTruthy();

      // Verify lease extended
      const { data: renewed } = await admin
        .from("evaluation_jobs")
        .select("lease_token, lease_until, heartbeat_at")
        .eq("id", jobId)
        .single();

      // Token should NOT change on renewal
      expect(renewed!.lease_token).toBe(testToken);

      // Lease should be extended
      const newLeaseUntil = new Date(renewed!.lease_until).getTime();
      expect(newLeaseUntil).toBeGreaterThan(originalLeaseUntil);

      // Heartbeat should be updated
      expect(renewed!.heartbeat_at).toBeTruthy();
      const heartbeatTime = new Date(renewed!.heartbeat_at).getTime();
      expect(heartbeatTime).toBeGreaterThan(new Date(initial!.heartbeat_at).getTime());
    } finally {
      if (jobId) await admin.from("evaluation_jobs").delete().eq("id", jobId);
      if (manuscriptId) await admin.from("manuscripts").delete().eq("id", manuscriptId);
    }
  });

  it("renewLease with wrong token fails", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await createTestManuscript({ title: "Phase2D Wrong Token" });

      const { data: job } = await admin
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

      jobId = job!.id;

      // Worker A claims
      const claim = await claimNextJob("worker-A");
      expect(claim).toBeTruthy();

      const { data: initial } = await admin
        .from("evaluation_jobs")
        .select("lease_token, lease_until")
        .eq("id", jobId)
        .single();

      const originalToken = initial!.lease_token;
      const originalLeaseUntil = initial!.lease_until;

      // Try to renew with WRONG token
      const fakeToken = randomUUID();
      const renewal = await renewLease(jobId, "worker-A", fakeToken);

      expect(renewal.success).toBe(false);

      // Verify lease unchanged
      const { data: after } = await admin
        .from("evaluation_jobs")
        .select("lease_token, lease_until")
        .eq("id", jobId)
        .single();

      expect(after!.lease_token).toBe(originalToken);
      expect(after!.lease_until).toBe(originalLeaseUntil);
    } finally {
      if (jobId) await admin.from("evaluation_jobs").delete().eq("id", jobId);
      if (manuscriptId) await admin.from("manuscripts").delete().eq("id", manuscriptId);
    }
  });

  it("reconcileExpiredLeases resets stale running jobs", async () => {
    const admin = supabase!;

    let jobIds: string[] = [];
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await createTestManuscript({ title: "Phase2D Reconciler Sweep" });

      // Create 3 jobs: 2 expired, 1 active
      const jobs = await Promise.all([
        admin.from("evaluation_jobs").insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "running",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
          worker_id: "expired-worker-1",
          lease_token: randomUUID(),
          lease_until: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Expired
          heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }).select().single(),
        admin.from("evaluation_jobs").insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "running",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
          worker_id: "expired-worker-2",
          lease_token: randomUUID(),
          lease_until: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Expired
          heartbeat_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        }).select().single(),
        admin.from("evaluation_jobs").insert({
          manuscript_id: manuscriptId,
          job_type: "full_evaluation",
          status: "running",
          phase: "phase_2",
          work_type: "full_evaluation",
          policy_family: "standard",
          voice_preservation_level: "balanced",
          english_variant: "us",
          worker_id: "active-worker",
          lease_token: randomUUID(),
          lease_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Active
          heartbeat_at: new Date().toISOString(),
        }).select().single(),
      ]);

      // Guard against null/error responses
      for (let i = 0; i < jobs.length; i++) {
        if (jobs[i].error || !jobs[i].data) {
          throw new Error(`Job ${i} insert failed: ${jobs[i].error?.message || 'unknown'}`);
        }
      }

      jobIds = jobs.map((r) => r.data!.id);

      // Run reconciler
      const reclaimed = await reconcileExpiredLeases(50);
      expect(reclaimed).toBe(2); // Only 2 expired leases

      // Verify expired jobs were reset to queued
      const { data: rows, error: rowsError } = await admin
        .from("evaluation_jobs")
        .select("id, status, worker_id, lease_token, lease_until")
        .in("id", jobIds);

      expect(rowsError).toBeNull();
      expect(rows).toHaveLength(3);

      // Map by ID for deterministic assertions
      const byId = new Map(rows!.map(r => [r.id, r]));

      // First two (expired) should be queued now
      expect(byId.get(jobIds[0])!.status).toBe("queued");
      expect(byId.get(jobIds[0])!.worker_id).toBeNull();
      expect(byId.get(jobIds[0])!.lease_token).toBeNull();

      expect(byId.get(jobIds[1])!.status).toBe("queued");
      expect(byId.get(jobIds[1])!.worker_id).toBeNull();
      expect(byId.get(jobIds[1])!.lease_token).toBeNull();

      // Last one (active) should be unchanged
      expect(byId.get(jobIds[2])!.status).toBe("running");
      expect(byId.get(jobIds[2])!.worker_id).toBe("active-worker");
      expect(byId.get(jobIds[2])!.lease_token).toBeTruthy(); // Still has token
    } finally {
      for (const id of jobIds) {
        await admin.from("evaluation_jobs").delete().eq("id", id);
      }
      if (manuscriptId) {
        await admin.from("manuscripts").delete().eq("id", manuscriptId);
      }
    }
  });
});
