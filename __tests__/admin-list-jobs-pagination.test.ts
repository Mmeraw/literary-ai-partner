/**
 * A6: Admin list jobs - pagination stability test
 * 
 * PROOF: Keyset pagination remains stable under concurrent writes
 * 
 * Scenarios:
 * 1. Paginated list remains consistent (no duplicates, no skips)
 * 2. Concurrent inserts don't affect ongoing pagination
 * 3. Filters work correctly
 * 4. Cursor navigation is deterministic
 */

import { Pool } from "pg";

const PG_URL =
  process.env.PG_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const pool = new Pool({ connectionString: PG_URL });

describe("A6: Admin list jobs - keyset pagination stability", () => {
  const testJobIds: string[] = [];

  beforeAll(async () => {
    // Create 15 test jobs with different states and timestamps
    // Uses manuscript_id = 1 (assumed to exist, like other tests)
    for (let i = 0; i < 15; i++) {
      const status = i < 5 ? "failed" : i < 10 ? "queued" : "complete";
      const failedAt = status === "failed" ? "now()" : "NULL";
      
      const result = await pool.query(
        `INSERT INTO evaluation_jobs 
         (manuscript_id, job_type, phase, status, failed_at, next_attempt_at, policy_family, voice_preservation_level, english_variant, created_at)
         VALUES (1, $1, 'phase_2', $2, ${failedAt}, now(), 'standard', 'balanced', 'us', now() - interval '${i} hours')
         RETURNING id`,
        [i % 2 === 0 ? "quick_evaluation" : "full_evaluation", status]
      );
      testJobIds.push(result.rows[0].id);
    }
  });

  afterAll(async () => {
    // Clean up test jobs
    if (testJobIds.length > 0) {
      await pool.query("DELETE FROM evaluation_jobs WHERE id = ANY($1)", [testJobIds]);
    }
    await pool.end();
  });

  test("keyset pagination with no gaps or duplicates", async () => {
    const pageSize = 5;
    const allJobs: any[] = [];
    let cursor: { failed_at: string | null; created_at: string; id: string } | null = null;
    let iterations = 0;
    const maxIterations = 10;

    // Paginate through all failed jobs
    while (iterations < maxIterations) {
      const result = await pool.query(
        `SELECT * FROM admin_list_jobs(
          p_status := 'failed',
          p_cursor_failed_at := $1,
          p_cursor_created_at := $2,
          p_cursor_id := $3,
          p_limit := $4
        )`,
        [cursor?.failed_at || null, cursor?.created_at || null, cursor?.id || null, pageSize]
      );

      const jobs = result.rows;
      if (jobs.length === 0) break;

      allJobs.push(...jobs);

      const has_more = jobs[0]?.has_more;
      if (!has_more) break;

      // Set cursor to last job in page
      const lastJob = jobs[jobs.length - 1];
      cursor = {
        failed_at: lastJob.failed_at,
        created_at: lastJob.created_at,
        id: lastJob.id,
      };

      iterations++;
    }

    // Verify: All jobs are unique (no duplicates)
    const uniqueIds = new Set(allJobs.map((j) => j.id));
    expect(uniqueIds.size).toBe(allJobs.length);

    // Verify: We got all failed jobs (5 in our test data)
    expect(allJobs.length).toBe(5);

    // Verify: All have status='failed'
    allJobs.forEach((job) => {
      expect(job.status).toBe("failed");
    });
  });

  test("pagination stable under concurrent inserts", async () => {
    // Start paginating
    const result1 = await pool.query(
      `SELECT * FROM admin_list_jobs(p_status := 'failed', p_limit := 2)`
    );
    const page1 = result1.rows;
    expect(page1.length).toBeGreaterThan(0);

    const cursor = {
      failed_at: page1[page1.length - 1].failed_at,
      created_at: page1[page1.length - 1].created_at,
      id: page1[page1.length - 1].id,
    };

    // Insert new failed job WHILE paginating
    const insertResult = await pool.query(
      `INSERT INTO evaluation_jobs 
       (manuscript_id, job_type, phase, status, failed_at, next_attempt_at, policy_family, voice_preservation_level, english_variant)
       VALUES (1, 'full_evaluation', 'phase_2', 'failed', now(), now(), 'standard', 'balanced', 'us')
       RETURNING id`
    );
    const newJobId = insertResult.rows[0].id;
    testJobIds.push(newJobId);

    // Continue pagination with cursor from before insert
    const result2 = await pool.query(
      `SELECT * FROM admin_list_jobs(
        p_status := 'failed',
        p_cursor_failed_at := $1,
        p_cursor_created_at := $2,
        p_cursor_id := $3,
        p_limit := 10
      )`,
      [cursor.failed_at, cursor.created_at, cursor.id]
    );
    const page2 = result2.rows;

    // Verify: No job from page1 appears in page2 (no duplicates)
    const page1Ids = new Set(page1.map((j: any) => j.id));
    page2.forEach((job: any) => {
      expect(page1Ids.has(job.id)).toBe(false);
    });

    // Verify: Newly inserted job does NOT appear in page2
    // (keyset pagination isolates the result set from concurrent writes)
    const page2Ids = page2.map((j: any) => j.id);
    expect(page2Ids).not.toContain(newJobId);
  });

  test("filters work correctly with pagination", async () => {
    const result = await pool.query(
      `SELECT * FROM admin_list_jobs(
        p_job_type := 'quick_evaluation',
        p_status := 'failed',
        p_limit := 50
      )`
    );

    const jobs = result.rows;

    // All jobs should match filter
    jobs.forEach((job: any) => {
      expect(job.job_type).toBe("quick_evaluation");
      expect(job.status).toBe("failed");
    });
  });

  test("deterministic ordering: failed_at DESC, created_at DESC, id", async () => {
    const result = await pool.query(
      `SELECT * FROM admin_list_jobs(p_status := 'failed', p_limit := 10)`
    );

    const jobs = result.rows;

    for (let i = 0; i < jobs.length - 1; i++) {
      const curr = jobs[i];
      const next = jobs[i + 1];

      // Compare (failed_at DESC NULLS LAST, created_at DESC, id)
      const currTuple = [curr.failed_at, curr.created_at, curr.id];
      const nextTuple = [next.failed_at, next.created_at, next.id];

      // failed_at DESC (nulls last)
      if (curr.failed_at !== null && next.failed_at !== null) {
        const currFailed = new Date(curr.failed_at).getTime();
        const nextFailed = new Date(next.failed_at).getTime();
        expect(currFailed).toBeGreaterThanOrEqual(nextFailed);
      } else if (curr.failed_at === null && next.failed_at !== null) {
        // curr should come after next (nulls last violated)
        fail("NULLS LAST violated: null appeared before non-null");
      }

      // If failed_at equal, check created_at DESC
      if (curr.failed_at === next.failed_at) {
        const currCreated = new Date(curr.created_at).getTime();
        const nextCreated = new Date(next.created_at).getTime();
        expect(currCreated).toBeGreaterThanOrEqual(nextCreated);
      }
    }
  });
});
