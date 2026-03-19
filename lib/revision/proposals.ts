import { getSupabaseAdminClient } from "@/lib/supabase";
import { getVersionById } from "@/lib/manuscripts/versions";
import { getRevisionSessionById, listProposalsForSession } from "./sessions";
import { logRevisionEvent } from "./logRevisionEvent";
import {
  buildAnchorForSnippet,
  proposalAnchorSchema,
  validateAnchorAgainstSource,
  validateExtractionContract,
  type ProposalAnchorStatus,
} from "./anchorContract";
import type {
  ChangeProposal,
  CreateChangeProposalInput,
  EvaluationProposalCandidate,
} from "./types";

type NormalizedCreateChangeProposalInput = CreateChangeProposalInput & {
  _anchor_status?: ProposalAnchorStatus;
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
        `[REVISION-PROPOSALS] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function mapChangeProposal(row: any): ChangeProposal {
  const parsedAnchor = proposalAnchorSchema.parse({
    start_offset: row.start_offset ?? row.anchor_start,
    end_offset: row.end_offset ?? row.anchor_end,
    before_context: row.before_context ?? "",
    after_context: row.after_context ?? "",
    anchor_text_normalized: row.anchor_text_normalized ?? null,
  });

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
    start_offset: parsedAnchor.start_offset,
    end_offset: parsedAnchor.end_offset,
    before_context: parsedAnchor.before_context,
    after_context: parsedAnchor.after_context,
    anchor_text_normalized: parsedAnchor.anchor_text_normalized ?? null,
    created_at: row.created_at,
  };
}

async function getProposalTelemetryContext(revisionSessionId: string): Promise<{
  evaluation_run_id: string | null;
  manuscript_id: number | null;
  manuscript_version_id: string | null;
}> {
  const session = await getRevisionSessionById(revisionSessionId);
  if (!session) {
    return {
      evaluation_run_id: null,
      manuscript_id: null,
      manuscript_version_id: null,
    };
  }

  const sourceVersion = await getVersionById(session.source_version_id);
  return {
    evaluation_run_id: session.evaluation_run_id,
    manuscript_id: sourceVersion?.manuscript_id ?? null,
    manuscript_version_id: sourceVersion?.id ?? session.source_version_id,
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
  proposalAnchorSchema.parse(input);

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
      start_offset: input.start_offset,
      end_offset: input.end_offset,
      before_context: input.before_context,
      after_context: input.after_context,
      anchor_text_normalized: input.anchor_text_normalized ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createChangeProposal failed: ${error.message}`);
  }

  const mapped = mapChangeProposal(data);
  const telemetryContext = await getProposalTelemetryContext(mapped.revision_session_id);

  void logRevisionEvent({
    revision_session_id: mapped.revision_session_id,
    proposal_id: mapped.id,
    manuscript_id: telemetryContext.manuscript_id,
    manuscript_version_id: telemetryContext.manuscript_version_id,
    evaluation_run_id: telemetryContext.evaluation_run_id,
    event_type: "proposal",
    event_code: "PROPOSAL_GENERATED",
    metadata: {
      original_text_length: mapped.original_text.length,
      proposed_text_length: mapped.proposed_text.length,
    },
  });

  void logRevisionEvent({
    revision_session_id: mapped.revision_session_id,
    proposal_id: mapped.id,
    manuscript_id: telemetryContext.manuscript_id,
    manuscript_version_id: telemetryContext.manuscript_version_id,
    evaluation_run_id: telemetryContext.evaluation_run_id,
    event_type: "proposal",
    severity:
      Number.isInteger(mapped.start_offset) && Number.isInteger(mapped.end_offset)
        ? "info"
        : "warn",
    event_code:
      Number.isInteger(mapped.start_offset) && Number.isInteger(mapped.end_offset)
        ? "PROPOSAL_ANCHOR_CREATED"
        : "PROPOSAL_ANCHOR_MISSING",
    metadata: {
      start_offset: mapped.start_offset,
      end_offset: mapped.end_offset,
      before_context_length: mapped.before_context.length,
      after_context_length: mapped.after_context.length,
    },
  });

  return mapped;
}

