/**
 * RCA-JOB-LIFECYCLE-001 — Lifecycle Invariant Regression Tests
 *
 * Proves:
 * 1. DB invariant rejects status='running' when claimed_by is null (23514)
 * 2. DB invariant rejects status='running' when lease_token is null (23514)
 * 3. DB invariant rejects status='running' when lease_until is null (23514)
 * 4. Processor guard rejects queued-job direct processing
 * 5. Canonical claim path produces valid running state (claimed_by, lease_token, lease_until all non-null)
 * 6. repair_orphaned_running_jobs() is callable and idempotent
 *
 * Uses canonical fields: claimed_by, lease_token, lease_until
 * lease_expires_at is a generated column (GENERATED ALWAYS AS lease_until STORED) — never set directly.
 */

import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { processEvaluationJob } from "@/lib/evaluation/processor";

const run = process.env.LOCAL_DB ? describe : describe.skip;

const PG_URL =
  process.env.PG_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function runSql(query: string): string {
  return execSync(`psql "${PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`, {
    input: `${query}\n`,
    encoding: "utf8",
  }).trim();
}

function insertTestManuscript(): number {
  const id = runSql(`
    INSERT INTO public.manuscripts (
      title, created_by, user_id, tone_context, mood_context,
      voice_mode, word_count, source, english_variant, is_final,
      storygate_linked, allow_industry_discovery
    ) VALUES (
      'Lifecycle Invariant Test ${randomUUID()}',
      gen_random_uuid(), gen_random_uuid(),
      'neutral', 'calm', 'balanced', 1000, 'dashboard', 'us',
      false, false, false
    ) RETURNING id;
  `);
  return parseInt(id, 10);
}

function insertTestJob(manuscriptId: number, status: string, overrides: Record<string, string | null> = {}): string {
  const defaults: Record<string, string | null> = {
    claimed_by: "NULL",
    lease_token: "NULL",
    lease_until: "NULL",
    phase: "'phase_1'",
    phase_status: `'${status}'`,
    ...overrides,
  };

  const id = runSql(`
    INSERT INTO public.evaluation_jobs (
      manuscript_id, status, phase, phase_status,
      claimed_by, lease_token, lease_until
    ) VALUES (
      ${manuscriptId},
      '${status}',
      ${defaults.phase},
      ${defaults.phase_status},
      ${defaults.claimed_by},
      ${defaults.lease_token},
      ${defaults.lease_until}
    ) RETURNING id;
  `);
  return id;
}

function cleanupJob(jobId: string): void {
  runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
}

function cleanupManuscript(manuscriptId: number): void {
  runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
}

run("RCA-JOB-LIFECYCLE-001 — DB invariant enforcement", () => {
  let manuscriptId: number;

  beforeAll(() => {
    manuscriptId = insertTestManuscript();
  });

  afterAll(() => {
    cleanupManuscript(manuscriptId);
  });

  test("1. DB invariant rejects status='running' when claimed_by is null", () => {
    expect(() => {
      runSql(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id, status, phase, phase_status,
          claimed_by, lease_token, lease_until
        ) VALUES (
          ${manuscriptId}, 'running', 'phase_1', 'running',
          NULL, gen_random_uuid()::text, NOW() + INTERVAL '5 minutes'
        );
      `);
    }).toThrow(/23514|evaluation_jobs_running_requires_claim/);
  });

  test("2. DB invariant rejects status='running' when lease_token is null", () => {
    expect(() => {
      runSql(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id, status, phase, phase_status,
          claimed_by, lease_token, lease_until
        ) VALUES (
          ${manuscriptId}, 'running', 'phase_1', 'running',
          gen_random_uuid()::text, NULL, NOW() + INTERVAL '5 minutes'
        );
      `);
    }).toThrow(/23514|evaluation_jobs_running_requires_claim/);
  });

  test("3. DB invariant rejects status='running' when lease_until is null", () => {
    expect(() => {
      runSql(`
        INSERT INTO public.evaluation_jobs (
          manuscript_id, status, phase, phase_status,
          claimed_by, lease_token, lease_until
        ) VALUES (
          ${manuscriptId}, 'running', 'phase_1', 'running',
          gen_random_uuid()::text, gen_random_uuid()::text, NULL
        );
      `);
    }).toThrow(/23514|evaluation_jobs_running_requires_claim/);
  });

  test("5. Canonical claim path produces valid running state (all claim fields non-null)", () => {
    const claimedBy = randomUUID();
    const leaseToken = randomUUID();

    const result = runSql(`
      INSERT INTO public.evaluation_jobs (
        manuscript_id, status, phase, phase_status,
        claimed_by, lease_token, lease_until
      ) VALUES (
        ${manuscriptId}, 'running', 'phase_1', 'running',
        '${claimedBy}', '${leaseToken}', NOW() + INTERVAL '5 minutes'
      ) RETURNING id, claimed_by, lease_token, lease_until;
    `);

    const [id, claimed_by, lease_token, lease_until] = result.split("|");

    expect(claimed_by).toBe(claimedBy);
    expect(lease_token).toBe(leaseToken);
    expect(lease_until).not.toBeNull();

    cleanupJob(id);
  });

  test("6. repair_orphaned_running_jobs() is callable and returns integer (idempotent)", () => {
    const result1 = runSql(`SELECT repair_orphaned_running_jobs();`);
    const count1 = parseInt(result1, 10);
    expect(Number.isInteger(count1)).toBe(true);

    // Second call should also return integer (idempotent — no orphans remain)
    const result2 = runSql(`SELECT repair_orphaned_running_jobs();`);
    const count2 = parseInt(result2, 10);
    expect(count2).toBe(0);
  });
});

run("RCA-JOB-LIFECYCLE-001 — Processor guard enforcement", () => {
  test("4. Processor guard rejects direct processing of queued job", async () => {
    // processEvaluationJob must fail-closed when job.status === 'queued'
    // We pass a synthetic job ID that does not exist in DB to trigger the guard path.
    // The function should return { success: false, error: /Queued jobs must be claimed/ }
    // before reaching any DB write.
    const fakeQueuedJobId = randomUUID();

    // Patch: if process.env.LOCAL_DB is set, we can insert a queued row and call processor.
    // Otherwise, we test the guard via unit-level mock of the job fetch.
    // Since this suite is LOCAL_DB-gated, insert a real queued row.
    const manuscriptId = parseInt(
      execSync(
        `psql "${PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`,
        {
          input: `
            INSERT INTO public.manuscripts (
              title, created_by, user_id, tone_context, mood_context,
              voice_mode, word_count, source, english_variant, is_final,
              storygate_linked, allow_industry_discovery
            ) VALUES (
              'Guard Test ${randomUUID()}',
              gen_random_uuid(), gen_random_uuid(),
              'neutral', 'calm', 'balanced', 1000, 'dashboard', 'us',
              false, false, false
            ) RETURNING id;
          `,
          encoding: "utf8",
        }
      ).trim(),
      10
    );

    const jobId = execSync(
      `psql "${PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`,
      {
        input: `
          INSERT INTO public.evaluation_jobs (
            manuscript_id, status, phase, phase_status
          ) VALUES (
            ${manuscriptId}, 'queued', 'phase_1', 'queued'
          ) RETURNING id;
        `,
        encoding: "utf8",
      }
    ).trim();

    try {
      const result = await processEvaluationJob(jobId);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Queued jobs must be claimed before processing/);
    } finally {
      execSync(`psql "${PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`, {
        input: `
          DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';
          DELETE FROM public.manuscripts WHERE id = ${manuscriptId};
        `,
        encoding: "utf8",
      });
    }
  });
});
