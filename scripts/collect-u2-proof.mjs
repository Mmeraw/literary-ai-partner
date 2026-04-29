#!/usr/bin/env node
/**
 * U2 Production Proof Collection Script
 *
 * RCA context: RCA-U2-003, RCA-U2-006 — confidence derivation and evidence-anchor
 * enforcement require live production proof from a real /api/jobs run.
 *
 * Usage:
 *   PROOF_JOB_ID=<jobId> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_KEY=<service_role_key> \
 *   node scripts/collect-u2-proof.mjs
 *
 * Output: JSON proof pack to stdout. Pipe to a file for workbook evidence:
 *   ... | tee u2-proof-$(date +%Y%m%dT%H%M%S).json
 *
 * Prerequisites:
 *   - RCA-PASS1-TOKEN-001 patch deployed (Pass1 uses reliable JSON model in prod)
 *   - E2E-12 / E2E-04 regressions green
 *   - Pass1 patch PR merged and deployed to production
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JOB_ID = process.env.PROOF_JOB_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.");
  process.exit(1);
}
if (!JOB_ID) {
  console.error("Error: PROOF_JOB_ID must be set to the job id returned by /api/jobs.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  // ── 1. Job row ────────────────────────────────────────────────────────────
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id,status,progress,claimed_by,lease_until,created_at,updated_at")
    .eq("id", JOB_ID)
    .single();

  if (jobError) {
    console.error(`Job fetch failed: ${jobError.message}`);
    process.exit(1);
  }

  const progress = job.progress ?? {};
  const gate = progress.gate_enforcement ?? null;
  const propagation = gate?.propagation ?? null;

  // ── 2. Artifact row ───────────────────────────────────────────────────────
  const { data: artifact, error: artifactError } = await supabase
    .from("evaluation_artifacts")
    .select("id,artifact_type,artifact_version,content,created_at")
    .eq("job_id", JOB_ID)
    .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1", "evaluationresultv2", "evaluationresultv1"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (artifactError) {
    console.error(`Artifact fetch failed: ${artifactError.message}`);
    process.exit(1);
  }

  const artifactRow = Array.isArray(artifact) ? artifact[0] ?? null : artifact;
  const body = artifactRow?.content ?? null;
  const governance = body?.governance ?? null;
  const confidenceLabel = governance?.confidenceLabel ?? null;
  const confidenceReasons = governance?.confidenceReasons ?? null;
  const anchors = body?.evidenceAnchors ?? null;
  const reasonCodes = body?.reasonCodes ?? null;

  // ── 3. Assemble proof pack ────────────────────────────────────────────────
  const proof = {
    collectedAt: new Date().toISOString(),
    jobId: JOB_ID,

    job: {
      id: job.id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      claimedBy: job.claimed_by ?? null,
      leaseUntil: job.lease_until ?? null,
      progress: {
        gate_enforcement: gate,
      },
    },

    artifact: artifactRow
      ? {
          id: artifactRow.id,
          type: artifactRow.artifact_type,
          version: artifactRow.artifact_version,
          createdAt: artifactRow.created_at,
        }
      : null,

    u2Proof: {
      // RCA-U2-003: confidence derivation — label and reasons must be non-null and deterministic
      confidenceLabel,
      confidenceReasons,

      // RCA-U2-006: evidence-anchor enforcement — anchors and reason codes incl. NOTEXTUALANCHOR
      anchors,
      reasonCodes,

      // Weakness propagation — must appear in gate_enforcement for U2 propagation lane
      propagation,
    },

    // Human-readable verification checklist (fill in manually after reviewing report page)
    verificationChecklist: {
      bottomWeaknessInSummary: "PENDING — check /evaluate/<jobId>/report manually",
      confidenceBannerMatchesLabel: "PENDING — verify banner shows mixed/constrained when label is weak",
      noFalseHighConfidenceAuthority: "PENDING — confirm no 'High' badge when governance label is weak/mixed",
      propagationPersistedInDB: propagation !== null ? "PASS" : "FAIL — propagation is null",
    },
  };

  console.log(JSON.stringify(proof, null, 2));

  // ── 4. Quick summary to stderr ────────────────────────────────────────────
  const ok = (v) => v !== null && v !== undefined;
  process.stderr.write(`
U2 Proof Summary
────────────────
Job status:         ${job.status}
Artifact present:   ${artifactRow ? "YES" : "NO"}
confidenceLabel:    ${ok(confidenceLabel) ? confidenceLabel : "MISSING ❌"}
confidenceReasons:  ${ok(confidenceReasons) ? "present" : "MISSING ❌"}
propagation:        ${ok(propagation) ? "present" : "MISSING ❌"}
anchors:            ${ok(anchors) ? "present" : "MISSING ❌"}
reasonCodes:        ${ok(reasonCodes) ? "present" : "MISSING ❌"}

Manual steps remaining:
  1. Open /evaluate/${JOB_ID}/report in browser
  2. Confirm bottom weakness appears in summary
  3. Confirm confidence banner matches governance label
  4. Confirm no false high-confidence authority
  5. Paste full JSON proof pack into workbook row for RCA-U2-003 / RCA-U2-006
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