export async function bulkCreateChangeProposals(
  inputs: CreateChangeProposalInput[],
): Promise<ChangeProposal[]> {
  if (inputs.length === 0) return [];

  for (const input of inputs) {
    proposalAnchorSchema.parse(input);
  }

  const payload = inputs.map((input) => ({
    revision_session_id: input.revision_session_id,
    location_ref: input.location_ref,
    rule: input.rule,
    action: input.action,
    original_text: input.original_text,
    proposed_text: input.proposed_text,
    justification: input.justification,
    severity: input.severity,
    start_offset: input.start_offset,
    end_offset: input.end_offset,
    before_context: input.before_context,
    after_context: input.after_context,
    anchor_text_normalized: input.anchor_text_normalized ?? null,
  }));

  const { data, error } = await supabase
    .from("change_proposals")
    .insert(payload)
    .select("*");

  if (error) {
    throw new Error(`bulkCreateChangeProposals failed: ${error.message}`);
  }

  const mapped = (data ?? []).map(mapChangeProposal);
  const telemetryContext =
    mapped.length > 0
      ? await getProposalTelemetryContext(mapped[0].revision_session_id)
      : {
          evaluation_run_id: null,
          manuscript_id: null,
          manuscript_version_id: null,
        };

  for (let i = 0; i < mapped.length; i += 1) {
    const created = mapped[i];
    const input = inputs[i] as NormalizedCreateChangeProposalInput | undefined;
    const anchorStatus =
      input?._anchor_status ??
      (Number.isInteger(created.start_offset) && Number.isInteger(created.end_offset)
        ? "created"
        : "missing");

    void logRevisionEvent({
      revision_session_id: created.revision_session_id,
      proposal_id: created.id,
      manuscript_id: telemetryContext.manuscript_id,
      manuscript_version_id: telemetryContext.manuscript_version_id,
      evaluation_run_id: telemetryContext.evaluation_run_id,
      event_type: "proposal",
      event_code: "PROPOSAL_GENERATED",
      metadata: {
        original_text_length: created.original_text.length,
        proposed_text_length: created.proposed_text.length,
      },
    });

    void logRevisionEvent({
      revision_session_id: created.revision_session_id,
      proposal_id: created.id,
      manuscript_id: telemetryContext.manuscript_id,
      manuscript_version_id: telemetryContext.manuscript_version_id,
      evaluation_run_id: telemetryContext.evaluation_run_id,
      event_type: "proposal",
      severity: anchorStatus === "created" ? "info" : "warn",
      event_code:
        anchorStatus === "created"
          ? "PROPOSAL_ANCHOR_CREATED"
          : anchorStatus === "ambiguous"
            ? "PROPOSAL_ANCHOR_AMBIGUOUS"
            : "PROPOSAL_ANCHOR_MISSING",
      metadata: {
        start_offset: created.start_offset,
        end_offset: created.end_offset,
        before_context_length: created.before_context.length,
        after_context_length: created.after_context.length,
      },
    });
  }

  return mapped;
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
  sourceText: string,
): NormalizedCreateChangeProposalInput[] {
  return candidates
    .filter((candidate) => {
      return Boolean(
        candidate.original_text && candidate.proposed_text && candidate.justification,
      );
    })
    .map((candidate, index) => {
      const originalText = candidate.original_text ?? "";
      const anchor = buildAnchorForSnippet(sourceText, originalText);

      if (anchor.anchor_status !== "created") {
        throw new Error(
          `Anchor generation failed for candidate ${index + 1} (${candidate.location_ref ?? "unknown"}): ${anchor.reason}`,
        );
      }

      validateAnchorAgainstSource(anchor, sourceText, originalText);

      validateExtractionContract(
        { start_offset: anchor.start_offset, end_offset: anchor.end_offset, original_text: originalText },
        sourceText,
      );

      return {
        revision_session_id: revisionSessionId,
        location_ref: candidate.location_ref ?? `unknown:${index + 1}`,
        rule: candidate.rule ?? "unspecified_rule",
        action: candidate.action ?? "refine",
        original_text: originalText,
        proposed_text: candidate.proposed_text ?? "",
        justification: candidate.justification ?? "",
        severity: candidate.severity ?? "medium",
        start_offset: anchor.start_offset,
        end_offset: anchor.end_offset,
        before_context: anchor.before_context,
        after_context: anchor.after_context,
        anchor_text_normalized: anchor.anchor_text_normalized ?? null,
        _anchor_status: anchor.anchor_status,
      };
    });
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
  const session = await getRevisionSessionById(revisionSessionId);
  if (!session) {
    throw new Error(`Revision session not found: ${revisionSessionId}`);
  }

  const sourceVersion = await getVersionById(session.source_version_id);
  const sourceText = typeof sourceVersion?.raw_text === "string" ? sourceVersion.raw_text : "";

  const normalized = normalizeProposalCandidates(revisionSessionId, candidates, sourceText);

  return bulkCreateChangeProposals(normalized);
}
