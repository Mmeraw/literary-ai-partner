#!/usr/bin/env node
/**
 * Post-PR-#265 authority-cap proof run.
 *
 * Bypasses the /api/jobs HTTP path and writes a manuscript + evaluation_jobs row
 * directly via service-role, then polls until terminal and validates artifact gates.
 *
 * Strict success gate (all four must pass to declare PR-003 unblocked):
 *   1) FINAL_STATUS=complete
 *   2) ARTIFACT_ROW_COUNT >= 1
 *   3) evaluation_result_v2 artifact present
 *   4) score_adjustments contains AUTHORITY_CAP_APPLIED reason code
 *
 * Run:
 *   DOTENV_CONFIG_PATH=.env.local node -r dotenv/config \
 *     scripts/post265-authority-cap-proof.mjs
 *
 * Note:
 *   /tmp/post265-authority-cap-proof.json is written only after Gate 3 succeeds.
 *   If Gate 1 or Gate 2 fails, no JSON proof file is guaranteed.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_ID = process.env.PROOF_RUN_USER_ID || "37d4bebd-9b90-4b5d-bf94-d5504cc43743";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "FATAL: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
  );
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const LOW_AUTHORITY_TEXT = `Mara walked the outer road before sunrise, repeating partial plans to herself as if repetition might become conviction. She listed options in her notebook but gave each option the same weight, so no decision could dominate. A courier passed and warned of pressure in the city center, then admitted his warning came from hearsay and not direct witness. At the bridge, guards argued over procedure, each speaking with certainty and then retreating to conditional language that softened every claim.

In the market district, shop owners described shortages, then corrected themselves, then added new caveats. Nothing was stable long enough to trust. Mara asked for dates and names and got gestures toward groups rather than people. She asked for outcomes and got predictions instead of records. A clerk in the archive brought out ledgers organized by category but sparse on causality. Actions were logged; accountability was diffuse.

By afternoon, Mara noticed every conversation ended with advice to wait. Wait for clearer signals. Wait for formal instruction. Wait until someone else accepts risk first. She gathered the notes anyway, because incomplete notes were still better than confidence without evidence. At dusk she reviewed the pages: many observations, little pressure, weak linkage between event and consequence. She closed the notebook knowing she had mapped uncertainty more than she had reduced it.`;

const POLL_INTERVAL_MS = 10_000;
const POLL_DEADLINE_MS = 15 * 60_000;

function fail(stage, message, extra = {}) {
  console.error(`\nGATE_FAIL stage=${stage} reason=${message}`);
  for (const [key, value] of Object.entries(extra)) {
    console.error(`  ${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
  process.exit(1);
}

async function main() {
  console.log(
    `[preflight] supabase_url=${SUPABASE_URL.replace(/^https?:\/\//, "").slice(0, 40)}...`,
  );
  console.log(`[preflight] owner_id=${OWNER_ID}`);

  const wordCount = LOW_AUTHORITY_TEXT.split(/\s+/).filter(Boolean).length;
  console.log(`[preflight] sample_words=${wordCount}`);
  if (wordCount < 200) {
    fail("preflight", `sample too short: ${wordCount}`);
  }

  const manuscriptInsert = await sb
    .from("manuscripts")
    .insert({
      title: `Post-#265 Authority Cap Proof ${new Date().toISOString()}`,
      created_by: OWNER_ID,
      user_id: OWNER_ID,
      word_count: wordCount,
      file_url: `data:text/plain;charset=utf-8,${encodeURIComponent(LOW_AUTHORITY_TEXT)}`,
      work_type: "novel",
    })
    .select("id")
    .single();

  if (manuscriptInsert.error) {
    fail("insert_manuscript", manuscriptInsert.error.message);
  }

  const manuscriptId = manuscriptInsert.data.id;
  console.log(`MANUSCRIPT_ID=${manuscriptId}`);

  const jobInsert = await sb
    .from("evaluation_jobs")
    .insert({
      manuscript_id: manuscriptId,
      user_id: OWNER_ID,
      job_type: "quick_evaluation",
      status: "queued",
      phase: "phase_1",
      phase_status: "queued",
      validity_status: "pending",
      progress: {
        phase: "phase_1",
        phase_status: "queued",
        message: "post-#265 authority-cap proof job created",
      },
      policy_family: "standard",
      voice_preservation_level: "balanced",
      english_variant: "us",
      work_type: "novel",
    })
    .select("id")
    .single();

  if (jobInsert.error) {
    fail("insert_job", jobInsert.error.message);
  }

  const jobId = jobInsert.data.id;
  console.log(`JOB_ID=${jobId}`);

  const deadline = Date.now() + POLL_DEADLINE_MS;
  let finalJob = null;
  let lastHeartbeat = null;

  while (Date.now() < deadline) {
    const poll = await sb
      .from("evaluation_jobs")
      .select(
        "id,status,phase,phase_status,last_error,failure_code,progress,last_heartbeat_at,updated_at",
      )
      .eq("id", jobId)
      .single();

    if (poll.error) {
      fail("poll", poll.error.message);
    }

    finalJob = poll.data;
    const heartbeat = finalJob.progress?.last_heartbeat_at || finalJob.last_heartbeat_at || "";
    const heartbeatDelta = lastHeartbeat && heartbeat && heartbeat !== lastHeartbeat ? " hb_advanced" : "";
    lastHeartbeat = heartbeat;

    console.log(
      `[poll] status=${finalJob.status} phase=${finalJob.phase} phase_status=${finalJob.phase_status} hb=${heartbeat}${heartbeatDelta} msg=${finalJob.progress?.message || ""}`,
    );

    if (finalJob.status === "complete" || finalJob.status === "failed") {
      break;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (!finalJob || (finalJob.status !== "complete" && finalJob.status !== "failed")) {
    fail("poll_timeout", "job did not reach terminal state in 15min", { jobId });
  }

  if (finalJob.status !== "complete") {
    fail("gate_1_status", `expected complete, got ${finalJob.status}`, {
      jobId,
      last_error: finalJob.last_error,
      failure_code: finalJob.failure_code,
      progress: finalJob.progress,
    });
  }
  console.log("GATE_1_PASS  FINAL_STATUS=complete");

  const artifactsResult = await sb
    .from("evaluation_artifacts")
    .select("id,artifact_type,content,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (artifactsResult.error) {
    fail("artifact_fetch", artifactsResult.error.message);
  }

  const rows = artifactsResult.data || [];
  console.log(`ARTIFACT_ROW_COUNT=${rows.length}`);

  if (rows.length < 1) {
    fail("gate_2_artifact_count", "no evaluation_artifacts persisted", { jobId });
  }
  console.log(`GATE_2_PASS  ARTIFACT_ROW_COUNT=${rows.length}`);

  const v2 = rows.find((row) => row.artifact_type === "evaluation_result_v2");
  if (!v2 || !v2.content) {
    fail("gate_3_result_v2_missing", "no evaluation_result_v2 artifact found", {
      jobId,
      artifact_types: rows.map((row) => row.artifact_type),
    });
  }
  console.log(`GATE_3_PASS  evaluation_result_v2 artifact_id=${v2.id}`);

  const content = v2.content;
  const adjustments = Array.isArray(content?.score_adjustments) ? content.score_adjustments : [];
  const capAdjustment = adjustments.find((entry) => entry && entry.reason === "AUTHORITY_CAP_APPLIED");

  const projection = {
    job_id: jobId,
    manuscript_id: manuscriptId,
    final_status: finalJob.status,
    overall_score:
      content?.overall?.overall_score_0_100 ?? content?.overview?.overall_score_0_100 ?? null,
    score_adjustments: adjustments,
    has_authority_cap_applied: Boolean(capAdjustment),
    artifact_id: v2.id,
    artifact_created_at: v2.created_at,
  };

  writeFileSync("/tmp/post265-authority-cap-proof.json", JSON.stringify(projection, null, 2));
  console.log("PROOF_JSON=/tmp/post265-authority-cap-proof.json");
  console.log(`SCORE_ADJUSTMENTS_COUNT=${adjustments.length}`);
  console.log(`HAS_AUTHORITY_CAP_APPLIED=${projection.has_authority_cap_applied}`);

  if (!capAdjustment) {
    fail("gate_4_cap_missing", "AUTHORITY_CAP_APPLIED not found in score_adjustments", {
      reasons_seen: adjustments.map((entry) => entry?.reason).filter(Boolean),
      adjustments_sample: adjustments.slice(0, 3),
    });
  }
  console.log("GATE_4_PASS  AUTHORITY_CAP_APPLIED present");

  console.log("\nALL_GATES_PASS  PR-003 unblocking criteria met. Issue #263 can be legitimately closed.");
}

main().catch((error) => {
  console.error(`\nFATAL ${error instanceof Error ? error.message : String(error)}`);
  if (error?.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
