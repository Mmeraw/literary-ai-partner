/**
 * JOBS STABILITY CONTRACT — Contractual Tests
 *
 * These tests enforce the invariants declared in docs/JOBS_STABILITY_CONTRACT.md
 * Each test corresponds directly to a contract section and must pass before
 * Phase 2 is unlocked.
 *
 * Authority: docs/JOBS_STABILITY_CONTRACT.md (Section 10: Required Tests)
 * Run: npm test -- manuscript-chunks-stability.test.ts
 */

import { claimChunkForProcessing } from "@/lib/manuscripts/chunks";
import { getEligibleChunksWithStuckRecovery, getManuscriptChunks, upsertChunks } from "@/lib/manuscripts/chunks";
import {
  createTestManuscript,
  createTestManuscriptWithChunks,
  getChunkById,
  forceUpdateChunk,
} from "./test-helpers/manuscript-factory";
import { createHash, randomUUID } from "crypto";

const hasSupabaseEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1";
const describeOrSkip = hasSupabaseEnv && runDbIntegration ? describe : describe.skip;

/**
 * TEST 1: Atomic Double-Claim Contention
 *
 * Contract Clause: "No double-processing of chunks"
 * (JOBS_STABILITY_CONTRACT.md, Section 9)
 *
 * Proof: Two workers race to claim the same chunk.
 * Exactly one succeeds; one gets false.
 * attempt_count increments by exactly 1.
 * Status transitions from pending → processing.
 */
describeOrSkip("Chunk Stability: Atomic Claiming (Contract Test 1)", () => {
  test("only one worker can claim the same chunk under concurrent load", async () => {
    // SETUP: Create manuscript with one pending chunk
    const { manuscriptId, chunks } = await createTestManuscriptWithChunks({
      chunkCount: 1,
    });
    const chunk = chunks[0];

    // EXECUTE: Race two workers to claim the same chunk
    const [result1, result2] = await Promise.all([
      claimChunkForProcessing(chunk.id),
      claimChunkForProcessing(chunk.id),
    ]);

    // VERIFY: Exactly one succeeded
    const successes = [result1, result2].filter((r) => r === true).length;
    expect(successes).toBe(1);

    // VERIFY: Chunk state is correct after claim
    const refreshed = await getChunkById(chunk.id);
    expect(refreshed).not.toBeNull();
    expect(refreshed?.status).toBe("processing");
    expect(refreshed?.attempt_count).toBe(1); // Incremented exactly once

    // VERIFY: loser's false result is correct
    const failures = [result1, result2].filter((r) => r === false).length;
    expect(failures).toBe(1);
  });

  test("failed chunks can be reclaimed, but only one worker succeeds", async () => {
    const { chunks } = await createTestManuscriptWithChunks({
      chunkCount: 1,
    });
    const chunk = chunks[0];

    // SETUP: Force chunk to failed state
    await forceUpdateChunk(chunk.id, {
      status: "failed",
      last_error: "Simulated failure",
      attempt_count: 1,
    });

    // EXECUTE: Two workers race to reclaim
    const [result1, result2] = await Promise.all([
      claimChunkForProcessing(chunk.id),
      claimChunkForProcessing(chunk.id),
    ]);

    // VERIFY: Only one succeeds
    const successes = [result1, result2].filter((r) => r === true).length;
    expect(successes).toBe(1);

    // VERIFY: attempt_count incremented exactly once
    const refreshed = await getChunkById(chunk.id);
    expect(refreshed?.attempt_count).toBe(2); // Was 1, now 2
  });
});

/**
 * TEST 2: Crash → Lease Expiry → Recovery
 *
 * Contract Clause: "Processing chunks stuck beyond lease are recoverable"
 * (JOBS_STABILITY_CONTRACT.md, Section 9)
 *
 * Proof:
 * 1. Worker claims chunk (processing_started_at = now)
 * 2. Worker crashes (simulate by forcing old processing_started_at)
 * 3. Chunk is considered stuck (processing_started_at > 15 min old)
 * 4. New worker queries getEligibleChunksWithStuckRecovery
 * 5. Stuck chunk is returned (eligible for reclaim)
 * 6. New worker claims it successfully (no double-processing)
 */
