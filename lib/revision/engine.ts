import { getSupabaseAdminClient } from "@/lib/supabase";
import { applyRevisionSession } from "./apply";
import { logRevisionEvent } from "./logRevisionEvent";
import { ensureOperationalRevisionFindings } from "./operationalQueueBuilder";
import {
  createProposalsForSessionFromFindings,
  getFindingsSynthesisSummary,
} from "./proposalSynthesis";
import { transitionRevisionSessionState } from "./sessionTransitions";
import {
  createRevisionSession,
  getRevisionSessionById,
} from "./sessions";
import { checkRefinementEligibilityByEvaluationRun } from "@/lib/governance/evaluationBridge";
import {
  buildRevisionFailureRecord,
  classifyFailureDisposition,
  isKickEligible,
  resolveKickTarget,
  type ReviseStageFailureCode,
  type RevisionFailureRecordV1,
} from "./reviseFailureRecord";
import type {
  ApplyRevisionSessionResult,
  ChangeProposal,
  RevisionSession,
} from "./types";

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseAdminClient();
  }
  return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(`[REVISION-ENGINE] Supabase unavailable - cannot access .${String(prop)}`);
    }
    return client[prop as keyof typeof client];
  },
});

export type StartRevisionEngineInput = {
  evaluation_run_id: string;
};

export type StartRevisionEngineResult = {
  revision_session: RevisionSession;
  proposals: ChangeProposal[];
  findings_count?: number;
  actionable_findings_count?: number;
};

export type FinalizeRevisionEngineResult = {
  revision_session: RevisionSession;
  apply_result: ApplyRevisionSessionResult;
  failure_record?: RevisionFailureRecordV1;
};

async function getSourceVersionIdForEvaluationRun(evaluationRunId: string): Promise<string> {
  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_version_id")
    .eq("id", evaluationRunId)
    .single();

  if (error) {
    throw new Error(`getSourceVersionIdForEvaluationRun failed: ${error.message}`);
  }

  if (!data?.manuscript_version_id) {
    throw new Error(
      `Evaluation run ${evaluationRunId} is not bound to manuscript_version_id.`,
    );
  }

  return data.manuscript_version_id as string;
}

