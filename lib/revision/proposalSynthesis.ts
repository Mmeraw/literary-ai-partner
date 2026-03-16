import { getSupabaseAdminClient } from "@/lib/supabase";
import { bulkCreateChangeProposals } from "./proposals";
import { listProposalsForSession } from "./sessions";
import type { ChangeProposal, CreateChangeProposalInput, ProposalAction, ProposalSeverity } from "./types";

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
): CreateChangeProposalInput[] {
  return findings
    .filter((f) => f.action_hint !== "preserve")
    .map((f, idx) => ({
      revision_session_id: revisionSessionId,
      location_ref: f.location_ref ?? `finding:${idx + 1}`,
      rule: f.criterion_key ?? f.finding_type ?? "diagnostic_finding",
            action: (f.action_hint === "replace" ? "replace" : "refine") as ProposalAction,
      original_text: f.original_text ?? f.evidence_excerpt ?? "",
      proposed_text: f.recommendation ?? f.diagnosis ?? "",
      justification: f.diagnosis,
            severity: (f.severity ?? "medium") as ProposalSeverity,
    }))
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
  const existing = await listProposalsForSession(revisionSessionId);
  if (existing.length > 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("diagnostic_findings")
    .select("*")
    .eq("evaluation_job_id", evaluationRunId)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`createProposalsForSessionFromFindings failed: ${error.message}`);
  }

  const findings = data ?? [];
  const proposalInputs = toProposalInputs(revisionSessionId, findings as any[]);
  return bulkCreateChangeProposals(proposalInputs);
}
