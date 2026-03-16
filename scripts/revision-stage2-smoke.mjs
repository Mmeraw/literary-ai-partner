#!/usr/bin/env node
/**
 * Stage 2 Revision Smoke (internal API + DB assertions)
 *
 * Validates: start -> decide -> finalize plus immutable source version.
 *
 * Required env:
 *   EVALUATION_RUN_ID=<uuid>
 *   SUPABASE_SERVICE_ROLE_KEY=<key>
 * Optional env:
 *   SUPABASE_URL=<url> (or NEXT_PUBLIC_SUPABASE_URL)
 *   MAX_ACCEPT_PROPOSALS=<n> (default 3)
 *
 * Usage:
 *   EVALUATION_RUN_ID=<uuid> npm run revision:smoke:stage2
 */

import { createClient } from "@supabase/supabase-js";
import { getBaseUrl } from "./base-url.mjs";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

function env(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing env ${name}. Define it in .env/.env.local or export it in your shell.`,
    );
  }
  return value;
}

async function must(resPromise, msg) {
  const res = await resPromise;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let details = text;

    try {
      const parsed = JSON.parse(text);
      details = parsed?.details || parsed?.error || text;
    } catch {
      // non-JSON response body; keep raw text
    }

    throw new Error(`${msg} (status=${res.status}) ${details}`);
  }
  return res;
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

async function getLatestRevisionSessionForEvaluationRun(supabase, evaluationRunId) {
  const { data, error } = await supabase
    .from("revision_sessions")
    .select("id, status, created_at")
    .eq("evaluation_run_id", evaluationRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to inspect revision_sessions for evaluation_run_id=${evaluationRunId}: ${error.message}`,
    );
  }

  return data ?? null;
}

async function runSchemaPreflight(supabase, evaluationRunId) {
  const issues = [];

  const revisionSessionsCheck = await supabase
    .from("revision_sessions")
    .select("id")
    .limit(1);

  if (revisionSessionsCheck.error) {
    issues.push(
      `revision_sessions unavailable via Supabase API: ${revisionSessionsCheck.error.message}`,
    );
  }

  const changeProposalsCheck = await supabase
    .from("change_proposals")
    .select("id")
    .limit(1);

  if (changeProposalsCheck.error) {
    issues.push(
      `change_proposals unavailable via Supabase API: ${changeProposalsCheck.error.message}`,
    );
  }

  const diagnosticFindingsCheck = await supabase
    .from("diagnostic_findings")
    .select("id")
    .limit(1);

  if (diagnosticFindingsCheck.error) {
    issues.push(
      `diagnostic_findings unavailable via Supabase API: ${diagnosticFindingsCheck.error.message}`,
    );
  }

  const evaluationJobCheck = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id")
    .eq("id", evaluationRunId)
    .maybeSingle();

  if (evaluationJobCheck.error) {
    issues.push(
      `evaluation_jobs Stage 2 columns unavailable: ${evaluationJobCheck.error.message}`,
    );
  }

  const manuscriptVersionsCheck = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number")
    .limit(1);

  if (manuscriptVersionsCheck.error) {
    issues.push(
      `manuscript_versions unavailable via Supabase API: ${manuscriptVersionsCheck.error.message}`,
    );
  }

  if (issues.length > 0) {
    throw new Error(
      "Stage 2 schema preflight failed. The app-facing Stage 2 database/API surface is incomplete. " +
        "Apply/additive migrations, ensure evaluation_jobs.manuscript_version_id exists, reload Supabase REST schema cache, restart the dev server, then rerun.\n" +
        issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n") +
        "\n\nSuggested remediation in Supabase SQL Editor:" +
        "\n- ALTER TABLE public.evaluation_jobs ADD COLUMN IF NOT EXISTS manuscript_version_id uuid REFERENCES public.manuscript_versions(id);" +
        "\n- Apply the Stage 2 migrations if not already applied:" +
        "\n  20260315000000_add_manuscript_versions_foundation.sql" +
        "\n  20260316000000_add_revision_sessions_and_change_proposals.sql" +
        "\n  20260316010000_stage2_versions_revisions_rls.sql" +
        "\n  20260316020000_add_diagnostic_findings.sql" +
        "\n  20260316021000_diagnostic_findings_rls.sql" +
        "\n- NOTIFY pgrst, 'reload schema';" +
        "\n- Restart the local app server on port 3002.",
    );
  }
}