async function findExistingRevisionSessionForEvaluationRun(
  evaluationRunId: string,
): Promise<RevisionSession | null> {
  const { data, error } = await supabase
    .from("revision_sessions")
    .select("*")
    .eq("evaluation_run_id", evaluationRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`findExistingRevisionSessionForEvaluationRun failed: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    evaluation_run_id: data.evaluation_run_id,
    source_version_id: data.source_version_id,
    result_version_id: data.result_version_id,
    status: data.status,
    summary: data.summary ?? {},
    findings_count: data.findings_count ?? 0,
    actionable_findings_count: data.actionable_findings_count ?? 0,
    proposal_ready_actionable_findings_count:
      data.proposal_ready_actionable_findings_count ?? 0,
    proposals_created_count: data.proposals_created_count ?? 0,
    created_at: data.created_at,
    completed_at: data.completed_at,
    last_transition_at: data.last_transition_at ?? null,
    failure_code: data.failure_code ?? null,
    failure_message: data.failure_message ?? null,
  };
}

async function ensureRevisionSessionReadyForFinalize(
  session: RevisionSession,
): Promise<RevisionSession> {
  let currentSession = session;

  if (currentSession.status === "applied" || currentSession.status === "failed") {
    return currentSession;
  }

  const findingsSummary = await getFindingsSynthesisSummary(currentSession.evaluation_run_id);

  if (currentSession.status === "open") {
    currentSession = await transitionRevisionSessionState(currentSession.id, {
      nextStatus: "findings_ready",
      findings_count: findingsSummary.findings_count,
      actionable_findings_count: findingsSummary.actionable_findings_count,
    });
  }

  await createProposalsForSessionFromFindings(
    currentSession.id,
    currentSession.evaluation_run_id,
  );

  const refreshed = await getRevisionSessionById(currentSession.id);
  if (!refreshed) {
    throw new Error(
      `ensureRevisionSessionReadyForFinalize failed: revision session not found after synthesis: ${currentSession.id}`,
    );
  }

  return refreshed;
}

export async function startRevisionEngine(
  input: StartRevisionEngineInput,
): Promise<StartRevisionEngineResult> {
  // MANDATORY: Check governance eligibility before entering refinement path
  await checkRefinementEligibilityByEvaluationRun(supabase, input.evaluation_run_id);

  const existing = await findExistingRevisionSessionForEvaluationRun(input.evaluation_run_id);

  // `failed` is a terminal state with no valid outbound transitions; create a fresh session.
  // `failed_retryable` sessions can be re-entered — transition back to open and retry.
  if (existing && existing.status === "failed_retryable") {
    try {
      await transitionRevisionSessionState(existing.id, {
        nextStatus: "open",
        findings_count: existing.findings_count,
        actionable_findings_count: existing.actionable_findings_count,
        proposal_ready_actionable_findings_count: existing.proposal_ready_actionable_findings_count,
        proposals_created_count: existing.proposals_created_count,
      });

      void logRevisionEvent({
        revision_session_id: existing.id,
        manuscript_version_id: existing.source_version_id,
        evaluation_run_id: existing.evaluation_run_id,
        event_type: "session",
        event_code: "REVISION_SESSION_RETRY_FROM_FAILED_RETRYABLE",
        message: `Session ${existing.id} re-entered from failed_retryable. Previous failure: ${existing.failure_code}`,
        metadata: {
          previous_failure_code: existing.failure_code,
          previous_failure_message: existing.failure_message,
        },
      });
    } catch (retryError) {
      void logRevisionEvent({
        revision_session_id: existing.id,
        manuscript_version_id: existing.source_version_id,
        evaluation_run_id: existing.evaluation_run_id,
        event_type: "session",
        severity: "error",
        event_code: "REVISION_SESSION_RETRY_FAILED",
        message: retryError instanceof Error ? retryError.message : String(retryError),
      });
      // Fall through to create a new session
    }
  }

  if (existing && existing.status !== "failed" && existing.status !== "failed_retryable") {
    await ensureOperationalRevisionFindings(
      input.evaluation_run_id,
      existing.source_version_id,
    );

    const synthesisSummary = await getFindingsSynthesisSummary(input.evaluation_run_id);

    if (existing.status === "open") {
      await transitionRevisionSessionState(existing.id, {
        nextStatus: "findings_ready",
        findings_count: synthesisSummary.findings_count,
        actionable_findings_count: synthesisSummary.actionable_findings_count,
      });
    }

    const proposals = await createProposalsForSessionFromFindings(
      existing.id,
      input.evaluation_run_id,
    );

    const refreshed = (await getRevisionSessionById(existing.id)) ?? existing;

    return {
      revision_session: refreshed,
      proposals,
      findings_count: synthesisSummary.findings_count,
      actionable_findings_count: synthesisSummary.actionable_findings_count,
    };
  }

  const sourceVersionId = await getSourceVersionIdForEvaluationRun(input.evaluation_run_id);

  const revisionSession = await createRevisionSession({
    evaluation_run_id: input.evaluation_run_id,
    source_version_id: sourceVersionId,
  });

  const sourceVersion = await supabase
    .from("manuscript_versions")
    .select("id, manuscript_id")
    .eq("id", sourceVersionId)
    .maybeSingle();

  void logRevisionEvent({
    revision_session_id: revisionSession.id,
    manuscript_id: sourceVersion.data?.manuscript_id ?? null,
    manuscript_version_id: sourceVersionId,
    evaluation_run_id: input.evaluation_run_id,
    event_type: "session",
    event_code: "REVISION_SESSION_CREATED",
  });

  await ensureOperationalRevisionFindings(
    input.evaluation_run_id,
    sourceVersionId,
  );

  const synthesisSummary = await getFindingsSynthesisSummary(input.evaluation_run_id);

  await transitionRevisionSessionState(revisionSession.id, {
    nextStatus: "findings_ready",
    findings_count: synthesisSummary.findings_count,
    actionable_findings_count: synthesisSummary.actionable_findings_count,
  });

  const proposals = await createProposalsForSessionFromFindings(
    revisionSession.id,
    input.evaluation_run_id,
  );

  const readySession = await getRevisionSessionById(revisionSession.id);
  if (!readySession) {
    throw new Error(
      `startRevisionEngine failed: revision session not found after proposal synthesis: ${revisionSession.id}`,
    );
  }

  return {
    revision_session: readySession,
    proposals,
    findings_count: synthesisSummary.findings_count,
    actionable_findings_count: synthesisSummary.actionable_findings_count,
  };
}

export async function finalizeRevisionEngine(
  revisionSessionId: string,
): Promise<FinalizeRevisionEngineResult> {
  const sessionBeforeFinalize = await getRevisionSessionById(revisionSessionId);

  if (!sessionBeforeFinalize) {
    throw new Error(
      `finalizeRevisionEngine failed: revision session not found: ${revisionSessionId}`,
    );
  }

  // MANDATORY: Check governance eligibility before finalizing refinement
  // This gates access from the finalize API endpoint, preventing bypass
  await checkRefinementEligibilityByEvaluationRun(
    supabase,
    sessionBeforeFinalize.evaluation_run_id,
  );

  const readySession = await ensureRevisionSessionReadyForFinalize(
    sessionBeforeFinalize,
  );

  try {
    const applyResult = await applyRevisionSession(revisionSessionId);

    const revisionSession = await getRevisionSessionById(revisionSessionId);
    if (!revisionSession) {
      throw new Error(
        `finalizeRevisionEngine failed: revision session not found after apply: ${revisionSessionId}`,
      );
    }

    const sourceVersion = await supabase
      .from("manuscript_versions")
      .select("id, manuscript_id")
      .eq("id", revisionSession.source_version_id)
      .maybeSingle();

    void logRevisionEvent({
      revision_session_id: revisionSessionId,
      manuscript_id: sourceVersion.data?.manuscript_id ?? null,
      manuscript_version_id: revisionSession.source_version_id,
      evaluation_run_id: revisionSession.evaluation_run_id,
      event_type: "finalize",
      event_code: "REVISION_SESSION_FINALIZED",
      metadata: {
        result_version_id: applyResult.result_version_id,
        accepted_count: applyResult.accepted_count,
        modified_count: applyResult.modified_count,
      },
    });

    return {
      revision_session: revisionSession,
      apply_result: applyResult,
    };
  } catch (error) {
    const failureRecord = classifyAndRecordFailure({
      sessionId: revisionSessionId,
      stageId: 'RS10_TRUSTEDPATH',
      errorMessage: error instanceof Error ? error.message : String(error),
      fallbackCode: 'REVISION_FINALIZE_FAILED',
    });

    if (readySession && readySession.status !== "applied" && readySession.status !== "failed" && readySession.status !== "failed_retryable") {
      try {
        const nextStatus = failureRecord.disposition === 'retryable' ? 'failed_retryable' : 'failed';
        await transitionRevisionSessionState(revisionSessionId, {
          nextStatus,
          findings_count: readySession.findings_count,
          actionable_findings_count: readySession.actionable_findings_count,
          proposal_ready_actionable_findings_count:
            readySession.proposal_ready_actionable_findings_count,
          proposals_created_count: readySession.proposals_created_count,
          failure_code: failureRecord.failure_code,
          failure_message: error instanceof Error ? error.message : String(error),
        });
      } catch (transitionError) {
        console.error("Failed to persist revision session failure state", {
          revisionSessionId,
          error:
            transitionError instanceof Error
              ? transitionError.message
              : String(transitionError),
        });
      }
    }

    void logRevisionEvent({
      revision_session_id: revisionSessionId,
      manuscript_version_id: readySession?.source_version_id ?? sessionBeforeFinalize?.source_version_id ?? null,
      evaluation_run_id: readySession?.evaluation_run_id ?? sessionBeforeFinalize?.evaluation_run_id ?? null,
      event_type: "finalize",
      severity: "error",
      event_code: "REVISION_SESSION_FINALIZE_FAILED",
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        failure_record: failureRecord,
      },
    });

    throw error;
  }
}

// ─── KICK_MATRIX Wiring: Failure Classification + Recovery ────────────────────

/**
 * Map error messages to revise stage failure codes.
 * Uses the same pattern as evaluation pipeline's failureClassification.
 */
function inferReviseStageFailureCode(errorMessage: string): ReviseStageFailureCode | null {
  const lower = errorMessage.toLowerCase();

  // Ledger assembly failures
  if (lower.includes('ledger') && lower.includes('evidence')) return 'LEDGER_EVIDENCE_MISSING';
  if (lower.includes('ledger') && lower.includes('empty')) return 'LEDGER_EMPTY';
  if (lower.includes('ledger') && lower.includes('criterion')) return 'LEDGER_CRITERION_MISSING';
  if (lower.includes('ledger') && lower.includes('assembly')) return 'LEDGER_ASSEMBLY_FAILED';

  // Admission gate failures
  if (lower.includes('admission') && lower.includes('card')) return 'ADMISSION_CARD_CONTRACT_FAIL';
  if (lower.includes('admission') && lower.includes('canon')) return 'ADMISSION_CANON_GATE_FAIL';
  if (lower.includes('admission') && lower.includes('voice')) return 'ADMISSION_VOICE_GATE_FAIL';

  // Workbench failures
  if (lower.includes('anchor') && lower.includes('unresolvable')) return 'WORKBENCH_ANCHOR_UNRESOLVABLE';
  if (lower.includes('diagnostic') && lower.includes('incomplete')) return 'WORKBENCH_DIAGNOSTIC_INCOMPLETE';
  if (lower.includes('mode') && lower.includes('contract') && lower.includes('missing')) return 'WORKBENCH_MODE_CONTRACT_MISSING';
  if (lower.includes('hydration') && lower.includes('failed')) return 'WORKBENCH_HYDRATION_FAILED';

  // Candidate generation failures
  if (lower.includes('candidate') && lower.includes('voice')) return 'CANDIDATE_VOICE_GATE_FAIL';
  if (lower.includes('candidate') && lower.includes('canon')) return 'CANDIDATE_CANON_GATE_FAIL';
  if (lower.includes('candidate') && lower.includes('duplicate')) return 'CANDIDATE_DUPLICATES_ORIGINAL';
  if (lower.includes('candidate') && lower.includes('empty')) return 'CANDIDATE_EMPTY';
  if (lower.includes('candidate') && lower.includes('generation')) return 'CANDIDATE_GENERATION_FAILED';

  // Ledger sync failures
  if (lower.includes('sync') && lower.includes('validation')) return 'LEDGER_SYNC_VALIDATION_FAIL';
  if (lower.includes('sync') && lower.includes('duplicate')) return 'LEDGER_SYNC_DUPLICATE_LOCAL_ID';
  if (lower.includes('sync') && lower.includes('db')) return 'LEDGER_SYNC_DB_ERROR';

  // Completion failures
  if (lower.includes('completion') && lower.includes('premature')) return 'COMPLETION_PREMATURE';
  if (lower.includes('completion') && lower.includes('pending')) return 'COMPLETION_PENDING_SYNC';

  // Cross-check failures
  if (lower.includes('crosscheck') && lower.includes('timeout')) return 'CROSSCHECK_TIMEOUT';
  if (lower.includes('crosscheck') && lower.includes('unavailable')) return 'CROSSCHECK_UNAVAILABLE';

  // TrustedPath failures
  if (lower.includes('trustedpath') && lower.includes('ineligible')) return 'TRUSTEDPATH_INELIGIBLE_VERDICT';
  if (lower.includes('trustedpath') && lower.includes('already')) return 'TRUSTEDPATH_ALREADY_DECIDED';

  // Hydration failures
  if (lower.includes('hydration') && lower.includes('timeout')) return 'HYDRATION_TIMEOUT';
  if (lower.includes('hydration') && lower.includes('slae')) return 'HYDRATION_SLAE_REJECTION';
  if (lower.includes('hydration') && lower.includes('model')) return 'HYDRATION_MODEL_ERROR';

  return null;
}

/**
 * Classify a runtime error into a structured failure record.
 * Consults REVISE_KICK_MATRIX for kick eligibility.
 */
function classifyAndRecordFailure(input: {
  sessionId: string;
  stageId: string;
  errorMessage: string;
  fallbackCode: ReviseStageFailureCode;
  opportunityId?: string;
  attemptCount?: number;
  evidence?: string[];
}): RevisionFailureRecordV1 {
  const inferredCode = inferReviseStageFailureCode(input.errorMessage);
  const failureCode = inferredCode ?? input.fallbackCode;

  return buildRevisionFailureRecord({
    sessionId: input.sessionId,
    stageId: input.stageId,
    failureCode,
    attemptCount: input.attemptCount ?? 1,
    opportunityId: input.opportunityId ?? null,
    errorMessage: input.errorMessage,
    evidence: input.evidence,
  });
}
