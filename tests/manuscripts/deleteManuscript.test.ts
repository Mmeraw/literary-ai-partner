/**
 * Manuscript permanent deletion tests
 *
 * Proves the delete_manuscripts_permanently RPC behaves correctly:
 * - authorized, atomic, dependency-ordered, retention-aware, and idempotent.
 *
 * These tests hit a real database. They run when LOCAL_DB=1 and the required
 * Supabase/Postgres env vars are configured; otherwise they skip.
 */

import { describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createTestManuscript, createTestManuscriptWithChunks } from "../test-helpers/manuscript-factory";

const supabase = getSupabaseAdminClient();
const run = process.env.LOCAL_DB ? describe : describe.skip;

async function getOrCreateTestUser(): Promise<string> {
  const email = `${randomUUID()}@test.devin.local`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return data.user!.id;
}

async function insertVersion(manuscriptId: number, versionNumber = 1) {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .insert({ manuscript_id: manuscriptId, version_number: versionNumber, raw_text: "test", word_count: 100 })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert version: ${error?.message}`);
  return data.id as string;
}

async function insertJob(manuscriptId: number) {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .insert({
      manuscript_id: manuscriptId,
      job_type: "full_evaluation",
      phase: "phase_1",
      policy_family: "standard",
      voice_preservation_level: "balanced",
      english_variant: "us",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert job: ${error?.message}`);
  return data.id as string;
}

