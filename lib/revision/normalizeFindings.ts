import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  CreateDiagnosticFindingInput,
  DiagnosticFinding,
  FindingActionHint,
  ProposalSeverity,
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
        `[REVISION-FINDINGS] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function mapDiagnosticFinding(row: any): DiagnosticFinding {
  return {
    id: row.id,
    evaluation_job_id: row.evaluation_job_id,
    manuscript_version_id: row.manuscript_version_id,
    artifact_id: row.artifact_id,
    criterion_key: row.criterion_key,
    wave_id: row.wave_id,
    finding_type: row.finding_type,
    severity: row.severity,
    confidence: row.confidence,
    location_ref: row.location_ref,
    chunk_id: row.chunk_id,
    chapter_index: row.chapter_index,
    paragraph_index: row.paragraph_index,
    sentence_index: row.sentence_index,
    original_text: row.original_text,
    evidence_excerpt: row.evidence_excerpt,
    diagnosis: row.diagnosis,
    recommendation: row.recommendation,
    action_hint: row.action_hint,
    status: row.status,
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

function toSeverity(raw: unknown, scoreOverride?: unknown): ProposalSeverity {
  // score_0_10: >=8 = low concern, 5-7 = medium, <=4 = high
  if (typeof scoreOverride === "number" && Number.isFinite(scoreOverride)) {
    if (scoreOverride <= 4) return "high";
    if (scoreOverride <= 7) return "medium";
    return "low";
  }
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "high" || v === "critical" || v === "major") return "high";
  if (v === "low" || v === "minor") return "low";
  return "medium";
}

function toActionHint(raw: unknown): FindingActionHint | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "preserve" || v === "refine" || v === "replace") return v;
  if (v === "keep" || v === "none" || v === "no_change") return "preserve";
  return null;
}

function toConfidence(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeFindingType(raw: unknown): string {
  const base = firstNonEmptyString(
    typeof raw === "string" ? raw : "",
    "editorial_issue",
  );
  return base.replace(/\s+/g, "_").toLowerCase();
}

function normalizeCriterionKey(raw: unknown): string {
  const key = firstNonEmptyString(typeof raw === "string" ? raw : "", "GENERAL");
  return key.replace(/\s+/g, "_").toUpperCase();
}

function buildFindingsFromPayload(
  evaluationRunId: string,
  manuscriptVersionId: string | null,
  artifactId: string,
  payload: any,
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];

  const fromCriteria = Array.isArray(payload?.criteria)
    ? payload.criteria.flatMap((criterion: any, cIdx: number) => {
        const criterionKey = normalizeCriterionKey(criterion?.key);
        const criterionWave = firstNonEmptyString(criterion?.wave_id, criterion?.waveId) || null;
        const criterionDiagnosis = firstNonEmptyString(
          criterion?.diagnosis,
          criterion?.rationale,
          criterion?.summary,
        );
        // evidence may be [{snippet: "..."}] (array) or a plain string
        const rawEvidence = criterion?.evidence;
        const evidenceSnippet = Array.isArray(rawEvidence)
          ? rawEvidence[0]?.snippet ?? rawEvidence[0]?.text ?? ""
          : rawEvidence;
        const criterionEvidence = cleanSnippet(
          firstNonEmptyString(criterion?.evidence_snippet, evidenceSnippet, criterion?.quote),
        );

        const recommendations = Array.isArray(criterion?.recommendations)
          ? criterion.recommendations
          : [];

        return recommendations.map((rec: any, rIdx: number) => {
          const diagnosis = firstNonEmptyString(
            rec?.diagnosis,
            rec?.issue,
            rec?.why,
            rec?.justification,
            criterionDiagnosis,
            `Finding from ${criterionKey}`,
          );

          return {
            evaluation_job_id: evaluationRunId,
            manuscript_version_id: manuscriptVersionId,
            artifact_id: artifactId,
            criterion_key: criterionKey,
            wave_id: criterionWave,
            finding_type: normalizeFindingType(
              firstNonEmptyString(rec?.finding_type, rec?.type, rec?.rule, criterion?.key),
            ),
            severity: toSeverity(rec?.severity ?? rec?.priority, criterion?.score_0_10),
            confidence: toConfidence(rec?.confidence),
            location_ref:
              firstNonEmptyString(rec?.location_ref, rec?.locationRef) ||
              `${criterionKey}:${cIdx + 1}:rec:${rIdx + 1}`,
            original_text: cleanSnippet(
              firstNonEmptyString(
                rec?.original_text,
                rec?.originalText,
                rec?.evidence_snippet,
                rec?.evidenceSnippet,
                rec?.snippet,
                criterionEvidence,
              ),
            ),
            evidence_excerpt: cleanSnippet(
              firstNonEmptyString(rec?.evidence_excerpt, rec?.evidence_snippet, criterionEvidence),
            ),
            diagnosis,
            recommendation: firstNonEmptyString(
              rec?.recommendation,
              rec?.proposed_text,
              rec?.proposedText,
              rec?.replacement,
              rec?.action,
            ),
            action_hint: toActionHint(rec?.action_hint ?? rec?.action_type ?? rec?.action) ?? "refine",
          } satisfies CreateDiagnosticFindingInput;
        });
      })
    : [];

  // recommendations may be a flat array OR an object with named buckets
  // e.g. { quick_wins: [...], strategic_revisions: [...] }
  const rawRecs = payload?.recommendations;
  const recommendationsArray: any[] = Array.isArray(rawRecs)
    ? rawRecs
    : rawRecs && typeof rawRecs === "object"
      ? [
          ...(Array.isArray(rawRecs.quick_wins) ? rawRecs.quick_wins : []),
          ...(Array.isArray(rawRecs.strategic_revisions) ? rawRecs.strategic_revisions : []),
          ...(Array.isArray(rawRecs.items) ? rawRecs.items : []),
        ]
      : [];

  const fromRecommendations = recommendationsArray.length > 0
    ? recommendationsArray.map((item: any, idx: number) => ({
        evaluation_job_id: evaluationRunId,
        manuscript_version_id: manuscriptVersionId,
        artifact_id: artifactId,
        criterion_key: normalizeCriterionKey(item?.criterion ?? item?.rule),
        wave_id: firstNonEmptyString(item?.wave_id, item?.waveId) || null,
        finding_type: normalizeFindingType(item?.finding_type ?? item?.type ?? item?.rule),
        severity: toSeverity(item?.severity ?? item?.priority),
        confidence: toConfidence(item?.confidence),
        location_ref:
          firstNonEmptyString(item?.location_ref, item?.locationRef) ||
          `recommendation:${idx + 1}`,
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
        evidence_excerpt: cleanSnippet(
          firstNonEmptyString(item?.evidence_excerpt, item?.evidence_snippet, item?.snippet),
        ),
        diagnosis: firstNonEmptyString(
          item?.diagnosis,
          item?.justification,
          item?.reason,
          item?.why,
          "Normalized recommendation finding",
        ),
        recommendation: firstNonEmptyString(
          item?.recommendation,
          item?.proposed_text,
          item?.proposedText,
          item?.replacement,
          item?.action,
        ),
        action_hint: toActionHint(item?.action_hint ?? item?.action_type ?? item?.action) ?? "refine",
      }))
    : [];

  const fromSuggestions = Array.isArray(payload?.suggestions)
    ? payload.suggestions.map((item: any, idx: number) => ({
        evaluation_job_id: evaluationRunId,
        manuscript_version_id: manuscriptVersionId,
        artifact_id: artifactId,
        criterion_key: normalizeCriterionKey(item?.criterion ?? item?.ruleName ?? item?.rule),
        wave_id: firstNonEmptyString(item?.wave_id, item?.waveId) || null,
        finding_type: normalizeFindingType(item?.finding_type ?? item?.type ?? item?.ruleName),
        severity: toSeverity(item?.severity),
        confidence: toConfidence(item?.confidence),
        location_ref:
          firstNonEmptyString(item?.locationRef, item?.location_ref) || `suggestion:${idx + 1}`,
        original_text: cleanSnippet(firstNonEmptyString(item?.originalText, item?.original_text)),
        evidence_excerpt: cleanSnippet(
          firstNonEmptyString(item?.evidence_excerpt, item?.evidence_snippet, item?.quote),
        ),
        diagnosis: firstNonEmptyString(
          item?.diagnosis,
          item?.justification,
          item?.reason,
          "Normalized suggestion finding",
        ),
        recommendation: firstNonEmptyString(
          item?.recommendation,
          item?.proposedText,
          item?.proposed_text,
          item?.action,
        ),
        action_hint: toActionHint(item?.action_hint ?? item?.action) ?? "refine",
      }))
    : [];

  findings.push(...fromCriteria, ...fromRecommendations, ...fromSuggestions);
  return findings;
}

export async function listFindingsForEvaluationRun(
  evaluationRunId: string,
): Promise<DiagnosticFinding[]> {
  const { data, error } = await supabase
    .from("diagnostic_findings")
    .select("*")
    .eq("evaluation_job_id", evaluationRunId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`listFindingsForEvaluationRun failed: ${error.message}`);
  }

  return (data ?? []).map(mapDiagnosticFinding);
}

export async function bulkCreateDiagnosticFindings(
  inputs: CreateDiagnosticFindingInput[],
): Promise<DiagnosticFinding[]> {
  if (inputs.length === 0) return [];

  const payload = inputs.map((input) => ({
    evaluation_job_id: input.evaluation_job_id,
    manuscript_version_id: input.manuscript_version_id ?? null,
    artifact_id: input.artifact_id ?? null,
    criterion_key: input.criterion_key,
    wave_id: input.wave_id ?? null,
    finding_type: input.finding_type,
    severity: input.severity,
    confidence: input.confidence ?? null,
    location_ref: input.location_ref ?? null,
    chunk_id: input.chunk_id ?? null,
    chapter_index: input.chapter_index ?? null,
    paragraph_index: input.paragraph_index ?? null,
    sentence_index: input.sentence_index ?? null,
    original_text: input.original_text ?? null,
    evidence_excerpt: input.evidence_excerpt ?? null,
    diagnosis: input.diagnosis,
    recommendation: input.recommendation ?? null,
    action_hint: input.action_hint ?? null,
    status: input.status ?? "open",
  }));

  const { data, error } = await supabase
    .from("diagnostic_findings")
    .insert(payload)
    .select("*");

  if (error) {
    throw new Error(`bulkCreateDiagnosticFindings failed: ${error.message}`);
  }

  return (data ?? []).map(mapDiagnosticFinding);
}

export async function createDiagnosticFindingsForEvaluationRun(
  evaluationRunId: string,
  manuscriptVersionId: string,
): Promise<DiagnosticFinding[]> {
  const existing = await listFindingsForEvaluationRun(evaluationRunId);
  if (existing.length > 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("id, artifact_type, content, created_at")
    .eq("job_id", evaluationRunId)
    .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`createDiagnosticFindingsForEvaluationRun failed: ${error.message}`);
  }

  const rows = data ?? [];
  const findings: CreateDiagnosticFindingInput[] = [];

  for (const row of rows as any[]) {
    const artifactId = typeof row.id === "string" ? row.id : null;
    if (!artifactId) continue;

    const payload = row.content ?? {};
    findings.push(
      ...buildFindingsFromPayload(evaluationRunId, manuscriptVersionId, artifactId, payload),
    );
  }

  return bulkCreateDiagnosticFindings(findings);
}
