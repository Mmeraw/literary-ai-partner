import { getSupabaseAdminClient } from "@/lib/supabase";
import { getVersionById } from "@/lib/manuscripts/versions";
import { bulkCreateChangeProposals } from "./proposals";
import { getRevisionSessionById, listProposalsForSession } from "./sessions";
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

function normalizeForAnchorSearch(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildAnchorForSnippet(
  sourceText: string,
  snippet: string,
): {
  anchor_start: number | null;
  anchor_end: number | null;
  anchor_context: string | null;
  anchor_status: "created" | "ambiguous" | "missing";
} {
  if (!snippet || snippet.trim().length === 0) {
    return {
      anchor_start: null,
      anchor_end: null,
      anchor_context: null,
      anchor_status: "missing",
    };
  }

  const normalizedSource = normalizeForAnchorSearch(sourceText);
  const normalizedSnippet = normalizeForAnchorSearch(snippet);

  const start = normalizedSource.indexOf(normalizedSnippet);
  if (start === -1) {
    return {
      anchor_start: null,
      anchor_end: null,
      anchor_context: null,
      anchor_status: "missing",
    };
  }

  const second = normalizedSource.indexOf(
    normalizedSnippet,
    start + normalizedSnippet.length,
  );

  if (second !== -1) {
    return {
      anchor_start: null,
      anchor_end: null,
      anchor_context: null,
      anchor_status: "ambiguous",
    };
  }

  const end = start + normalizedSnippet.length;
  const contextLeft = Math.max(0, start - 80);
  const contextRight = Math.min(normalizedSource.length, end + 80);

  return {
    anchor_start: start,
    anchor_end: end,
    anchor_context: normalizedSource.slice(contextLeft, contextRight),
    anchor_status: "created",
  };
}

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

      return {
        revision_session_id: revisionSessionId,
        location_ref: f.location_ref ?? `finding:${idx + 1}`,
        rule: f.criterion_key ?? f.finding_type ?? "diagnostic_finding",
        action: (f.action_hint === "replace" ? "replace" : "refine") as ProposalAction,
        original_text: originalText,
        proposed_text: f.recommendation ?? f.diagnosis ?? "",
        justification: f.diagnosis,
        severity: (f.severity ?? "medium") as ProposalSeverity,
        anchor_start: anchor.anchor_start,
        anchor_end: anchor.anchor_end,
        anchor_context: anchor.anchor_context,
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

  const session = await getRevisionSessionById(revisionSessionId);
  if (!session) {
    throw new Error(`Revision session not found: ${revisionSessionId}`);
  }

  const sourceVersion = await getVersionById(session.source_version_id);
  const sourceText = typeof sourceVersion?.raw_text === "string" ? sourceVersion.raw_text : "";

  const findings = data ?? [];
  const proposalInputs = toProposalInputs(revisionSessionId, findings as any[], sourceText);
  return bulkCreateChangeProposals(proposalInputs as CreateChangeProposalInput[]);
}
