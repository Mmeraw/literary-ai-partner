/**
 * A5: Admin retry concurrency test
 * 
 * PROOF: Two parallel retries → exactly one winner (changed:true)
 * 
 * Scenarios:
 * 1. Parallel retry on same failed job → one succeeds, one no-op
 * 2. Active lease blocks retry
 * 3. Expired lease allows retry (if retryable state)
 * 4. Dead-lettered job can be retried (atomic + idempotent)
 * 5. Completed job cannot be retried
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe("A5: Admin retry atomicity + concurrency", () => {
  let testJobId: string;

  beforeEach(async () => {
    // Create a failed job for testing  
    const { data, error } = await supabase
      .from("evaluation_jobs")
      .insert({
        phase: "phase_2",
        status: "failed",
        next_attempt_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test job: ${error?.message}`);
    }

    testJobId = data.id;
  });

  afterEach(async () => {
    // Clean up test job
    if (testJobId) {
      await supabase.from("evaluation_jobs").delete().eq("id", testJobId);
    }
  });

  test("parallel retry on same failed job → exactly one winner", async () => {
    // Fire two concurrent retries
    const [result1, result2] = await Promise.all([
      supabase.rpc("admin_retry_job", { p_job_id: testJobId }),
      supabase.rpc("admin_retry_job", { p_job_id: testJobId }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();

    const data1 = result1.data?.[0];
    const data2 = result2.data?.[0];

    expect(data1).toBeDefined();
    expect(data2).toBeDefined();

    // Exactly one should have changed=true
    const winners = [data1, data2].filter((d) => d?.changed === true);
    expect(winners.length).toBe(1);

    const winner = winners[0];
    expect(winner?.status).toBe("queued");

    // Verify final DB state
    const { data: finalJob } = await supabase
      .from("evaluation_jobs")
      .select("status, worker_id, lease_until, failed_at")
      .eq("id", testJobId)
      .single();

    expect(finalJob?.status).toBe("queued");
    expect(finalJob?.worker_id).toBeNull();
    expect(finalJob?.lease_until).toBeNull();
    expect(finalJob?.failed_at).toBeNull();
  });

  test("active lease blocks retry", async () => {
    // Set an active lease
    const future = new Date(Date.now() + 60_000).toISOString();
    await supabase
      .from("evaluation_jobs")
      .update({
        worker_id: "test-worker-123",
        lease_until: future,
      })
      .eq("id", testJobId);

    // Attempt retry
    const { data, error } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });

    expect(error).toBeNull();
    expect(data?.[0]?.changed).toBe(false);

    // Status should still be 'failed'
    const { data: job } = await supabase
      .from("evaluation_jobs")
      .select("status")
      .eq("id", testJobId)
      .single();

    expect(job?.status).toBe("failed");
  });

  test("expired lease allows retry", async () => {
    // Set an expired lease
    const past = new Date(Date.now() - 60_000).toISOString();
    await supabase
      .from("evaluation_jobs")
      .update({
        worker_id: "test-worker-456",
        lease_until: past,
      })
      .eq("id", testJobId);

    // Attempt retry
    const { data, error } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });

    expect(error).toBeNull();
    expect(data?.[0]?.changed).toBe(true);
    expect(data?.[0]?.status).toBe("queued");

    // Verify lease cleared
    const { data: job } = await supabase
      .from("evaluation_jobs")
      .select("status, worker_id, lease_until")
      .eq("id", testJobId)
      .single();

    expect(job?.status).toBe("queued");
    expect(job?.worker_id).toBeNull();
    expect(job?.lease_until).toBeNull();
  });

  test("dead-lettered job can be retried (atomic + idempotent)", async () => {
    // Set job to dead_lettered
    await supabase
      .from("evaluation_jobs")
      .update({ status: "dead_lettered" })
      .eq("id", testJobId);

    // Attempt retry (should succeed - dead_lettered is retryable)
    const { data, error } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });

    expect(error).toBeNull();
    expect(data?.[0]?.changed).toBe(true);
    expect(data?.[0]?.status).toBe("queued");

    // Verify final DB state
    const { data: job } = await supabase
      .from("evaluation_jobs")
      .select("status, worker_id, lease_until")
      .eq("id", testJobId)
      .single();

    expect(job?.status).toBe("queued");
    expect(job?.worker_id).toBeNull();
    expect(job?.lease_until).toBeNull();
  });

  test("completed job cannot be retried", async () => {
    // Set job to complete
    await supabase
      .from("evaluation_jobs")
      .update({
        status: "complete",
        failed_at: null,
      })
      .eq("id", testJobId);

    // Attempt retry
    const { data, error } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });

    expect(error).toBeNull();
    expect(data?.[0]?.changed).toBe(false);

    // Status should still be 'complete'
    const { data: job } = await supabase
      .from("evaluation_jobs")
      .select("status")
      .eq("id", testJobId)
      .single();

    expect(job?.status).toBe("complete");
  });

  test("retry is idempotent (no-op on already queued)", async () => {
    // First retry (should succeed)
    const { data: result1 } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });
    expect(result1?.[0]?.changed).toBe(true);

    // Second retry (should be no-op)
    const { data: result2 } = await supabase.rpc("admin_retry_job", {
      p_job_id: testJobId,
    });
    expect(result2?.[0]?.changed).toBe(false);
    expect(result2?.[0]?.status).toBe("queued");
  });
});
