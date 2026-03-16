import { getSupabaseAdminClient } from "@/lib/supabase";
import { listProposalsForSession } from "./sessions";
import type {
  ChangeProposal,
  CreateChangeProposalInput,
  EvaluationProposalCandidate,
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
      throw new Error(
        `[REVISION-PROPOSALS] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function mapChangeProposal(row: any): ChangeProposal {
  return {
    id: row.id,
    revision_session_id: row.revision_session_id,
    location_ref: row.location_ref,
    rule: row.rule,
    action: row.action,
    original_text: row.original_text,
    proposed_text: row.proposed_text,
    justification: row.justification,
    severity: row.severity,
    decision: row.decision,
    modified_text: row.modified_text,
    created_at: row.created_at,
  };
}

function cleanSnippet(text: string | null | undefined): string {
  if (!text) return "";

  return String(text)
    .replace(/^\s*\.\.\.\s*/g, "")
    .replace(/\s*\.\.\.\s*$/g, "")
    .replace(/^\s*\.\s*/g, "")
    .replace(/\s*\.\s*$/g, "")
    .trim();
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function getCriterionEvidenceSnippet(criterion: any): string {
  const evidence = criterion?.evidence;

  if (Array.isArray(evidence)) {
    for (const entry of evidence) {
      if (typeof entry === "string") {
        const cleaned = cleanSnippet(entry);
        if (cleaned) return cleaned;
      }

      if (entry && typeof entry === "object") {
        const candidate = firstNonEmptyString(
          entry.snippet,
          entry.text,
          entry.quote,
          entry.evidence_snippet,
        );

        const cleaned = cleanSnippet(candidate);
        if (cleaned) return cleaned;
      }
    }
  }

  if (typeof evidence === "string") {
    return cleanSnippet(evidence);
  }

  if (evidence && typeof evidence === "object") {
    return cleanSnippet(
      firstNonEmptyString(evidence.snippet, evidence.text, evidence.quote),
    );
  }

  return "";
}

export async function createChangeProposal(
  input: CreateChangeProposalInput,
): Promise<ChangeProposal> {
  const { data, error } = await supabase
    .from("change_proposals")
    .insert({
      revision_session_id: input.revision_session_id,
      location_ref: input.location_ref,
      rule: input.rule,
      action: input.action,
      original_text: input.original_text,
      proposed_text: input.proposed_text,
      justification: input.justification,
      severity: input.severity,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createChangeProposal failed: ${error.message}`);
  }

  return mapChangeProposal(data);
}

export async function bulkCreateChangeProposals(
  inputs: CreateChangeProposalInput[],
): Promise<ChangeProposal[]> {
  if (inputs.length === 0) return [];

  const payload = inputs.map((input) => ({
    revision_session_id: input.revision_session_id,
    location_ref: input.location_ref,
    rule: input.rule,
    action: input.action,
    original_text: input.original_text,
    proposed_text: input.proposed_text,
    justification: input.justification,
    severity: input.severity,
  }));

  const { data, error } = await supabase
    .from("change_proposals")
    .insert(payload)
    .select("*");

  if (error) {
    throw new Error(`bulkCreateChangeProposals failed: ${error.message}`);
  }

  return (data ?? []).map(mapChangeProposal);
}

export async function getProposalById(proposalId: string): Promise<ChangeProposal | null> {
  const { data, error } = await supabase
    .from("change_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    throw new Error(`getProposalById failed: ${error.message}`);
  }

  return data ? mapChangeProposal(data) : null;
}

export async function deleteProposalsForSession(revisionSessionId: string): Promise<void> {
  const { error } = await supabase
    .from("change_proposals")
    .delete()
    .eq("revision_session_id", revisionSessionId);

  if (error) {
    throw new Error(`deleteProposalsForSession failed: ${error.message}`);
  }
}

export function normalizeProposalCandidates(
  revisionSessionId: string,
  candidates: EvaluationProposalCandidate[],
): CreateChangeProposalInput[] {
  return candidates
    .filter((candidate) => {
      return Boolean(
        candidate.original_text && candidate.proposed_text && candidate.justification,
      );
    })
    .map((candidate, index) => ({
      revision_session_id: revisionSessionId,
      location_ref: candidate.location_ref ?? `unknown:${index + 1}`,
      rule: candidate.rule ?? "unspecified_rule",
      action: candidate.action ?? "refine",
      original_text: candidate.original_text ?? "",
      proposed_text: candidate.proposed_text ?? "",
      justification: candidate.justification ?? "",
      severity: candidate.severity ?? "medium",
    }));
}

