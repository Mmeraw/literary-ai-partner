import type {
  CreateDiagnosticFindingInput,
  FindingActionHint,
  ProposalSeverity,
} from "./types";

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
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

function normalizeFindingType(raw: unknown): string {
  const base = firstNonEmptyString(typeof raw === "string" ? raw : "", "revision_note");
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
    normalized === "repairnotes" ||
    normalized === "revisionguidance" ||
    normalized === "revisequeue" ||
    normalized === "reviseplan"
  );
}

function splitRevisionGuidanceText(value: string): string[] {
  const text = value.trim();
  if (!text) return [];

  const bullets = text
    .split(/(?:^|\n|\s)(?:\d+\.|[-•])\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (bullets.length > 1) return bullets;

  return text
    .split(/;\s+(?=[A-Z0-9'“\"])/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSeverity(raw: unknown, scoreOverride?: unknown): ProposalSeverity {
  if (typeof scoreOverride === "number" && Number.isFinite(scoreOverride)) {
    if (scoreOverride <= 4) return "high";
    if (scoreOverride <= 7) return "medium";
    return "low";
  }

  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (["must", "high", "critical", "major", "blocker"].includes(v)) return "high";
  if (["could", "low", "minor", "optional"].includes(v)) return "low";
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

function collectDeepRevisionItems(
  value: unknown,
  path: string[] = [],
  context: Record<string, unknown> = {},
): DeepRevisionItem[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectDeepRevisionItems(item, [...path, String(index)], context),
    );
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
  const rawObject = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;

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

  const diagnosis = firstNonEmptyString(
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
    diagnosis,
    recommendation,
    action_hint: toActionHint(rawObject?.action_hint ?? rawObject?.action_type ?? rawObject?.action) ?? "refine",
  };
}

export function buildDeepRevisionFindings(
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
