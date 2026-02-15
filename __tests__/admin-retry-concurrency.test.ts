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
 * 
 * Uses pg (node-postgres) for DB-native testing (no Supabase client type cache)
 */

import { Pool } from "pg";

const PG_URL =
  process.env.PG_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const pool = new Pool({ connectionString: PG_URL });

const describeOrSkip = process.env.LOCAL_DB ? describe : describe.skip;

describeOrSkip("A5: Admin retry atomicity + concurrency", () => {
  let testJobId: string;

  beforeEach(async () => {
    // Create a failed job for testing (minimal columns)
    const result = await pool.query(
      `INSERT INTO evaluation_jobs 
       (manuscript_id, job_type, phase, status, next_attempt_at, policy_family, voice_preservation_level, english_variant)
       VALUES (1, 'full_evaluation', 'phase_2', 'failed', now(), 'standard', 'balanced', 'us')
       RETURNING id`
    );
    testJobId = result.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test job
    if (testJobId) {
      await pool.query("DELETE FROM evaluation_jobs WHERE id = $1", [testJobId]);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  test("parallel retry on same failed job → exactly one winner", async () => {
    // Fire two concurrent retries via RPC
    const [result1, result2] = await Promise.all([
      pool.query("SELECT * FROM admin_retry_job($1)", [testJobId]),
      pool.query("SELECT * FROM admin_retry_job($1)", [testJobId]),
    ]);

    const data1 = result1.rows[0];
    const data2 = result2.rows[0];

    expect(data1).toBeDefined();
    expect(data2).toBeDefined();

    // Exactly one should have changed=true
    const winners = [data1, data2].filter((d) => d?.changed === true);
    expect(winners.length).toBe(1);

    const winner = winners[0];
    expect(winner?.status).toBe("queued");

    // Verify final DB state
    const finalJob = await pool.query(
      "SELECT status, worker_id, lease_until, failed_at FROM evaluation_jobs WHERE id = $1",
      [testJobId]
    );

    expect(finalJob.rows[0]?.status).toBe("queued");
    expect(finalJob.rows[0]?.worker_id).toBeNull();
    expect(finalJob.rows[0]?.lease_until).toBeNull();
    expect(finalJob.rows[0]?.failed_at).toBeNull();
  });

  test("active lease blocks retry", async () => {
    // Set an active lease
    const future = new Date(Date.now() + 60_000).toISOString();
    await pool.query(
      "UPDATE evaluation_jobs SET worker_id = $1, lease_until = $2 WHERE id = $3",
      ["test-worker-123", future, testJobId]
    );

    // Attempt retry
    const result = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    const data = result.rows[0];

    expect(data?.changed).toBe(false);

    // Status should still be 'failed'
    const job = await pool.query(
      "SELECT status FROM evaluation_jobs WHERE id = $1",
      [testJobId]
    );
    expect(job.rows[0]?.status).toBe("failed");
  });

  test("expired lease allows retry", async () => {
    // Set an expired lease
    const past = new Date(Date.now() - 60_000).toISOString();
    await pool.query(
      "UPDATE evaluation_jobs SET worker_id = $1, lease_until = $2 WHERE id = $3",
      ["test-worker-456", past, testJobId]
    );

    // Attempt retry
    const result = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    const data = result.rows[0];

    expect(data?.changed).toBe(true);
    expect(data?.status).toBe("queued");

    // Verify lease cleared
    const job = await pool.query(
      "SELECT status, worker_id, lease_until FROM evaluation_jobs WHERE id = $1",
      [testJobId]
    );

    expect(job.rows[0]?.status).toBe("queued");
    expect(job.rows[0]?.worker_id).toBeNull();
    expect(job.rows[0]?.lease_until).toBeNull();
  });

  test("dead-lettered job can be retried (atomic + idempotent)", async () => {
    // Set job to dead_lettered
    await pool.query("UPDATE evaluation_jobs SET status = $1 WHERE id = $2", [
      "dead_lettered",
      testJobId,
    ]);

    // Attempt retry (should succeed - dead_lettered is retryable)
    const result = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    const data = result.rows[0];

    expect(data?.changed).toBe(true);
    expect(data?.status).toBe("queued");

    // Verify final DB state
    const job = await pool.query(
      "SELECT status, worker_id, lease_until FROM evaluation_jobs WHERE id = $1",
      [testJobId]
    );

    expect(job.rows[0]?.status).toBe("queued");
    expect(job.rows[0]?.worker_id).toBeNull();
    expect(job.rows[0]?.lease_until).toBeNull();
  });

  test("completed job cannot be retried", async () => {
    // Set job to complete
    await pool.query(
      "UPDATE evaluation_jobs SET status = $1, failed_at = NULL WHERE id = $2",
      ["complete", testJobId]
    );

    // Attempt retry
    const result = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    const data = result.rows[0];

    expect(data?.changed).toBe(false);

    // Status should still be 'complete'
    const job = await pool.query(
      "SELECT status FROM evaluation_jobs WHERE id = $1",
      [testJobId]
    );
    expect(job.rows[0]?.status).toBe("complete");
  });

  test("retry is idempotent (no-op on already queued)", async () => {
    // First retry (should succeed)
    const result1 = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    expect(result1.rows[0]?.changed).toBe(true);

    // Second retry (should be no-op)
    const result2 = await pool.query("SELECT * FROM admin_retry_job($1)", [
      testJobId,
    ]);
    expect(result2.rows[0]?.changed).toBe(false);
    expect(result2.rows[0]?.status).toBe("queued");
  });
});