async function resolveEvaluationRunId(supabase) {
  const explicit = process.env.EVALUATION_RUN_ID?.trim();
  if (explicit) {
    const latestSession = await getLatestRevisionSessionForEvaluationRun(supabase, explicit);
    if (latestSession?.status === "applied") {
      throw new Error(
        `EVALUATION_RUN_ID=${explicit} already has an applied revision session (${latestSession.id}). ` +
          `Choose a different evaluation run or clear stale session/proposal rows before rerunning smoke.`,
      );
    }
    return explicit;
  }

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, created_at")
    .eq("status", "complete")
    .not("manuscript_version_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(
      "Missing env EVALUATION_RUN_ID and auto-discovery failed. " +
        `Underlying query error: ${error.message}`,
    );
  }

  const candidates = data ?? [];
  for (const candidate of candidates) {
    const latestSession = await getLatestRevisionSessionForEvaluationRun(supabase, candidate.id);
    if (!latestSession) {
      console.log(`[revision-stage2-smoke] Auto-selected EVALUATION_RUN_ID=${candidate.id}`);
      return candidate.id;
    }
  }

  if (candidates.length > 0) {
    throw new Error(
      "Missing env EVALUATION_RUN_ID and auto-discovery found only runs with existing revision sessions. " +
        "Provide EVALUATION_RUN_ID for a fresh run or clear stale revision session data.",
    );
  }

  if (!candidates.length) {
    throw new Error(
      "Missing env EVALUATION_RUN_ID and auto-discovery found no completed " +
        "evaluation_jobs with manuscript_version_id.",
    );
  }

  throw new Error("Unable to resolve EVALUATION_RUN_ID for smoke run.");
}