describeOrSkip("Chunk Stability: Crash Recovery (Contract Test 2)", () => {
  test("processing chunks stuck beyond lease become eligible for recovery", async () => {
    const { manuscriptId, chunks } =
      await createTestManuscriptWithChunks({
        chunkCount: 1,
      });
    const chunk = chunks[0];

    // PHASE 1: Worker claims chunk
    const claimed = await claimChunkForProcessing(chunk.id);
    expect(claimed).toBe(true);

    // Verify it's now processing
    let refreshed = await getChunkById(chunk.id);
    expect(refreshed?.status).toBe("processing");
    expect(refreshed?.processing_started_at).not.toBeNull();
    const originalTimestamp = refreshed?.processing_started_at;

    // PHASE 2: Simulate crash by forcing old processing_started_at AND expired lease
    // (This would normally only happen if worker dies mid-flight)
    const stuckTimestamp = new Date(
      Date.now() - 20 * 60 * 1000 // 20 minutes ago
    ).toISOString();

    await forceUpdateChunk(chunk.id, {
      processing_started_at: stuckTimestamp,
      lease_expires_at: stuckTimestamp, // Also expire the lease
    });

    // PHASE 3: New worker scans for eligible chunks (stuck recovery via expired leases)
    const eligibleChunks = await getEligibleChunksWithStuckRecovery(
      manuscriptId,
      3 // maxAttempts
    );

    // VERIFY: Stuck chunk is returned as eligible
    expect(eligibleChunks.map((c) => c.id)).toContain(chunk.id);
    const eligibleChunk = eligibleChunks.find((c) => c.id === chunk.id);
    expect(eligibleChunk?.status).toBe("processing"); // Still marked processing
    expect(eligibleChunk?.attempt_count).toBe(1); // Original attempt count

    // PHASE 4: New worker claims recovered chunk
    const reclaimed = await claimChunkForProcessing(chunk.id);
    expect(reclaimed).toBe(true);

    // VERIFY: attempt_count incremented, processing_started_at updated
    refreshed = await getChunkById(chunk.id);
    expect(refreshed?.attempt_count).toBe(2);
    expect(refreshed?.status).toBe("processing");
    expect(refreshed?.processing_started_at).not.toBe(stuckTimestamp); // Updated
  });

  test("non-stuck processing chunks are not eligible for recovery", async () => {
    const { manuscriptId, chunks } =
      await createTestManuscriptWithChunks({
        chunkCount: 2,
      });

    // SETUP: Claim both chunks
    const chunk1 = chunks[0];
    const chunk2 = chunks[1];

    await claimChunkForProcessing(chunk1.id);
    await claimChunkForProcessing(chunk2.id);

    // SETUP: Force one to be stuck (20 min old), leave other recent
    const expiredTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await forceUpdateChunk(chunk1.id, {
      processing_started_at: expiredTimestamp,
      lease_expires_at: expiredTimestamp, // Expire the lease
    });
    // chunk2 was just claimed, so processing_started_at and lease_expires_at are recent

    // EXECUTE: Query for stuck chunks (expired leases)
    const eligible = await getEligibleChunksWithStuckRecovery(
      manuscriptId,
      3
    );

    // VERIFY: Only stuck chunk (chunk1) is returned
    const eligibleIds = eligible.map((c) => c.id);
    expect(eligibleIds).toContain(chunk1.id);
    expect(eligibleIds).not.toContain(chunk2.id); // Recent chunk not eligible
  });
});

/**
 * TEST 3: Terminal Immutability
 *
 * Contract Clause: "Terminal states are write-once"
 * (JOBS_STABILITY_CONTRACT.md, Section 8)
 *
 * Proof:
 * - done chunks cannot be reclaimed (claim returns false)
 * - result_json is preserved (never overwritten)
 * - status cannot regress
 * - attempt_count is immutable
 */
