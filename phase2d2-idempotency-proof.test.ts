/**
 * Phase 2D-2 Idempotency Proof
 *
 * Proves:
 * - Provider call persistence is idempotent under retry
 * - Unique constraint prevents duplicate records
 * - ON CONFLICT logic handles retry gracefully
 * - Double-write produces exactly one row with stable payload
 *
 * Run: npx jest phase2d2-idempotency-proof.test.ts
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { createTestManuscript } from "./tests/test-helpers/manuscript-factory";
import type { ProviderCallRecord } from "./types/providerCalls";
import { randomUUID } from "crypto";

const supabase = getSupabaseAdminClient();
const hasSupabase = !!supabase;

const run = (hasSupabase && process.env.TEST_MODE !== 'true') ? describe : describe.skip;

run("Phase 2D-2 Idempotency", () => {
  it("prevents duplicate provider call records on retry", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await createTestManuscript({ title: "Phase2D Idempotency" });

      const { data: job, error: jobError } = await admin
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

      if (jobError || !job) {
        throw new Error(`Failed to insert test job: ${jobError?.message || "unknown"}`);
      }

      jobId = job.id;

      const callRecord: Omit<ProviderCallRecord, "job_id"> & { job_id: string } = {
        job_id: jobId,
        phase: "phase_2",
        provider: "openai",
        provider_meta_version: "2c1.v1", // Use canonical version for test
        request_meta: {
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: "test-v1",
          input_chars: 5000,
        },
        response_meta: {
          latency_ms: 1234,
          retries: 0,
          output_chars: 800,
          finish_reason: "stop",
        },
        result_envelope: {
          overview: { verdict: "accept" },
          details: {},
          metadata: { simulated: false },
          partial: false,
        },
      };

      // First write: should succeed
      const { error: insert1Error } = await admin
        .from("evaluation_provider_calls")
        .insert(callRecord);

      expect(insert1Error).toBeNull();

      // Second write: should be rejected by unique constraint
      const { error: insert2Error } = await admin
        .from("evaluation_provider_calls")
        .insert(callRecord);

      expect(insert2Error).toBeTruthy();
      expect(insert2Error?.code).toBe("23505"); // Unique violation

      // Verify only one row exists
      const { data: rows, error: selectError } = await admin
        .from("evaluation_provider_calls")
        .select("*")
        .eq("job_id", jobId)
        .eq("provider", "openai")
        .eq("phase", "phase_2");

      expect(selectError).toBeNull();
      expect(rows).toHaveLength(1);

      // Verify payload is stable (first write wins)
      expect(rows![0].provider_meta_version).toBe("2c1.v1");
      expect(rows![0].request_meta.model).toBe("gpt-4o-mini");
      expect(rows![0].response_meta.latency_ms).toBe(1234);
    } finally {
      if (jobId) {
        await admin.from("evaluation_provider_calls").delete().eq("job_id", jobId);
        await admin.from("evaluation_jobs").delete().eq("id", jobId);
      }
      if (manuscriptId) {
        await admin.from("manuscripts").delete().eq("id", manuscriptId);
      }
    }
  });

  it("allows ON CONFLICT DO UPDATE to handle retry gracefully", async () => {
    const admin = supabase!;

    let jobId: string | null = null;
    let manuscriptId: number | null = null;

    try {
      manuscriptId = await createTestManuscript({ title: "Phase2D Idempotency Update" });

      const { data: job, error: jobError } = await admin
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

      if (jobError || !job) {
        throw new Error(`Failed to insert test job: ${jobError?.message || "unknown"}`);
      }

      jobId = job.id;

      const callRecord1 = {
        job_id: jobId,
        phase: "phase_2",
        provider: "openai",
        provider_meta_version: "2c1.v1",
        request_meta: {
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_output_tokens: 1200,
          prompt_version: "test-v1",
          input_chars: 5000,
        },
        response_meta: {
          latency_ms: 1000,
          retries: 0,
        },
        result_envelope: { overview: { verdict: "accept" }, partial: false },
      };

      // First write
      await admin.from("evaluation_provider_calls").insert(callRecord1);

      // Second write with updated payload (simulates retry with new metadata)
      const callRecord2 = {
        ...callRecord1,
        response_meta: {
          latency_ms: 2000,
          retries: 1,
        },
      };

      // Use upsert pattern (insert with ON CONFLICT DO UPDATE semantics)
      const { error: upsertError } = await admin
        .from("evaluation_provider_calls")
        .upsert(callRecord2, {
          onConflict: "job_id,provider,phase",
          ignoreDuplicates: false,
        });

      expect(upsertError).toBeNull();

      // Verify only one row exists with updated payload
      const { data: rows, error: selectError } = await admin
        .from("evaluation_provider_calls")
        .select("*")
        .eq("job_id", jobId);

      expect(selectError).toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows![0].provider_meta_version).toBe("2c1.v1");
      expect(rows![0].response_meta.latency_ms).toBe(2000);
      expect(rows![0].response_meta.retries).toBe(1);
    } finally {
      if (jobId) {
        await admin.from("evaluation_provider_calls").delete().eq("job_id", jobId);
        await admin.from("evaluation_jobs").delete().eq("id", jobId);
      }
      if (manuscriptId) {
        await admin.from("manuscripts").delete().eq("id", manuscriptId);
      }
    }
  });
});
