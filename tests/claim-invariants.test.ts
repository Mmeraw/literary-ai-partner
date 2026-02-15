/**
 * Claim invariants
 *
 * Proves:
 * - next_attempt_at gates claim eligibility
 * - active leases block claims
 * - failed jobs are not claimable
 * - attempt_count increments exactly once on claim
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const supabase = getSupabaseAdminClient();
const run = process.env.LOCAL_DB ? describe : describe.skip;

const PG_URL =
  process.env.PG_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function runSql(query: string): string {
  return execSync(`psql "${PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`, {
    input: `${query}\n`,
    encoding: "utf8",
  }).trim();
}

async function insertTestManuscript(): Promise<number> {
  const title = `Claim Gate ${randomUUID()}`;
  const result = runSql(`
    WITH _seq AS (
      SELECT setval('public.manuscripts_id_seq', COALESCE((SELECT MAX(id) FROM public.manuscripts), 0), true)
    )
    INSERT INTO public.manuscripts (
      title,
      created_by,
      user_id,
      tone_context,
      mood_context,
      voice_mode,
      word_count,
      source,
      english_variant,
      is_final,
      storygate_linked,
      allow_industry_discovery
    )
    VALUES (
      '${title}',
      gen_random_uuid(),
      gen_random_uuid(),
      'neutral',
      'calm',
      'balanced',
      1000,
      'dashboard',
      'us',
      false,
      false,
      false
    )
    RETURNING id;
  `);

  const id = Number.parseInt(result, 10);
  if (Number.isNaN(id)) {
    throw new Error(`Failed to parse manuscript id from SQL result: '${result}'`);
  }
  return id;
}

async function insertJob(query: string): Promise<string> {
  const result = runSql(query);
  return result;
}

// Concurrency invariant: only one worker may claim a queued job.
// See docs/testing/concurrency_proofs.md#step-3b--scoped-claim-race-single-winner-claim
run("Claim invariants", () => {
  const testNow = "2026-01-01T00:00:00Z";

  beforeEach(() => {
    runSql("DELETE FROM public.evaluation_jobs WHERE status = 'queued';");
  });

  it("blocks claims before next_attempt_at", async () => {
    const admin = supabase!;
    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await insertTestManuscript();

      const future = "2026-01-01T01:00:00Z";
      jobId = await insertJob(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id,
          job_type,
          status,
          phase,
          work_type,
          policy_family,
          voice_preservation_level,
          english_variant,
          next_attempt_at,
          attempt_count,
          max_attempts
        )
        VALUES (
          ${manuscriptId},
          'full_evaluation',
          'queued',
          'phase_2',
          'full_evaluation',
          'standard',
          'balanced',
          'us',
          '${future}',
          0,
          3
        )
        RETURNING id
      `);

      const claimJson = runSql(
        `SELECT row_to_json(t) FROM claim_job_atomic('worker-gate', '${testNow}'::timestamptz, 300) t;`
      );
      expect(claimJson).toBe("");
    } finally {
      if (jobId) {
        runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
      }
      if (manuscriptId) {
        runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
      }
    }
  });

  it("blocks claims with active lease", async () => {
    const admin = supabase!;
    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await insertTestManuscript();

      const leaseUntil = "2026-01-01T01:00:00Z";
      jobId = await insertJob(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id,
          job_type,
          status,
          phase,
          work_type,
          policy_family,
          voice_preservation_level,
          english_variant,
          lease_until,
          worker_id,
          attempt_count,
          max_attempts
        )
        VALUES (
          ${manuscriptId},
          'full_evaluation',
          'queued',
          'phase_2',
          'full_evaluation',
          'standard',
          'balanced',
          'us',
          '${leaseUntil}',
          'worker-active',
          0,
          3
        )
        RETURNING id
      `);

      const claimJson = runSql(
        `SELECT row_to_json(t) FROM claim_job_atomic('worker-gate', '${testNow}'::timestamptz, 300) t;`
      );
      expect(claimJson).toBe("");
    } finally {
      if (jobId) {
        runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
      }
      if (manuscriptId) {
        runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
      }
    }
  });

  it("does not claim failed jobs", async () => {
    const admin = supabase!;
    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await insertTestManuscript();

      jobId = await insertJob(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id,
          job_type,
          status,
          phase,
          work_type,
          policy_family,
          voice_preservation_level,
          english_variant,
          attempt_count,
          max_attempts
        )
        VALUES (
          ${manuscriptId},
          'full_evaluation',
          'failed',
          'phase_2',
          'full_evaluation',
          'standard',
          'balanced',
          'us',
          1,
          3
        )
        RETURNING id
      `);

      const claimJson = runSql(
        `SELECT row_to_json(t) FROM claim_job_atomic('worker-gate', '${testNow}'::timestamptz, 300) t;`
      );
      expect(claimJson).toBe("");
    } finally {
      if (jobId) {
        runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
      }
      if (manuscriptId) {
        runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
      }
    }
  });

  it("increments attempt_count exactly once per claim", async () => {
    const admin = supabase!;
    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await insertTestManuscript();

      jobId = await insertJob(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id,
          job_type,
          status,
          phase,
          work_type,
          policy_family,
          voice_preservation_level,
          english_variant,
          attempt_count,
          max_attempts
        )
        VALUES (
          ${manuscriptId},
          'full_evaluation',
          'queued',
          'phase_2',
          'full_evaluation',
          'standard',
          'balanced',
          'us',
          0,
          3
        )
        RETURNING id
      `);

      const claimJson = runSql(
        `SELECT row_to_json(t) FROM claim_job_atomic('worker-attempt', '${testNow}'::timestamptz, 300) t;`
      );
      expect(claimJson).not.toBe("");

      const status = runSql(
        `SELECT status FROM public.evaluation_jobs WHERE id = '${jobId}';`
      );
      const attemptCount = runSql(
        `SELECT attempt_count::text FROM public.evaluation_jobs WHERE id = '${jobId}';`
      );

      expect(status).toBe("running");
      expect(Number(attemptCount)).toBe(1);
    } finally {
      if (jobId) {
        runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
      }
      if (manuscriptId) {
        runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
      }
    }
  });
});
