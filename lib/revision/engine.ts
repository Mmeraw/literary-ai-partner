import { getSupabaseAdminClient } from "@/lib/supabase";
import { applyRevisionSession } from "./apply";
import { createDiagnosticFindingsForEvaluationRun } from "./normalizeFindings";
import {
  createProposalsForSessionFromFindings,
  getFindingsSynthesisSummary,
} from "./proposalSynthesis";
import {
  createRevisionSession,
  getRevisionSessionById,
  listProposalsForSession,
} from "./sessions";
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
    created_at: data.created_at,
    completed_at: data.completed_at,
  };
}

export async function startRevisionEngine(
  input: StartRevisionEngineInput,
): Promise<StartRevisionEngineResult> {
  const existing = await findExistingRevisionSessionForEvaluationRun(input.evaluation_run_id);

  if (existing) {
    const proposals = await listProposalsForSession(existing.id);
    return {
      revision_session: existing,
      proposals,
    };
  }

  const sourceVersionId = await getSourceVersionIdForEvaluationRun(input.evaluation_run_id);

  const revisionSession = await createRevisionSession({
    evaluation_run_id: input.evaluation_run_id,
    source_version_id: sourceVersionId,
  });

  await createDiagnosticFindingsForEvaluationRun(
    input.evaluation_run_id,
    sourceVersionId,
  );

  const synthesisSummary = await getFindingsSynthesisSummary(input.evaluation_run_id);

  const proposals = await createProposalsForSessionFromFindings(
    revisionSession.id,
    input.evaluation_run_id,
  );

  return {
    revision_session: revisionSession,
    proposals,
    findings_count: synthesisSummary.findings_count,
    actionable_findings_count: synthesisSummary.actionable_findings_count,
  };
}

export async function finalizeRevisionEngine(
  revisionSessionId: string,
): Promise<FinalizeRevisionEngineResult> {
  const applyResult = await applyRevisionSession(revisionSessionId);

  const revisionSession = await getRevisionSessionById(revisionSessionId);
  if (!revisionSession) {
    throw new Error(
      `finalizeRevisionEngine failed: revision session not found after apply: ${revisionSessionId}`,
    );
  }

  return {
    revision_session: revisionSession,
    apply_result: applyResult,
  };
}
