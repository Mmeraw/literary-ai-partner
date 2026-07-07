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
 *
 * U2-006 anchor proof note:
 *   Two independent anchor enforcement layers are collected separately:
 *
 *   Layer 1 — Pass 2 parse-time (hasTextualAnchor, runPass2.ts):
 *     Source: criteria[].evidence[].snippet + criteria[].reason_codes
 *     Effect: appends NO_TEXTUAL_ANCHOR to reason_codes[] and caps score to max 5
 *     Proof fields: u2Proof.pass2EvidenceAnchors, u2Proof.pass2CriteriaReasonCodes
 *
 *   Layer 2 — Artifact gate HOLD (validateEvaluationArtifact.ts):
 *     Source: governance.warnings / transparency.artifact_reason_codes
 *     Effect: emits EVIDENCE-MISSING-1 / INTERP-MISSING-1 as HOLD (non-blocking)
 *     Proof fields: u2Proof.artifactGate
 *
 *   Do NOT conflate these two layers. A job can pass the artifact gate while
 *   having NO_TEXTUAL_ANCHOR on individual criteria, and vice versa.
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

const firstDefined = (...values) => values.find((value) => value !== null && value !== undefined);

const uniqueNonEmptyStrings = (values) => {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

/**
 * Mirror of hasTextualAnchor() from runPass2.ts lines 1074–1088.
 * Returns true if the reasoning or any evidence snippet passes anchor
 * validation, false if NO_TEXTUAL_ANCHOR would be appended.
 *
 * Conditions (any one sufficient):
 *   A. reasoning contains quoted text ≥8 chars: /[""""][^""""]{8,}[""""]/
 *   B. any evidence snippet contains quoted text ≥8 chars (same regex)
 *   C. any evidence snippet is ≥20 chars
 */
const QUOTE_RE = /[""""][^""""]{8,}[""""]/;

function hasTextualAnchor(reasoning, evidenceSnippets) {
  if (QUOTE_RE.test(reasoning ?? "")) return true;
  for (const snippet of evidenceSnippets) {
    if (QUOTE_RE.test(snippet)) return true;
    if (snippet.length >= 20) return true;
  }
  return false;
}

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
  const transparency = governance?.transparency ?? null;

  const confidenceLabel = firstDefined(
    governance?.confidenceLabel,
    governance?.confidence_label,
    gate?.confidence?.confidence,
    null,
  );

  const confidenceReasons = firstDefined(
    governance?.confidenceReasons,
    governance?.confidence_reasons,
    gate?.confidence?.reasons,
    null,
  );

  // ── Pass 3 recommendation anchors (unchanged — kept for backward compat) ──
  // Source: criteria[].recommendations[].anchor_snippet
  // This is the Pass 3 anchor field. It is NOT the Pass 2 criterion evidence anchor.
  // Do not use this to prove RCA-U2-006 Pass 2 enforcement.
  const anchorsFromTopLevel = firstDefined(body?.evidenceAnchors, body?.evidence_anchors, null);
  const anchorsFromRecommendations = Array.isArray(body?.criteria)
    ? uniqueNonEmptyStrings(
        body.criteria.flatMap((criterion) =>
          Array.isArray(criterion?.recommendations)
            ? criterion.recommendations.map((rec) => rec?.anchor_snippet)
            : [],
        ),
      )
    : [];

  const anchors = firstDefined(
    Array.isArray(anchorsFromTopLevel) && anchorsFromTopLevel.length > 0 ? anchorsFromTopLevel : null,
    anchorsFromRecommendations.length > 0 ? anchorsFromRecommendations : null,
    null,
  );

  // ── Layer 1: Pass 2 criterion-level evidence anchors ─────────────────────
  // Source: criteria[].evidence[].snippet + criteria[].reason_codes
  // This is the correct field for RCA-U2-006 anchor enforcement proof.
  // hasTextualAnchor() fires during parsePass2Response() and may append
  // NO_TEXTUAL_ANCHOR to reason_codes[] and cap score to max 5.
  const criteriaArray = Array.isArray(body?.criteria) ? body.criteria : [];

  const pass2EvidenceAnchors = criteriaArray.map((criterion) => {
    const snippets = Array.isArray(criterion?.evidence)
      ? criterion.evidence
          .map((item) => (typeof item === "string" ? item : item?.snippet ?? ""))
          .filter((s) => s.trim().length > 0)
      : [];
    const reasoning = typeof criterion?.reasoning === "string" ? criterion.reasoning : "";
    const wouldPassAnchorCheck = hasTextualAnchor(reasoning, snippets);

    return {
      criterionId: criterion?.id ?? criterion?.criterion_id ?? null,
      criterionKey: criterion?.key ?? criterion?.criterion_key ?? null,
      score: criterion?.score ?? null,
      evidenceSnippetCount: snippets.length,
      // Lengths let the validator confirm snippets are substantive (≥20 chars)
      evidenceSnippetLengths: snippets.map((s) => s.length),
      // Verbatim snippets (first 120 chars each) for human audit
      evidenceSnippetSamples: snippets.map((s) => s.slice(0, 120)),
      // Mirror of hasTextualAnchor() result for this criterion
      wouldPassAnchorCheck,
      // reason_codes[] from the criterion — contains NO_TEXTUAL_ANCHOR if cap fired
      pass2ReasonCodes: Array.isArray(criterion?.reason_codes) ? criterion.reason_codes : [],
    };
  });

  // Summary flags for the validator
  const anyNoTextualAnchor = pass2EvidenceAnchors.some((c) =>
    c.pass2ReasonCodes.includes("NO_TEXTUAL_ANCHOR"),
  );
  const anyScoreCapped = pass2EvidenceAnchors.some(
    (c) => c.pass2ReasonCodes.includes("NO_TEXTUAL_ANCHOR") && c.score !== null && c.score <= 5,
  );
  const allCriteriaHaveEvidence = pass2EvidenceAnchors.every((c) => c.evidenceSnippetCount > 0);

  // ── Layer 2: Artifact gate HOLD reason codes ──────────────────────────────
  // Source: governance.warnings / transparency.artifact_reason_codes / gate.reason_codes
  // EVIDENCE-MISSING-1 and INTERP-MISSING-1 are HOLD codes (non-blocking).
  // They do NOT appear in gate_enforcement.reason_codes on the PASS path.
  const warningsRaw = firstDefined(
    governance?.warnings,
    transparency?.warnings,
    null,
  );
  const warningsArray = Array.isArray(warningsRaw)
    ? warningsRaw
    : typeof warningsRaw === "string"
    ? [warningsRaw]
    : [];

  // Parse HOLD reason codes from governance.warnings entries like:
  // "[ArtifactGate:HOLD] reason_codes=EVIDENCE-MISSING-1,INTERP-MISSING-1"
  const holdReasonCodesFromWarnings = warningsArray.flatMap((w) => {
    const match = typeof w === "string" ? w.match(/reason_codes=([^\]]+)/) : null;
    return match ? match[1].split(",").map((c) => c.trim()) : [];
  });

  const artifactGateReasonCodes = firstDefined(
    transparency?.artifact_reason_codes,
    holdReasonCodesFromWarnings.length > 0 ? holdReasonCodesFromWarnings : null,
    [],
  );

  const artifactGate = {
    // Did the artifact gate emit a HOLD (non-blocking)?
    holdFired: holdReasonCodesFromWarnings.length > 0 || (Array.isArray(artifactGateReasonCodes) && artifactGateReasonCodes.length > 0),
    // Reason codes from the HOLD (EVIDENCE-MISSING-1, INTERP-MISSING-1)
    reasonCodes: artifactGateReasonCodes,
    // Raw warnings for audit
    rawWarnings: warningsArray,
    // gate_enforcement.reason_codes — should be [] on PASS path (backwardRelook codes only)
    gateEnforcementReasonCodes: Array.isArray(gate?.reason_codes) ? gate.reason_codes : [],
  };

  // ── Legacy reasonCodes field (kept for backward compat with existing validator) ──
  // Sourced same as before — governance warnings / transparency / gate
  const reasonCodes = firstDefined(
    body?.reasonCodes,
    body?.reason_codes,
    transparency?.artifact_reason_codes,
    gate?.reason_codes,
    null,
  );

  const derivedPropagation = firstDefined(
    gate?.propagation,
    transparency?.propagation_summary,
    null,
  );

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

      // RCA-U2-006 Layer 1: Pass 2 parse-time anchor enforcement (hasTextualAnchor)
      // Source: criteria[].evidence[].snippet + criteria[].reason_codes
      // NO_TEXTUAL_ANCHOR appears here when the score cap fires.
      pass2EvidenceAnchors,
      pass2Summary: {
        totalCriteria: criteriaArray.length,
        allCriteriaHaveEvidence,
        anyNoTextualAnchorFired: anyNoTextualAnchor,
        anyScoreCapped,
      },

      // RCA-U2-006 Layer 2: Artifact gate HOLD (validateEvaluationArtifact)
      // EVIDENCE-MISSING-1 / INTERP-MISSING-1 are non-blocking HOLD codes.
      // They do NOT appear in gate_enforcement.reason_codes on the PASS path.
      artifactGate,

      // Legacy field: Pass 3 recommendation anchors (kept for backward compat)
      // NOT the correct field for U2-006 Pass 2 enforcement proof.
      anchors,

      // Legacy: artifact gate + gate_enforcement reason codes (kept for backward compat)
      reasonCodes,

      // Weakness propagation — must appear in gate_enforcement for U2 propagation lane
      propagation: derivedPropagation,
    },

    // Human-readable verification checklist (fill in manually after reviewing report page)
    verificationChecklist: {
      bottomWeaknessInSummary: "PENDING ❌ — set to PASS after manual report verification",
      confidenceBannerMatchesLabel: "PENDING ❌ — set to PASS after manual report verification",
      noFalseHighConfidenceAuthority: "PENDING ❌ — set to PASS after manual report verification",
      propagationPersistedInDB: derivedPropagation !== null ? "PASS" : "FAIL — propagation is null",
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

U2-006 Layer 1 — Pass 2 anchor enforcement:
  totalCriteria:             ${criteriaArray.length}
  allCriteriaHaveEvidence:   ${allCriteriaHaveEvidence}
  anyNoTextualAnchorFired:   ${anyNoTextualAnchor}
  anyScoreCapped:            ${anyScoreCapped}

U2-006 Layer 2 — Artifact gate:
  holdFired:                 ${artifactGate.holdFired}
  holdReasonCodes:           ${JSON.stringify(artifactGate.reasonCodes)}
  gateEnforcementCodes:      ${JSON.stringify(artifactGate.gateEnforcementReasonCodes)}

Manual steps remaining:
  1. Open /evaluate/${JOB_ID}/report in browser
  2. Confirm bottom weakness appears in summary
  3. Confirm confidence banner matches governance label
  4. Confirm no false high-confidence authority
  5. Set checklist fields to PASS and run: cat proof.json | node scripts/validate-u2-proof.mjs
  6. Paste full JSON proof pack into workbook row for RCA-U2-003 / RCA-U2-006
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
