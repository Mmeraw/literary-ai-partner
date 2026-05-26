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
  if (v === "must" || v === "high" || v === "critical" || v === "major") return "high";
  if (v === "could" || v === "low" || v === "minor") return "low";
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

function normalizeDeepKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isRevisionGuidanceKey(key: string): boolean {
  const normalized = normalizeDeepKey(key);
  return (
    normalized === "revisionqueue" ||
    normalized === "revisionplan" ||
    normalized === "revisionnote" ||
    normalized === "revisionnotes" ||
    normalized === "revisionpriority" ||
    normalized === "revisionpriorities" ||
    normalized === "repairqueue" ||
    normalized === "repairplan" ||
    normalized === "repairnote" ||
    normalized === "whatwerepairing" ||
    normalized === "revisionguidance"
  );
}

function splitRevisionGuidanceText(value: string): string[] {
  const text = value.trim();
  if (!text) return [];

  const numbered = text
    .split(/(?:^|\s)(?:\d+\.|[-•])\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (numbered.length > 1) return numbered;

  return text
    .split(/;\s+(?=[A-Z0-9'“\"])/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

type DeepRevisionItem = {
  value: unknown;
  path: string;
  context: Record<string, unknown>;
  sourceKey: string;
};

function objectContext(value: any): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return {
    criterion: value.criterion ?? value.criterion_key ?? value.key,
    title: value.title ?? value.name ?? value.layer ?? value.act ?? value.section,
    summary: value.summary ?? value.function ?? value.status,
    evidence: value.evidence ?? value.fit_evidence ?? value.gap_evidence,
    score: value.score ?? value.score_0_10 ?? value.final_score_0_10,
    confidence: value.confidence,
    severity: value.severity ?? value.priority,
  };
}

function collectDeepRevisionItems(value: unknown, path: string[] = [], context: Record<string, unknown> = {}): DeepRevisionItem[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectDeepRevisionItems(item, [...path, String(index)], context));
  }

  if (!value || typeof value !== "object") return [];

  const node = value as Record<string, unknown>;
  const nextContext = { ...context, ...objectContext(node) };
  const items: DeepRevisionItem[] = [];

  for (const [key, child] of Object.entries(node)) {
    const childPath = [...path, key];
    if (isRevisionGuidanceKey(key)) {
      if (typeof child === "string") {
        for (const text of splitRevisionGuidanceText(child)) {
          items.push({ value: text, path: childPath.join("."), context: nextContext, sourceKey: key });
        }
      } else if (Array.isArray(child)) {
        child.forEach((entry, index) => {
          if (typeof entry === "string") {
            for (const text of splitRevisionGuidanceText(entry)) {
              items.push({ value: text, path: [...childPath, String(index)].join("."), context: nextContext, sourceKey: key });
            }
          } else {
            items.push({ value: entry, path: [...childPath, String(index)].join("."), context: nextContext, sourceKey: key });
          }
        });
      } else if (child && typeof child === "object") {
        items.push({ value: child, path: childPath.join("."), context: nextContext, sourceKey: key });
      }
      continue;
    }

    items.push(...collectDeepRevisionItems(child, childPath, nextContext));
  }

  return items;
}

function sourceLabel(sourceKey: string): string {
  const normalized = normalizeDeepKey(sourceKey);
  if (normalized.includes("queue")) return "revision_queue";
  if (normalized.includes("priority")) return "revision_priority";
  if (normalized.includes("plan")) return "revision_plan";
  if (normalized.includes("repair")) return "repair_guidance";
  return "revision_note";
}

function buildFindingFromDeepRevisionItem(
  evaluationRunId: string,
  manuscriptVersionId: string | null,
  artifactId: string,
  item: DeepRevisionItem,
  index: number,
): CreateDiagnosticFindingInput | null {
  const raw = item.value;
  const rawObject = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;

  const recommendation = cleanSnippet(
    typeof raw === "string"
      ? raw
      : firstNonEmptyString(
          rawObject?.recommendation,
          rawObject?.revision_note,
          rawObject?.revisionNote,
          rawObject?.revision_priority,
          rawObject?.revisionPriority,
          rawObject?.revision_plan,
          rawObject?.revisionPlan,
          rawObject?.repair_plan,
          rawObject?.repairPlan,
          rawObject?.action,
          rawObject?.text,
          rawObject?.value,
        ),
  );

  if (!recommendation) return null;

  const criterion = firstNonEmptyString(
    rawObject?.criterion,
    rawObject?.criterion_key,
    rawObject?.key,
    item.context.criterion,
    item.context.title,
    "GENERAL",
  );

  const title = firstNonEmptyString(
    rawObject?.diagnosis,
    rawObject?.issue,
    rawObject?.problem,
    rawObject?.title,
    rawObject?.summary,
    item.context.summary,
    `Revision guidance from ${item.path}`,
  );

  const evidence = cleanSnippet(
    firstNonEmptyString(
      rawObject?.evidence_excerpt,
      rawObject?.evidence_snippet,
      rawObject?.evidence,
      rawObject?.quote,
      item.context.evidence,
    ),
  );

  return {
    evaluation_job_id: evaluationRunId,
    manuscript_version_id: manuscriptVersionId,
    artifact_id: artifactId,
    criterion_key: normalizeCriterionKey(criterion),
    wave_id: firstNonEmptyString(rawObject?.wave_id, rawObject?.waveId) || null,
    finding_type: normalizeFindingType(sourceLabel(item.sourceKey)),
    severity: toSeverity(rawObject?.severity ?? rawObject?.priority ?? item.context.severity, item.context.score),
    confidence: toConfidence(rawObject?.confidence ?? item.context.confidence),
    location_ref: firstNonEmptyString(rawObject?.location_ref, rawObject?.locationRef, item.path) || `revision_guidance:${index + 1}`,
    original_text: evidence,
    evidence_excerpt: evidence,
    diagnosis: title,
    recommendation,
    action_hint: toActionHint(rawObject?.action_hint ?? rawObject?.action_type ?? rawObject?.action) ?? "refine",
  };
}

function buildDeepRevisionFindings(
  evaluationRunId: string,
  manuscriptVersionId: string | null,
  artifactId: string,
  payload: any,
): CreateDiagnosticFindingInput[] {
  const rawItems = collectDeepRevisionItems(payload);
  const seen = new Set<string>();
  const findings: CreateDiagnosticFindingInput[] = [];

  rawItems.forEach((item, index) => {
    const finding = buildFindingFromDeepRevisionItem(
      evaluationRunId,
      manuscriptVersionId,
      artifactId,
      item,
      index,
    );
    if (!finding) return;

    const signature = [finding.criterion_key, finding.finding_type, finding.location_ref, finding.recommendation]
      .join("|")
      .toLowerCase();
    if (seen.has(signature)) return;
    seen.add(signature);
    findings.push(finding);
  });

  return findings;
}

export function buildFindingsFromPayload(
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

  findings.push(
    ...fromCriteria,
    ...fromRecommendations,
    ...fromSuggestions,
    ...buildDeepRevisionFindings(evaluationRunId, manuscriptVersionId, artifactId, payload),
  );
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