export async function buildProposalsFromEvaluationArtifacts(
  evaluationRunId: string,
): Promise<EvaluationProposalCandidate[]> {
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("artifact_type, content")
    .eq("job_id", evaluationRunId)
    .eq("artifact_type", "evaluation_result_v1");

  if (error) {
    throw new Error(`buildProposalsFromEvaluationArtifacts failed: ${error.message}`);
  }

  const rows = data ?? [];
  const candidates: EvaluationProposalCandidate[] = [];

  for (const row of rows as any[]) {
    const payload = row.content ?? {};

    const fromCriteria = Array.isArray(payload?.criteria)
      ? payload.criteria.flatMap((criterion: any, cIdx: number) => {
          const recommendations = Array.isArray(criterion?.recommendations)
            ? criterion.recommendations
            : [];

          const criterionEvidenceSnippet = getCriterionEvidenceSnippet(criterion);

          return recommendations.map((rec: any, rIdx: number) => ({
            location_ref:
              rec?.location_ref ??
              `${criterion?.key ?? "criterion"}:${cIdx + 1}:rec:${rIdx + 1}`,
            rule: criterion?.key ?? "criterion_recommendation",
            action: "refine" as const,
            original_text: cleanSnippet(
              firstNonEmptyString(
                rec?.original_text,
                rec?.originalText,
                rec?.evidence_snippet,
                rec?.evidenceSnippet,
                rec?.snippet,
                criterionEvidenceSnippet,
              ),
            ),
            proposed_text: firstNonEmptyString(
              rec?.proposed_text,
              rec?.proposedText,
              rec?.replacement,
              rec?.action,
            ),
            justification: firstNonEmptyString(
              rec?.justification,
              rec?.expected_impact,
              rec?.expectedImpact,
              rec?.why,
              criterion?.rationale,
            ),
            severity: rec?.priority === "high" ? "high" : rec?.priority === "low" ? "low" : "medium",
          }));
        })
      : [];

    const fromTopLevelRecommendations = Array.isArray(payload?.recommendations)
      ? payload.recommendations.map((item: any, idx: number) => ({
          location_ref: item?.location_ref ?? item?.locationRef ?? `recommendation:${idx + 1}`,
          rule: item?.rule ?? item?.criterion ?? "recommendation",
          action: item?.action_type ?? item?.action ?? "refine",
          original_text: cleanSnippet(
            firstNonEmptyString(
              item?.original_text,
              item?.originalText,
              item?.evidence_snippet,
              item?.evidenceSnippet,
              item?.snippet,
              item?.quote,
            ),
          ),
          proposed_text: firstNonEmptyString(
            item?.proposed_text,
            item?.proposedText,
            item?.replacement,
            item?.action,
          ),
          justification: firstNonEmptyString(
            item?.justification,
            item?.expected_impact,
            item?.expectedImpact,
            item?.reason,
            item?.why,
          ),
          severity: item?.priority === "high" ? "high" : item?.priority === "low" ? "low" : "medium",
        }))
      : [];

    const fromTopLevelSuggestions = Array.isArray(payload?.suggestions)
      ? payload.suggestions.map((item: any, idx: number) => ({
          location_ref: item?.locationRef ?? item?.location_ref ?? `suggestion:${idx + 1}`,
          rule: item?.rule ?? item?.ruleName ?? "suggestion",
          action: item?.action ?? "refine",
          original_text: item?.originalText ?? item?.original_text ?? "",
          proposed_text: item?.proposedText ?? item?.proposed_text ?? "",
          justification: item?.justification ?? item?.reason ?? "",
          severity: item?.severity ?? "medium",
        }))
      : [];

    candidates.push(...fromCriteria, ...fromTopLevelSuggestions, ...fromTopLevelRecommendations);
  }

  return candidates;
}

export async function createProposalsForSessionFromEvaluation(
  revisionSessionId: string,
  evaluationRunId: string,
): Promise<ChangeProposal[]> {
  const existing = await listProposalsForSession(revisionSessionId);
  if (existing.length > 0) {
    return existing;
  }

  const candidates = await buildProposalsFromEvaluationArtifacts(evaluationRunId);
  const normalized = normalizeProposalCandidates(revisionSessionId, candidates);

  return bulkCreateChangeProposals(normalized);
}
