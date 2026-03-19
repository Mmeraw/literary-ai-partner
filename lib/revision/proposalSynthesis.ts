import { getSupabaseAdminClient } from "@/lib/supabase";
import { getVersionById } from "@/lib/manuscripts/versions";
import { logRevisionEvent } from "./logRevisionEvent";
import { transitionRevisionSessionState } from "./sessionTransitions";
import { bulkCreateChangeProposals } from "./proposals";
import { getRevisionSessionById, listProposalsForSession } from "./sessions";
import { buildAnchorForSnippet, validateAnchorAgainstSource, validateExtractionContract } from "./anchorContract";
import type {
  ChangeProposal,
  CreateChangeProposalInput,
  ProposalAction,
  ProposalSeverity,
} from "./types";

type ProposalInputWithAnchorStatus = CreateChangeProposalInput & {
  _anchor_status?: "created" | "ambiguous" | "missing";
};

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
      throw new Error(
        `[REVISION-SYNTHESIS] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function toProposalInputs(
  revisionSessionId: string,
  findings: any[],
  sourceText: string,
): ProposalInputWithAnchorStatus[] {
  return findings
    .filter((f) => f.action_hint !== "preserve")
    .map((f, idx) => {
      const originalText = f.original_text ?? f.evidence_excerpt ?? "";
      const anchor = buildAnchorForSnippet(sourceText, originalText);

      if (anchor.anchor_status !== "created") {
        throw new Error(
          `Anchor generation failed for finding ${idx + 1} (${f.location_ref ?? "unknown"}): ${anchor.reason}`,
        );
      }

      validateAnchorAgainstSource(anchor, sourceText, originalText);

      validateExtractionContract(
        { start_offset: anchor.start_offset, end_offset: anchor.end_offset, original_text: originalText },
        sourceText,
      );

      return {
        revision_session_id: revisionSessionId,
        location_ref: f.location_ref ?? `finding:${idx + 1}`,
        rule: f.criterion_key ?? f.finding_type ?? "diagnostic_finding",
        action: (f.action_hint === "replace" ? "replace" : "refine") as ProposalAction,
        original_text: originalText,
        proposed_text: f.recommendation ?? f.diagnosis ?? "",
        justification: f.diagnosis,
        severity: (f.severity ?? "medium") as ProposalSeverity,
        start_offset: anchor.start_offset,
        end_offset: anchor.end_offset,
        before_context: anchor.before_context,
        after_context: anchor.after_context,
        anchor_text_normalized: anchor.anchor_text_normalized ?? null,
        _anchor_status: anchor.anchor_status,
      };
    })
    .filter(
      (input) =>
        input.original_text.trim().length > 0 &&
        input.proposed_text.trim().length > 0 &&
        input.justification.trim().length > 0,
    );
}

export async function getFindingsSynthesisSummary(evaluationRunId: string): Promise<{
  findings_count: number;
  actionable_findings_count: number;
}> {
  const { data, error } = await supabase
    .from("diagnostic_findings")
    .select("id, action_hint")
    .eq("evaluation_job_id", evaluationRunId)
    .eq("status", "open");

  if (error) {
    throw new Error(`getFindingsSynthesisSummary failed: ${error.message}`);
  }

  const findings = data ?? [];
  const actionable = findings.filter((f: any) => f.action_hint !== "preserve");

  return {
    findings_count: findings.length,
    actionable_findings_count: actionable.length,
  };
}

export async function createProposalsForSessionFromFindings(
  revisionSessionId: string,
  evaluationRunId: string,
): Promise<ChangeProposal[]> {
  const { data, error } = await supabase
    .from("diagnostic_findings")
    .select("*")
    .eq("evaluation_job_id", evaluationRunId)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`createProposalsForSessionFromFindings failed: ${error.message}`);
  }

  const session = await getRevisionSessionById(revisionSessionId);
  if (!session) {
    throw new Error(`Revision session not found: ${revisionSessionId}`);
  }

  const sourceVersion = await getVersionById(session.source_version_id);
  const sourceText = typeof sourceVersion?.raw_text === "string" ? sourceVersion.raw_text : "";

  const findings = data ?? [];
  const actionableFindings = findings.filter((f: any) => f.action_hint !== "preserve");
  const proposalReadyActionableFindings = actionableFindings.filter(
    (f: any) => typeof f?.original_text === "string" && f.original_text.trim().length > 0,
  );

  let currentSession = session;
  if (currentSession.status === "open") {
    currentSession = await transitionRevisionSessionState(revisionSessionId, {
      nextStatus: "findings_ready",
      findings_count: findings.length,
      actionable_findings_count: actionableFindings.length,
      proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
    });
  }

  const existing = await listProposalsForSession(revisionSessionId);
  if (existing.length > 0) {
    if (currentSession.status === "findings_ready") {
      currentSession = await transitionRevisionSessionState(revisionSessionId, {
        nextStatus: "synthesis_started",
        findings_count: findings.length,
        actionable_findings_count: actionableFindings.length,
        proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
      });
    }

    if (currentSession.status === "synthesis_started") {
      await transitionRevisionSessionState(revisionSessionId, {
        nextStatus: "proposals_ready",
        findings_count: findings.length,
        actionable_findings_count: actionableFindings.length,
        proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
        proposals_created_count: existing.length,
      });
    }

    return existing;
  }

  if (currentSession.status === "findings_ready") {
    currentSession = await transitionRevisionSessionState(revisionSessionId, {
      nextStatus: "synthesis_started",
      findings_count: findings.length,
      actionable_findings_count: actionableFindings.length,
      proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
    });
  }

  void logRevisionEvent({
    revision_session_id: revisionSessionId,
    manuscript_id: sourceVersion?.manuscript_id ?? null,
    manuscript_version_id: session.source_version_id,
    evaluation_run_id: evaluationRunId,
    event_type: "proposal",
    event_code: "PROPOSAL_SYNTHESIS_STARTED",
    metadata: {
      findings_count: findings.length,
      actionable_findings_count: actionableFindings.length,
      proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
    },
  });

  const proposalInputs = toProposalInputs(revisionSessionId, findings as any[], sourceText);
  const created = await bulkCreateChangeProposals(
    proposalInputs as CreateChangeProposalInput[],
  );

  void logRevisionEvent({
    revision_session_id: revisionSessionId,
    manuscript_id: sourceVersion?.manuscript_id ?? null,
    manuscript_version_id: session.source_version_id,
    evaluation_run_id: evaluationRunId,
    event_type: "proposal",
    event_code: "PROPOSAL_SYNTHESIS_COMPLETED",
    metadata: {
      findings_count: findings.length,
      actionable_findings_count: actionableFindings.length,
      proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
      proposals_input_count: proposalInputs.length,
      proposals_created_count: created.length,
    },
  });

  await transitionRevisionSessionState(revisionSessionId, {
    nextStatus: "proposals_ready",
    findings_count: findings.length,
    actionable_findings_count: actionableFindings.length,
    proposal_ready_actionable_findings_count: proposalReadyActionableFindings.length,
    proposals_created_count: created.length,
  });

  return created;
}