async function insertHeldRecoveryAttempt(manuscriptId: number) {
  const { data, error } = await supabase
    .from("held_recovery_attempts")
    .insert({
      idempotency_key: randomUUID(),
      held_item_id: `held-${manuscriptId}`,
      opportunity_id: `opp-${manuscriptId}`,
      manuscript_id: manuscriptId,
      manuscript_version_sha: "sha-1",
      held_item_persisted_version: "v1",
      runtime_outcome_status: "deferred",
      executor_result: {},
      series_key: {},
      recovery_input_fingerprint: "fp-1",
      attempt_number: 1,
      max_attempts: 3,
      status: "held",
      outcome: "pending",
      snapshot: {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert held recovery attempt: ${error?.message}`);
  return data.id as string;
}

async function insertHeldRecoveryWorkItem(attemptId: string, manuscriptId: number) {
  const { error } = await supabase.from("held_recovery_reconstruction_work_items").insert({
    originating_attempt_id: attemptId,
    originating_attempt_idempotency_key: randomUUID(),
    held_item_id: `held-${manuscriptId}`,
    opportunity_id: `opp-${manuscriptId}`,
    manuscript_id: String(manuscriptId),
    manuscript_version_sha: "sha-1",
    held_item_persisted_version: "v1",
    source_hash: "sha-source",
    source_start_offset: 0,
    source_end_offset: 10,
    recovery_method: "source_text_location_only",
  });
  if (error) throw new Error(`Failed to insert held recovery work item: ${error.message}`);
}

async function insertHeldRecoveryQueueItem(manuscriptId: number) {
  const heldItemId = `held-${manuscriptId}`;
  const { error } = await supabase.from("held_recovery_queue_items").insert({
    held_item_id: heldItemId,
    queue_state: "held",
    authority_version: "v1",
    manuscript_id: String(manuscriptId),
  });
  if (error) throw new Error(`Failed to insert held recovery queue item: ${error.message}`);
  return heldItemId;
}

async function insertHeldRecoveryRetrySchedule(attemptId: string) {
  const { error } = await supabase.from("held_recovery_retry_schedules").insert({
    schedule_idempotency_key: randomUUID(),
    held_item_id: "held-1",
    attempt_id: attemptId,
    transition_event_id: "evt-1",
    retry_at: new Date().toISOString(),
    decision_reason: "retryable_failure_window_open",
    policy_version: "v1",
    scheduled_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to insert held recovery retry schedule: ${error.message}`);
}

async function insertDocumentGenerationEvent(jobId: string) {
  const { error } = await supabase.from("document_generation_events").insert({
    job_id: jobId,
    event_type: "pdf_export",
    cost_cents: 100,
    estimated: false,
  });
  if (error) throw new Error(`Failed to insert document generation event: ${error.message}`);
}

async function insertCostEvent(manuscriptId: number, jobId: string) {
  const { data, error } = await supabase
    .from("llm_cost_events")
    .insert({
      source: "evaluation",
      activity: "test",
      provider: "openai",
      model: "gpt-4",
      input_tokens: 10,
      output_tokens: 5,
      cost_cents: 50,
      manuscript_id: manuscriptId,
      evaluation_job_id: jobId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert cost event: ${error?.message}`);
  return data.id as string;
}

async function insertRevenueEvent(jobId: string) {
  const { data, error } = await supabase
    .from("revenue_events")
    .insert({
      source: "stripe",
      event_type: "payment_succeeded",
      gross_revenue_cents: 1000,
      stripe_fee_cents: 30,
      refund_cents: 0,
      job_id: jobId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert revenue event: ${error.message}`);
  return data.id as string;
}

async function insertFreeDiagnosticClaim(userId: string, manuscriptId: number, jobId: string) {
  const { data, error } = await supabase
    .from("free_diagnostic_claims")
    .insert({
      user_id: userId,
      normalized_email: "test@example.com",
      manuscript_id: String(manuscriptId),
      job_id: jobId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert free diagnostic claim: ${error.message}`);
  return data.id as string;
}

async function insertAuditEntry(jobId: string) {
  const { data, error } = await supabase
    .from("audit_entries")
    .insert({
      event_type: "job.transition",
      ok: true,
      actor: "api",
      job_id: jobId,
      to_status: "queued",
      decision_code: "ALLOWED",
      contract_id: "JOB_CONTRACT_v1",
      contract_section: "3.1",
      source: "api",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert audit entry: ${error.message}`);
  return data.id as string;
}

async function insertAdminAction(jobId: string) {
  const { data, error } = await supabase
    .from("admin_actions")
    .insert({
      action_type: "retry_job",
      job_id: jobId,
      performed_at: new Date().toISOString(),
      before_status: "failed",
      after_status: "queued",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to insert admin action: ${error.message}`);
  return data.id as string;
}

async function rowExists(table: string, column: string, value: unknown): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq(column, value)
    .limit(1);
  if (error) throw new Error(`Failed to query ${table}: ${error.message}`);
  return (data ?? []).length > 0;
}

async function deleteManuscripts(userId: string, ids: number[]) {
  const { data, error } = await supabase.rpc("delete_manuscripts_permanently", {
    p_user_id: userId,
    p_manuscript_ids: ids,
  });
  return { data, error };
}

run("delete_manuscripts_permanently RPC", () => {
  test("rejects deletion of another user's manuscript and rolls back the transaction", async () => {
    const owner = await getOrCreateTestUser();
    const attacker = await getOrCreateTestUser();
    const manuscriptId = await createTestManuscript({ userId: owner });

    const { error } = await deleteManuscripts(attacker, [manuscriptId]);
    expect(error).not.toBeNull();

    const stillThere = await rowExists("manuscripts", "id", manuscriptId);
    expect(stillThere).toBe(true);
  });

  test("rejects a mixed-owner bulk request atomically", async () => {
    const userA = await getOrCreateTestUser();
    const userB = await getOrCreateTestUser();
    const owned1 = await createTestManuscript({ userId: userA });
    const owned2 = await createTestManuscript({ userId: userA });
    const protectedId = await createTestManuscript({ userId: userB });

    const { error } = await deleteManuscripts(userA, [owned1, owned2, protectedId]);
    expect(error).not.toBeNull();

    expect(await rowExists("manuscripts", "id", owned1)).toBe(true);
    expect(await rowExists("manuscripts", "id", owned2)).toBe(true);
    expect(await rowExists("manuscripts", "id", protectedId)).toBe(true);
  });

  test("single deletion removes manuscript-owned records and preserves ledgers", async () => {
    const userId = await getOrCreateTestUser();
    const manuscriptId = await createTestManuscript({ userId });
    const versionId = await insertVersion(manuscriptId);
    const jobId = await insertJob(manuscriptId);
    const attemptId = await insertHeldRecoveryAttempt(manuscriptId);
    await insertHeldRecoveryWorkItem(attemptId, manuscriptId);
    await insertHeldRecoveryQueueItem(manuscriptId);
    await insertHeldRecoveryRetrySchedule(attemptId);
    await insertDocumentGenerationEvent(jobId);
    const costId = await insertCostEvent(manuscriptId, jobId);
    const revenueId = await insertRevenueEvent(jobId);
    const claimId = await insertFreeDiagnosticClaim(userId, manuscriptId, jobId);
    const auditId = await insertAuditEntry(jobId);
    const adminActionId = await insertAdminAction(jobId);

    const { data, error } = await deleteManuscripts(userId, [manuscriptId]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_ids).toContain(manuscriptId);
    expect(data?.[0]?.deleted_count).toBe(1);

    expect(await rowExists("manuscripts", "id", manuscriptId)).toBe(false);
    expect(await rowExists("manuscript_versions", "id", versionId)).toBe(false);
    expect(await rowExists("evaluation_jobs", "id", jobId)).toBe(false);
    expect(await rowExists("held_recovery_attempts", "id", attemptId)).toBe(false);
    expect(await rowExists("held_recovery_reconstruction_work_items", "originating_attempt_id", attemptId)).toBe(false);
    expect(await rowExists("held_recovery_queue_items", "manuscript_id", String(manuscriptId))).toBe(false);
    expect(await rowExists("held_recovery_retry_schedules", "attempt_id", attemptId)).toBe(false);
    expect(await rowExists("document_generation_events", "job_id", jobId)).toBe(false);

    // Retained rows should be findable by their own primary keys and have lost
    // manuscript/job linkage (the RPC nulls them before deleting the job).
    const { data: costRow } = await supabase.from("llm_cost_events").select("manuscript_id, evaluation_job_id").eq("id", costId).single();
    expect(costRow).not.toBeNull();
    expect(costRow.manuscript_id).toBeNull();
    expect(costRow.evaluation_job_id).toBeNull();

    const { data: revenueRow } = await supabase.from("revenue_events").select("job_id").eq("id", revenueId).single();
    expect(revenueRow).not.toBeNull();
    expect(revenueRow.job_id).toBeNull();

    const { data: claimRow } = await supabase.from("free_diagnostic_claims").select("manuscript_id, job_id").eq("id", claimId).single();
    expect(claimRow).not.toBeNull();
    expect(claimRow.manuscript_id).toBeNull();
    expect(claimRow.job_id).toBeNull();

    const { data: auditRow } = await supabase.from("audit_entries").select("job_id").eq("id", auditId).single();
    expect(auditRow).not.toBeNull();
    expect(auditRow.job_id).toBeNull();

    const { data: adminRow } = await supabase.from("admin_actions").select("job_id").eq("id", adminActionId).single();
    expect(adminRow).not.toBeNull();
    expect(adminRow.job_id).toBeNull();
  });

  test("bulk deletion is atomic", async () => {
    const userId = await getOrCreateTestUser();
    const m1 = await createTestManuscript({ userId });
    const m2 = await createTestManuscript({ userId });

    const { data, error } = await deleteManuscripts(userId, [m1, m2]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_count).toBe(2);

    expect(await rowExists("manuscripts", "id", m1)).toBe(false);
    expect(await rowExists("manuscripts", "id", m2)).toBe(false);
  });

  test("held recovery dependencies are removed in correct order", async () => {
    const userId = await getOrCreateTestUser();
    const manuscriptId = await createTestManuscript({ userId });
    const attemptId = await insertHeldRecoveryAttempt(manuscriptId);
    await insertHeldRecoveryWorkItem(attemptId, manuscriptId);
    await insertHeldRecoveryQueueItem(manuscriptId);
    await insertHeldRecoveryRetrySchedule(attemptId);

    const { data, error } = await deleteManuscripts(userId, [manuscriptId]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_count).toBe(1);

    expect(await rowExists("manuscripts", "id", manuscriptId)).toBe(false);
    expect(await rowExists("held_recovery_attempts", "id", attemptId)).toBe(false);
    expect(await rowExists("held_recovery_reconstruction_work_items", "originating_attempt_id", attemptId)).toBe(false);
    expect(await rowExists("held_recovery_queue_items", "manuscript_id", String(manuscriptId))).toBe(false);
    expect(await rowExists("held_recovery_retry_schedules", "attempt_id", attemptId)).toBe(false);
  });

  test("manuscript chunks are removed with the manuscript", async () => {
    const userId = await getOrCreateTestUser();
    const { manuscriptId, chunks } = await createTestManuscriptWithChunks({ userId });
    expect(chunks.length).toBeGreaterThan(0);

    const { data, error } = await deleteManuscripts(userId, [manuscriptId]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_count).toBe(1);

    expect(await rowExists("manuscripts", "id", manuscriptId)).toBe(false);
    for (const chunk of chunks) {
      expect(await rowExists("manuscript_chunks", "id", chunk.id)).toBe(false);
    }
  });

  test("duplicate and already-deleted ids are idempotent", async () => {
    const userId = await getOrCreateTestUser();
    const m1 = await createTestManuscript({ userId });
    const m2 = await createTestManuscript({ userId });

    const { data: firstData, error: firstError } = await deleteManuscripts(userId, [m1]);
    expect(firstError).toBeNull();
    expect(firstData?.[0]?.deleted_count).toBe(1);

    const { data, error } = await deleteManuscripts(userId, [m1, m2, m1]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_count).toBe(1);
    expect(data?.[0]?.already_absent_ids).toContain(m1);
    expect(data?.[0]?.deleted_ids).toContain(m2);
    expect(data?.[0]?.deleted_ids).not.toContain(m1);
  });

  test("replaying an already-deleted id with no other ids is a no-op", async () => {
    const userId = await getOrCreateTestUser();
    const m1 = await createTestManuscript({ userId });

    const { error: firstError } = await deleteManuscripts(userId, [m1]);
    expect(firstError).toBeNull();

    const { data, error } = await deleteManuscripts(userId, [m1]);
    expect(error).toBeNull();
    expect(data?.[0]?.deleted_count).toBe(0);
    expect(data?.[0]?.already_absent_ids).toContain(m1);
  });

  test("rejects a not-found id as non-idempotent", async () => {
    const userId = await getOrCreateTestUser();
    const missingId = 999999999;

    const { error } = await deleteManuscripts(userId, [missingId]);
    expect(error).not.toBeNull();
  });
});