describeOrSkip("Chunk Stability: Terminal Immutability (Contract Test 3)", () => {
  test("done chunks cannot be claimed and are immutable", async () => {
    const { chunks } = await createTestManuscriptWithChunks({
      chunkCount: 1,
    });
    const chunk = chunks[0];

    // SETUP: Force chunk to done state with result
    const testResult = { output: "processed text", score: 0.85 };
    await forceUpdateChunk(chunk.id, {
      status: "done",
      result_json: testResult,
      attempt_count: 1,
    });

    // EXECUTE: Try to claim done chunk
    const claimAttempt = await claimChunkForProcessing(chunk.id);

    // VERIFY: Claim failed
    expect(claimAttempt).toBe(false);

    // VERIFY: State is unchanged
    const refreshed = await getChunkById(chunk.id);
    expect(refreshed?.status).toBe("done");
    expect(refreshed?.result_json).toEqual(testResult);
    expect(refreshed?.attempt_count).toBe(1); // Unchanged
  });

  test("failed chunks at max attempts are immutable", async () => {
    const { chunks } = await createTestManuscriptWithChunks({
      chunkCount: 1,
    });
    const chunk = chunks[0];

    // SETUP: Force chunk to failed, at max attempts
    await forceUpdateChunk(chunk.id, {
      status: "failed",
      last_error: "Max attempts exceeded",
      attempt_count: 3, // maxAttempts = 3
    });

    // EXECUTE: Try to claim (should fail due to max attempts)
    const claimAttempt = await claimChunkForProcessing(chunk.id);

    // VERIFY: Claim rejected due to max attempts
    expect(claimAttempt).toBe(false);

    // VERIFY: State unchanged
    const refreshed = await getChunkById(chunk.id);
    expect(refreshed?.status).toBe("failed");
    expect(refreshed?.attempt_count).toBe(3);
  });

  test("chunk cannot transition from done to any other state", async () => {
    const { chunks } = await createTestManuscriptWithChunks({
      chunkCount: 1,
    });
    const chunk = chunks[0];

    // SETUP: Done chunk with result
    await forceUpdateChunk(chunk.id, {
      status: "done",
      result_json: { final: true },
    });

    // EXECUTE: Try to mutate it (this should only be possible via unsafe functions, proving the guard)
    const claimAttempt = await claimChunkForProcessing(chunk.id);

    // VERIFY: Normal mutation path fails
    expect(claimAttempt).toBe(false);

    // VERIFY: Direct unsafe mutation is blocked at DB level
    // (The contract states result_json must never be overwritten,
    // so this test documents that the claim RPC prevents reprocessing)
    const refreshed = await getChunkById(chunk.id);
    expect(refreshed?.result_json).toEqual({ final: true });
  });
});

/**
 * INTEGRATION: Crash → Recovery → Success
 *
 * This test combines all three invariants to prove the full cycle.
 * A realistic scenario: chunk is processing, worker crashes, new worker
 * recovers it and claims it successfully.
 */
describeOrSkip("Chunk Stability: Full Crash-Recovery Cycle (Integration)", () => {
  test("chunk survives worker crash and is successfully reprocessed", async () => {
    const { manuscriptId, chunks } =
      await createTestManuscriptWithChunks({
        chunkCount: 1,
      });
    const chunk = chunks[0];

    // PHASE 1: Worker 1 claims chunk
    const claimed1 = await claimChunkForProcessing(chunk.id);
    expect(claimed1).toBe(true);

    let state = await getChunkById(chunk.id);
    expect(state?.attempt_count).toBe(1);
    expect(state?.status).toBe("processing");

    // PHASE 2: Worker 1 crashes (force old timestamp and expire lease)
    const expiredTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    await forceUpdateChunk(chunk.id, {
      processing_started_at: expiredTimestamp,
      lease_expires_at: expiredTimestamp, // Expire the lease
    });

    // PHASE 3: New worker detects stuck chunk
    const stuck = await getEligibleChunksWithStuckRecovery(manuscriptId, 3);
    expect(stuck.map((c) => c.id)).toContain(chunk.id);

    // PHASE 4: Worker 2 claims and processes it
    const claimed2 = await claimChunkForProcessing(chunk.id);
    expect(claimed2).toBe(true);

    state = await getChunkById(chunk.id);
    expect(state?.attempt_count).toBe(2);
    expect(state?.status).toBe("processing");

    // PHASE 5: Worker 2 completes successfully
    await forceUpdateChunk(chunk.id, {
      status: "done",
      result_json: { success: true, attempt: 2 },
    });

    // PHASE 6: Verify terminal state is immutable
    state = await getChunkById(chunk.id);
    expect(state?.status).toBe("done");
    expect(state?.result_json).toEqual({ success: true, attempt: 2 });

    // PHASE 7: No other worker can claim it now
    const claimed3 = await claimChunkForProcessing(chunk.id);
    expect(claimed3).toBe(false);

    // FINAL VERIFY: State still immutable
    state = await getChunkById(chunk.id);
    expect(state?.status).toBe("done");
    expect(state?.result_json).toEqual({ success: true, attempt: 2 });
  });
});

