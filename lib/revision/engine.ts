import { getSupabaseAdminClient } from "@/lib/supabase";
import { applyRevisionSession } from "./apply";
import { logRevisionEvent } from "./logRevisionEvent";
import { createDiagnosticFindingsForEvaluationRun } from "./normalizeFindings";
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
  if (existing && existing.status !== "failed") {
    await createDiagnosticFindingsForEvaluationRun(
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

  await createDiagnosticFindingsForEvaluationRun(
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
  const readySession = sessionBeforeFinalize
    ? await ensureRevisionSessionReadyForFinalize(sessionBeforeFinalize)
    : null;

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
    if (readySession && readySession.status !== "applied" && readySession.status !== "failed") {
      try {
        await transitionRevisionSessionState(revisionSessionId, {
          nextStatus: "failed",
          findings_count: readySession.findings_count,
          actionable_findings_count: readySession.actionable_findings_count,
          proposal_ready_actionable_findings_count:
            readySession.proposal_ready_actionable_findings_count,
          proposals_created_count: readySession.proposals_created_count,
          failure_code: "REVISION_FINALIZE_FAILED",
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
    });

    throw error;
  }
}
