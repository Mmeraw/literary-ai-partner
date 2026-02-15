import { execSync } from 'child_process';

// Helper to run SQL queries
function runSql(query: string): string {
  return execSync(`psql "${process.env.PG_URL}" -v ON_ERROR_STOP=1 -t -A -q -P pager=off`, {
    input: `${query}\n`,
    encoding: "utf8",
  }).trim();
}

// Helper to insert a test manuscript and return its ID
async function insertTestManuscript(): Promise<number> {
  const title = `TTL Test ${Date.now()}`;
  const result = runSql(`
    INSERT INTO public.manuscripts (title, content, user_id, is_deleted)
    VALUES ('${title}', 'Test content for TTL clamping', NULL, false)
    RETURNING id;
  `);
  const id = Number.parseInt(result, 10);
  if (Number.isNaN(id)) {
    throw new Error(`Failed to parse manuscript id from SQL result: '${result}'`);
  }
  return id;
}

// Helper to insert a test job and return its ID
async function insertTestJob(manuscriptId: number): Promise<string> {
  const result = runSql(`
    INSERT INTO public.evaluation_jobs (
      manuscript_id, job_type, status, phase, policy_family,
      voice_preservation_level, english_variant, work_type
    ) VALUES (
      ${manuscriptId}, 'full_evaluation', 'queued', 'phase1', 'standard',
      'moderate', 'american', 'fiction'
    ) RETURNING id;
  `);
  return result;
}

describe('TTL Clamping Tests', () => {
  const testNow = "2026-01-01T00:00:00Z";
  let manuscriptId: number;
  let jobId: string;

  beforeEach(async () => {
    manuscriptId = await insertTestManuscript();
    jobId = await insertTestJob(manuscriptId);
  });

  afterEach(async () => {
    if (jobId) runSql(`DELETE FROM public.evaluation_jobs WHERE id = '${jobId}';`);
    if (manuscriptId) runSql(`DELETE FROM public.manuscripts WHERE id = ${manuscriptId};`);
  });

  it('clamps negative TTL to minimum 30 seconds', async () => {
    const result = runSql(`
      SELECT EXTRACT(EPOCH FROM (lease_until - '${testNow}'::timestamptz)) as actual_seconds
      FROM claim_job_atomic('worker-neg', '${testNow}'::timestamptz, -100);
    `);
    const actualSeconds = Number.parseFloat(result);
    expect(actualSeconds).toBeGreaterThanOrEqual(30);
    expect(actualSeconds).toBeLessThanOrEqual(35);
  });

  it('clamps zero TTL to minimum 30 seconds', async () => {
    const result = runSql(`
      SELECT EXTRACT(EPOCH FROM (lease_until - '${testNow}'::timestamptz)) as actual_seconds
      FROM claim_job_atomic('worker-zero', '${testNow}'::timestamptz, 0);
    `);
    const actualSeconds = Number.parseFloat(result);
    expect(actualSeconds).toBeGreaterThanOrEqual(30);
    expect(actualSeconds).toBeLessThanOrEqual(35);
  });

  it('clamps huge TTL to maximum 900 seconds', async () => {
    const result = runSql(`
      SELECT EXTRACT(EPOCH FROM (lease_until - '${testNow}'::timestamptz)) as actual_seconds
      FROM claim_job_atomic('worker-huge', '${testNow}'::timestamptz, 10000);
    `);
    const actualSeconds = Number.parseFloat(result);
    expect(actualSeconds).toBeLessThanOrEqual(900);
    expect(actualSeconds).toBeGreaterThanOrEqual(895);
  });

  it('accepts valid TTL within bounds (300 seconds)', async () => {
    const result = runSql(`
      SELECT EXTRACT(EPOCH FROM (lease_until - '${testNow}'::timestamptz)) as actual_seconds
      FROM claim_job_atomic('worker-valid', '${testNow}'::timestamptz, 300);
    `);
    const actualSeconds = Number.parseFloat(result);
    expect(actualSeconds).toBeGreaterThanOrEqual(299);
    expect(actualSeconds).toBeLessThanOrEqual(301);
  });
});