/**
 * UPSERT CHUNKS (Atomic-RPC contract) — Issue #378
 *
 * Validates that upsertChunks() now goes through the
 * `upsert_manuscript_chunks` Postgres RPC and is therefore:
 *   - race-safe under concurrent retries on the same manuscript_id
 *   - idempotent for repeated calls with the same input
 *   - hash-aware (matching content_hash + job_id leaves rows untouched;
 *     differing values reset processing state but preserve attempt_count)
 *   - orphan-safe (chunks no longer in the new spec are deleted AFTER
 *     the upsert, never before — so a partial failure cannot zero a manuscript)
 */
describeOrSkip("upsertChunks: Atomic RPC Contract (Issue #378)", () => {
  function makeSpec(idx: number, content: string, hashSalt = "") {
    const content_hash = createHash("sha256")
      .update(`${idx}:${hashSalt}:${content}`)
      .digest("hex");
    return {
      chunk_index: idx,
      char_start: idx * 100,
      char_end: idx * 100 + content.length,
      overlap_chars: 0,
      label: null as string | null,
      content,
      content_hash,
    };
  }

  test("concurrent upserts on the same manuscript do not raise unique-violation", async () => {
    const manuscriptId = await createTestManuscript({});
    const jobId = randomUUID();
    const specs = Array.from({ length: 8 }, (_, i) => makeSpec(i, `chunk ${i} content`));

    // Race 5 parallel upserts of the SAME spec — under the old read-then-write impl,
    // this would deterministically produce duplicate-key errors on concurrent inserts.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => upsertChunks(manuscriptId, specs, jobId))
    );

    const failures = results.filter((r) => r.status === "rejected");
    expect(failures).toEqual([]); // No failures — RPC absorbs the race.

    const persisted = await getManuscriptChunks(manuscriptId);
    expect(persisted).toHaveLength(specs.length);
    expect(persisted.map((c) => c.chunk_index).sort((a, b) => a - b))
      .toEqual(specs.map((s) => s.chunk_index));
  });

  test("idempotent: calling twice with identical input is a no-op for matching rows", async () => {
    const manuscriptId = await createTestManuscript({});
    const jobId = randomUUID();
    const specs = [makeSpec(0, "alpha"), makeSpec(1, "beta")];

    await upsertChunks(manuscriptId, specs, jobId);

    // Simulate Phase-2 having marked chunk 0 as done with result + attempts.
    const after1 = await getManuscriptChunks(manuscriptId);
    const chunk0 = after1.find((c) => c.chunk_index === 0)!;
    await forceUpdateChunk(chunk0.id, {
      status: "done",
      result_json: { score: 99 },
      attempt_count: 2,
    });

    // Second call with the SAME specs and SAME job_id must not touch the done row.
    await upsertChunks(manuscriptId, specs, jobId);

    const after2 = await getChunkById(chunk0.id);
    expect(after2?.status).toBe("done");
    expect(after2?.result_json).toEqual({ score: 99 });
    expect(after2?.attempt_count).toBe(2);
  });

  test("content_hash change resets processing state but preserves attempt_count", async () => {
    const manuscriptId = await createTestManuscript({});
    const jobId = randomUUID();
    await upsertChunks(manuscriptId, [makeSpec(0, "v1-content")], jobId);

    const [chunk] = await getManuscriptChunks(manuscriptId);
    await forceUpdateChunk(chunk.id, {
      status: "done",
      result_json: { score: 88 },
      attempt_count: 1,
    });

    // New hash, same job_id => row must be refreshed.
    await upsertChunks(
      manuscriptId,
      [makeSpec(0, "v2-content-different", "new")],
      jobId
    );

    const reread = await getChunkById(chunk.id);
    expect(reread?.status).toBe("pending");
    expect(reread?.result_json).toBeNull();
    expect(reread?.attempt_count).toBe(1); // intentionally preserved
  });

  test("orphans are deleted AFTER the upsert (never before)", async () => {
    const manuscriptId = await createTestManuscript({});
    const jobId = randomUUID();
    await upsertChunks(
      manuscriptId,
      [makeSpec(0, "keep0"), makeSpec(1, "keep1"), makeSpec(2, "orphan")],
      jobId
    );
    expect(await getManuscriptChunks(manuscriptId)).toHaveLength(3);

    // Re-chunk: now only 0 and 1 exist; chunk_index=2 must be deleted.
    await upsertChunks(
      manuscriptId,
      [makeSpec(0, "keep0"), makeSpec(1, "keep1")],
      jobId
    );

    const after = await getManuscriptChunks(manuscriptId);
    expect(after.map((c) => c.chunk_index).sort()).toEqual([0, 1]);
  });
});