async function main() {
  const BASE = await getBaseUrl();
  const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const EVALUATION_RUN_ID = await resolveEvaluationRunId(supabase);

  console.log(`revision-stage2-smoke: evaluation_run_id=${EVALUATION_RUN_ID}`);
  console.log(`revision-stage2-smoke: base=${BASE}`);

  await runSchemaPreflight(supabase, EVALUATION_RUN_ID);

  // 1) Start revision session + proposals
  const startRes = await must(
    fetch(`${BASE}/api/internal/revisions/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ evaluation_run_id: EVALUATION_RUN_ID }),
    }),
    "Failed to start revision engine",
  );

  const start = await startRes.json();
  const revisionSession = start?.revision_session;
  ensure(revisionSession?.id, `Invalid start response: missing revision_session.id -> ${JSON.stringify(start)}`);
  ensure(
    revisionSession?.source_version_id,
    `Invalid start response: missing revision_session.source_version_id -> ${JSON.stringify(start)}`,
  );
  ensure(
    revisionSession?.evaluation_run_id === EVALUATION_RUN_ID,
    `Start binding mismatch: session.evaluation_run_id=${revisionSession?.evaluation_run_id} expected=${EVALUATION_RUN_ID}`,
  );

  const sourceVersionId = revisionSession.source_version_id;
  ensure(
    isUuid(sourceVersionId),
    `Invalid source version UUID from start response: ${sourceVersionId}`,
  );

  // Validate evaluation job binding and state before apply/finalize.
  const { data: evalJob, error: evalJobErr } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id")
    .eq("id", EVALUATION_RUN_ID)
    .single();

  if (evalJobErr || !evalJob) {
    throw new Error(`Failed to load evaluation job ${EVALUATION_RUN_ID}: ${evalJobErr?.message}`);
  }

  ensure(
    evalJob.status === "complete",
    `Evaluation run must be complete before revision smoke (status=${evalJob.status})`,
  );
  ensure(
    evalJob.manuscript_version_id === sourceVersionId,
    `Source binding mismatch: evaluation_jobs.manuscript_version_id=${evalJob.manuscript_version_id} expected=${sourceVersionId}`,
  );

  // Validate session persisted as expected.
  const { data: persistedSession, error: persistedSessionErr } = await supabase
    .from("revision_sessions")
    .select("id, evaluation_run_id, source_version_id, status")
    .eq("id", revisionSession.id)
    .single();

  if (persistedSessionErr || !persistedSession) {
    throw new Error(`Failed to load persisted revision session: ${persistedSessionErr?.message}`);
  }

  ensure(
    persistedSession.evaluation_run_id === EVALUATION_RUN_ID,
    `Persisted session evaluation_run_id mismatch: ${persistedSession.evaluation_run_id} != ${EVALUATION_RUN_ID}`,
  );
  ensure(
    persistedSession.source_version_id === sourceVersionId,
    `Persisted session source_version_id mismatch: ${persistedSession.source_version_id} != ${sourceVersionId}`,
  );
  ensure(
    persistedSession.status === "open",
    `Expected session status=open before finalize, got ${persistedSession.status}`,
  );

  // Proposal checks (count, session association, pre-decision validity).
  const { data: persistedProposals, error: persistedProposalsErr } = await supabase
    .from("change_proposals")
    .select("id, revision_session_id, decision, original_text, proposed_text")
    .eq("revision_session_id", revisionSession.id);

  if (persistedProposalsErr) {
    throw new Error(`Failed to load proposals for session ${revisionSession.id}: ${persistedProposalsErr.message}`);
  }

  const proposalsFromDb = persistedProposals ?? [];

  const { data: findingsRows, error: findingsErr } = await supabase
    .from("diagnostic_findings")
    .select("id, action_hint, status")
    .eq("evaluation_job_id", EVALUATION_RUN_ID)
    .eq("status", "open");

  if (findingsErr) {
    throw new Error(`Failed to load findings for evaluation run ${EVALUATION_RUN_ID}: ${findingsErr.message}`);
  }

  const findings = findingsRows ?? [];
  const actionableFindings = findings.filter((f) => f.action_hint !== "preserve");

  ensure(
    findings.length > 0,
    `No diagnostic_findings generated for evaluation_run_id=${EVALUATION_RUN_ID}. Check evaluation_artifacts -> findings normalization mapping.`,
  );

  ensure(
    actionableFindings.length > 0,
    `diagnostic_findings generated but no actionable findings for evaluation_run_id=${EVALUATION_RUN_ID}. All findings appear to be action_hint=preserve.`,
  );

  ensure(
    proposalsFromDb.length > 0,
    `No proposals generated for evaluation_run_id=${EVALUATION_RUN_ID}. Findings exist, so check diagnostic_findings -> proposal synthesis mapping.`,
  );

  for (const p of proposalsFromDb) {
    ensure(
      p.revision_session_id === revisionSession.id,
      `Proposal/session mismatch: proposal ${p.id} belongs to ${p.revision_session_id}`,
    );
    ensure(
      p.decision === null || p.decision === "accepted" || p.decision === "rejected" || p.decision === "modified",
      `Invalid proposal decision state for ${p.id}: ${String(p.decision)}`,
    );
  }

  // Snapshot source before apply (immutability assertion)
  const { data: sourceBefore, error: sourceBeforeErr } = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, raw_text")
    .eq("id", sourceVersionId)
    .single();

  if (sourceBeforeErr || !sourceBefore) {
    throw new Error(`Failed to load source version before finalize: ${sourceBeforeErr?.message}`);
  }

  // 2) Decide proposals (accept a small viable subset)
  const maxAccept = Number(process.env.MAX_ACCEPT_PROPOSALS ?? 3);
  const viable = proposalsFromDb.filter(
    (p) =>
      typeof p?.id === "string" &&
      typeof p?.original_text === "string" &&
      p.original_text.trim().length > 0 &&
      typeof p?.proposed_text === "string",
  );

  if (viable.length === 0) {
    throw new Error(
      "No viable proposals to accept (need non-empty original_text and string proposed_text). " +
        "Confirm proposal extraction maps to change_proposals.original_text/proposed_text.",
    );
  }

  const selected = viable.slice(0, Math.max(1, maxAccept));
  const selectedIds = selected.map((p) => p.id);
  const selectedWithEffectiveTextMutation = selected.filter(
    (p) => p.original_text.trim() !== p.proposed_text.trim(),
  );

  const { error: decideErr } = await supabase
    .from("change_proposals")
    .update({ decision: "accepted" })
    .eq("revision_session_id", revisionSession.id)
    .in("id", selectedIds);

  if (decideErr) {
    throw new Error(`Failed to mark proposals accepted: ${decideErr.message}`);
  }

  // 3) Finalize revision session
  const finalizeRes = await must(
    fetch(`${BASE}/api/internal/revisions/${revisionSession.id}/finalize`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }),
    "Failed to finalize revision session",
  );

  const finalized = await finalizeRes.json();
  const resultVersionId = finalized?.apply_result?.result_version_id;

  ensure(resultVersionId, `Finalize response missing result_version_id: ${JSON.stringify(finalized)}`);
  ensure(isUuid(resultVersionId), `Finalize response returned invalid result_version_id UUID: ${resultVersionId}`);

  const { data: finalizedSession, error: finalizedSessionErr } = await supabase
    .from("revision_sessions")
    .select("id, status, result_version_id")
    .eq("id", revisionSession.id)
    .single();

  if (finalizedSessionErr || !finalizedSession) {
    throw new Error(`Failed to reload finalized session ${revisionSession.id}: ${finalizedSessionErr?.message}`);
  }

  ensure(
    finalizedSession.status === "applied",
    `Finalize did not transition session to applied (status=${finalizedSession.status})`,
  );
  ensure(
    finalizedSession.result_version_id === resultVersionId,
    `Finalized session result_version_id mismatch: ${finalizedSession.result_version_id} != ${resultVersionId}`,
  );

  // 4) Assertions: lineage + immutability
  const { data: resultVersion, error: resultErr } = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, source_version_id, raw_text")
    .eq("id", resultVersionId)
    .single();

  if (resultErr || !resultVersion) {
    throw new Error(`Failed to load result version: ${resultErr?.message}`);
  }

  if (resultVersion.source_version_id !== sourceVersionId) {
    throw new Error(
      `Lineage mismatch: result.source_version_id=${resultVersion.source_version_id} expected=${sourceVersionId}`,
    );
  }

  ensure(
    resultVersion.manuscript_id === sourceBefore.manuscript_id,
    `Result manuscript mismatch: ${resultVersion.manuscript_id} != ${sourceBefore.manuscript_id}`,
  );
  ensure(
    resultVersion.version_number === sourceBefore.version_number + 1,
    `Version increment mismatch: source=${sourceBefore.version_number} result=${resultVersion.version_number}`,
  );

  const { data: sourceAfter, error: sourceAfterErr } = await supabase
    .from("manuscript_versions")
    .select("id, raw_text")
    .eq("id", sourceVersionId)
    .single();

  if (sourceAfterErr || !sourceAfter) {
    throw new Error(`Failed to load source version after finalize: ${sourceAfterErr?.message}`);
  }

  if (sourceBefore.raw_text !== sourceAfter.raw_text) {
    throw new Error("Immutability violation: source version text changed after finalize.");
  }

  if (
    selectedWithEffectiveTextMutation.length > 0 &&
    sourceBefore.raw_text === resultVersion.raw_text
  ) {
    throw new Error(
      "No textual delta in result version despite accepted proposals with effective text mutations. " +
        "Likely no-op proposals or apply mismatch.",
    );
  }

  console.log("✅ Stage 2 smoke passed");
  console.log(
    JSON.stringify(
      {
        evaluation_run_id: EVALUATION_RUN_ID,
        revision_session_id: revisionSession.id,
        accepted_proposals: selectedIds.length,
        accepted_effective_mutations: selectedWithEffectiveTextMutation.length,
        findings_generated: findings.length,
        actionable_findings: actionableFindings.length,
        proposals_generated: proposalsFromDb.length,
        source_version_id: sourceVersionId,
        result_version_id: resultVersionId,
        source_version_number: sourceBefore.version_number,
        result_version_number: resultVersion.version_number,
        source_unchanged: true,
        result_text_changed: sourceBefore.raw_text !== resultVersion.raw_text,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
