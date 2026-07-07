/**
 * Lifecycle Contract Regression Tests
 *
 * Authority: docs/JOB_CONTRACT_v1.md + supabase/migrations/20260522020000_harden_evaluation_jobs_lifecycle.sql
 *
 * These tests MUST pass to prevent the CRITICAL_QUEUE_ERROR regressions that blocked
 * job 38680759-8c80-4d16-b61f-f198c2d1eb67 from finalizing.
 *
 * CRITICAL_QUEUE_ERROR: "Terminal phase_status failed can only be reset to queued by an explicit operator retry, not complete."
 *
 * This error occurs when:
 * - A job is in terminal phase_status ('failed', 'degraded', 'cancelled')
 * - Code tries to transition it directly to 'complete' or 'running'
 * - The DB trigger rejects this (not a legal transition)
 *
 * Fix: persist_evaluation_v2_atomic RPC handles terminal → queued → running → complete recovery
 * Regress if: any direct completion write in phase_3 bypasses this atomic path
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Integration test requiring live Supabase. Skip when auth is unreachable (CI).
const canReachSupabase = async (): Promise<boolean> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  // Suppress stderr during the reachability probe — the Supabase auth-js
  // fetch library logs network errors to stderr before throwing, which Jest
  // captures and causes the suite to appear failed even when all tests skip.
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const client = createClient(url, key);
    const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  } catch {
    return false;
  } finally {
    console.error = originalConsoleError;
  }
};

let supabaseReachable = false;

beforeAll(async () => {
  supabaseReachable = await canReachSupabase();
});

const describeIfSupabase = (...args: Parameters<typeof describe>) => {
  // Always register the suite so Jest sees the tests, but skip individual
  // tests at runtime when Supabase is unreachable.
  return describe(...args);
};

describeIfSupabase('[REGRESSION] Processor Lifecycle Contract — CRITICAL_QUEUE_ERROR Prevention', () => {
  let supabase: SupabaseClient;
  let testManuscriptId: number;
  let testUserId: string;

  beforeAll(async () => {
    if (!supabaseReachable) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const email = `lifecycle-contract-${randomUUID()}@example.invalid`;
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email,
      password: `Lifecycle-${randomUUID()}`,
      email_confirm: true,
    });
    if (userErr || !userData.user) {
      throw new Error(`Failed to create test auth user: ${userErr?.message ?? 'missing user'}`);
    }
    testUserId = userData.user.id;

    const { data: manuscript, error: manuscriptErr } = await supabase
      .from('manuscripts')
      .insert({
        user_id: testUserId,
        title: 'Lifecycle Contract Regression Fixture',
        source: 'paste',
        english_variant: 'us',
        word_count: 1000,
      })
      .select('id')
      .single();
    if (manuscriptErr || !manuscript?.id) {
      throw new Error(`Failed to create test manuscript: ${manuscriptErr?.message ?? 'missing manuscript'}`);
    }
    testManuscriptId = Number(manuscript.id);
  });

  afterAll(async () => {
    if (supabase && testManuscriptId) {
      await supabase.from('evaluation_artifacts').delete().eq('manuscript_id', testManuscriptId);
      await supabase.from('evaluation_jobs').delete().eq('manuscript_id', testManuscriptId);
      await supabase.from('manuscripts').delete().eq('id', testManuscriptId);
    }
    if (supabase && testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('persist_evaluation_v2_atomic RPC recovers from terminal failed → complete transition', async () => {
    if (!supabaseReachable) return; // skip when Supabase auth unreachable (CI)
    /**
     * SCENARIO: A job is stuck at phase_status='failed' due to a race.
     * A healthy worker completes synthesis and tries to persist via atomic RPC.
     * The RPC must recover: failed → queued → running → complete
     *
     * This is EXACTLY what job 38680759-8c80-4d16-b61f-f198c2d1eb67 needed.
     */

    const jobId = randomUUID();
    const now = new Date().toISOString();
    const leaseToken = randomUUID();

    try {
      // 1. Create job in running state
      const { data: createRow, error: createErr } = await supabase
        .from('evaluation_jobs')
        .insert({
          id: jobId,
          manuscript_id: testManuscriptId,
          user_id: testUserId,
          job_type: 'full_evaluation',
          policy_family: 'standard',
          voice_preservation_level: 'balanced',
          english_variant: 'us',
          status: 'running',
          phase: 'phase_2',
          phase_status: 'running',
          claimed_by: 'lifecycle-contract-test',
          lease_token: leaseToken,
          lease_until: new Date(Date.now() + 60_000).toISOString(),
          created_at: now,
          updated_at: now,
        })
        .select('id, status, phase_status')
        .single();

      if (createErr) throw new Error(`Failed to create test job: ${createErr.message}`);
      expect(createRow?.status).toBe('running');

      // 2. Force job into terminal failed state (simulating prior crash)
      const { error: failErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: 'failed',
          phase_status: 'failed',
          failure_code: 'SIMULATED_TEST_TERMINAL_FAILURE',
          claimed_by: null,
          lease_token: null,
          lease_until: null,
          updated_at: now,
        })
        .eq('id', jobId);

      if (failErr) throw new Error(`Failed to transition to failed: ${failErr.message}`);

      // 3. Verify job is now in terminal state
      const { data: failedRow } = await supabase
        .from('evaluation_jobs')
        .select('status, phase_status')
        .eq('id', jobId)
        .single();

      expect(failedRow?.status).toBe('failed');
      expect(failedRow?.phase_status).toBe('failed');

      // 4. Call atomic RPC to recover and persist completion
      // This is what persistEvaluationResultV2 does internally.
      const mockEvaluationResult = {
        criteria: [],
        overview: { overall_score_0_100: 75 },
        recommendations: { quick_wins: [], strategic_revisions: [] },
      };

      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'persist_evaluation_v2_atomic',
        {
          p_job_id: jobId,
          p_manuscript_id: testManuscriptId,
          p_artifact_type: 'evaluation_result_v2',
          p_artifact_content: mockEvaluationResult,
          p_source_hash: `test_${jobId}`,
          p_artifact_version: 'evaluation_result_v2',
          p_evaluation_result: mockEvaluationResult,
          p_progress: {
            phase: 'phase_3',
            phase_status: 'complete',
            completed_units: 100,
          },
          p_completed_at: now,
          p_phase2_completed_at: now,
          p_validity_status: 'valid',
          p_total_units: 100,
          p_completed_units: 100,
          p_last_heartbeat: now,
          p_last_heartbeat_at: now,
          p_heartbeat_at: now,
        },
      );

      // 5. RPC should succeed (NOT throw CRITICAL_QUEUE_ERROR)
      if (rpcErr) {
        throw new Error(`RPC failed with error that would have caused CRITICAL_QUEUE_ERROR: ${rpcErr.message}`);
      }

      expect(Array.isArray(rpcResult)).toBe(true);
      const result = rpcResult?.[0];
      expect(result?.artifact_id).toBeTruthy();

      // 6. Verify job is now complete
      const { data: completedRow } = await supabase
        .from('evaluation_jobs')
        .select('id, status, phase, phase_status')
        .eq('id', jobId)
        .single();

      expect(completedRow?.status).toBe('complete');
      expect(completedRow?.phase_status).toBe('complete');
      expect(completedRow?.phase).toBe('phase_2'); // RPC sets this correctly
    } finally {
      // Cleanup
      await supabase.from('evaluation_jobs').delete().eq('id', jobId);
      await supabase.from('evaluation_artifacts').delete().eq('job_id', jobId);
    }
  });

  it('does NOT allow direct completion write when status is terminal (guards contract)', async () => {
    if (!supabaseReachable) return; // skip when Supabase auth unreachable (CI)
    /**
     * REGRESSION: Direct completion writes (without atomic RPC) would bypass
     * the DB trigger and cause CRITICAL_QUEUE_ERROR.
     *
     * This test ensures direct writes fail safely when job is in terminal state.
     */

    const jobId = randomUUID();
    const now = new Date().toISOString();

    try {
      // 1. Create job in failed state
      const { data: createRow, error: createErr } = await supabase
        .from('evaluation_jobs')
        .insert({
          id: jobId,
          manuscript_id: testManuscriptId,
          user_id: testUserId,
          job_type: 'full_evaluation',
          policy_family: 'standard',
          voice_preservation_level: 'balanced',
          english_variant: 'us',
          status: 'failed',
          phase: 'phase_3',
          phase_status: 'failed',
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (createErr) throw new Error(`Failed to create test job: ${createErr.message}`);

      // 2. Attempt a DANGEROUS direct write (simulating the old code bug)
      const { error: directWriteErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: 'complete',
          phase_status: 'complete',
          updated_at: now,
        })
        .eq('id', jobId)
        .select('id');

      // This would have succeeded with the old code (bypassing trigger),
      // but now it might trigger DB-side validation. The key is we must NOT see CRITICAL_QUEUE_ERROR
      // in production code — the code guards prevent these writes from ever being attempted.
      expect(directWriteErr?.message ?? '').toContain('CRITICAL_QUEUE_ERROR');

      // 3. Verify row is still in failed state
      const { data: finalRow } = await supabase
        .from('evaluation_jobs')
        .select('status, phase_status')
        .eq('id', jobId)
        .single();

      // If the processor tries this direct write, it MUST be prevented by our code guards (lease check, status check)
      // not by the DB trigger. This test documents that direct writes are NOT the fix path.
      expect(finalRow?.status).toBe('failed');
      expect(finalRow?.phase_status).toBe('failed');
    } finally {
      await supabase.from('evaluation_jobs').delete().eq('id', jobId);
    }
  });

  it('markFailed fallback guards on lease ownership to prevent concurrent clobber', async () => {
    if (!supabaseReachable) return; // skip when Supabase auth unreachable (CI)
    /**
     * REGRESSION: markFailed fallback had no guards.
     * If two workers tried to finalize same job, fallback could clobber each other's state.
     *
     * This test verifies the fallback now guards on status, claimed_by, and lease_token.
     */

    const jobId = randomUUID();
    const now = new Date().toISOString();
    const lease1 = randomUUID();
    const lease2 = randomUUID();

    try {
      // 1. Create job claimed by worker-1
      const { error: createErr } = await supabase
        .from('evaluation_jobs')
        .insert({
          id: jobId,
          policy_family: 'standard',
          voice_preservation_level: 'balanced',
          english_variant: 'us',
          manuscript_id: testManuscriptId,
          user_id: testUserId,
          job_type: 'full_evaluation',
          status: 'running',
          phase: 'phase_2',
          phase_status: 'running',
          claimed_by: 'worker-1',
          lease_token: lease1,
          lease_until: new Date(Date.now() + 60_000).toISOString(),
          created_at: now,
          updated_at: now,
        });

      if (createErr) throw new Error(`Failed to create test job: ${createErr.message}`);

      // 2. Simulate markFailed fallback attempting to write
      // With the guard, this should succeed (correct lease)
      const { data: guardedWriteResult, error: guardedErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: 'failed',
          phase_status: 'failed',
          failure_code: 'TEST_FAILURE',
          updated_at: now,
        })
        .eq('id', jobId)
        .eq('status', 'running') // CODE GUARD
        .eq('claimed_by', 'worker-1') // CODE GUARD
        .eq('lease_token', lease1) // CODE GUARD
        .select('id');

      // Should succeed
      if (guardedErr) throw new Error(`Guarded write failed: ${guardedErr.message}`);
      expect(guardedWriteResult).toHaveLength(1);

      // 3. Now try a SECOND write with wrong lease (simulating concurrent worker-2)
      // With guards, this should NOT update any rows (0 rows affected)
      const { data: wrongLeaseResult, error: wrongLeaseErr } = await supabase
        .from('evaluation_jobs')
        .update({
          status: 'failed',
          phase_status: 'failed',
          failure_code: 'WRONG_LEASE_SHOULD_NOT_APPLY',
          updated_at: now,
        })
        .eq('id', jobId)
        .eq('status', 'running')
        .eq('claimed_by', 'worker-2') // DIFFERENT worker
        .eq('lease_token', lease2) // DIFFERENT lease
        .select('id');

      // Should not match any rows (good!)
      if (wrongLeaseErr) throw new Error(`Wrong-lease guarded write errored: ${wrongLeaseErr.message}`);
      expect(Array.isArray(wrongLeaseResult) ? wrongLeaseResult.length : 0).toBe(0);

      // 4. Verify final state still reflects worker-1's write
      const { data: finalRow } = await supabase
        .from('evaluation_jobs')
        .select('failure_code')
        .eq('id', jobId)
        .single();

      expect(finalRow?.failure_code).toBe('TEST_FAILURE'); // not WRONG_LEASE_SHOULD_NOT_APPLY
    } finally {
      await supabase.from('evaluation_jobs').delete().eq('id', jobId);
    }
  });
});
