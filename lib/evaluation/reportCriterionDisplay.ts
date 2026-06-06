import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';

export type RenderableCriterion = {
  score_0_10?: number | null;
  status?: "NOT_APPLICABLE" | "NO_SIGNAL" | "INSUFFICIENT_SIGNAL" | "SCORABLE";
  scorable?: boolean;
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
  insufficient_signal_reason?: {
    looked_for?: string[];
    not_found?: string[];
  };
  technical_defects?: Array<{
    code?: "PROSE_CONTROL_ANCHOR_EXTRACTION_FAILED" | "RECOMMENDATION_TRUNCATED" | string;
    author_facing_reason?: string;
    retryable?: boolean;
  }>;
};

export type CriterionRationalePresentation = {
  label?: string;
  text: string;
  provisional: boolean;
};

export function isCertifiedCriterion(criterion: RenderableCriterion): boolean {
  if (typeof criterion.scorable === "boolean") {
    return criterion.scorable;
  }

  if (criterion.status) {
    return criterion.status === "SCORABLE";
  }

  if (criterion.scorability_status) {
    return (
      criterion.scorability_status !== "non_scorable" &&
      typeof criterion.score_0_10 === "number"
    );
  }

  return typeof criterion.score_0_10 === "number";
}

function formatScoreOutOfTen(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "Score: —/10";
  }

  return `Score: ${Math.floor(score)}/10`;
}

export function getCriterionPrimaryBadge(criterion: RenderableCriterion): {
  label: string;
  classes: string;
  numeric: boolean;
} {
  if (criterion.status === "NOT_APPLICABLE") {
    return {
      label: "N/A",
      classes: "bg-slate-100 text-slate-700",
      numeric: false,
    };
  }

  if (!isCertifiedCriterion(criterion)) {
    return {
      label: `${formatScoreOutOfTen(criterion.score_0_10)} (Not certified)`,
      classes: "bg-slate-100 text-slate-700",
      numeric: false,
    };
  }

  const scoreValue = criterion.score_0_10;
  if (typeof scoreValue === "number" && scoreValue >= 8) {
    return {
      label: formatScoreOutOfTen(scoreValue),
      classes: "bg-green-700 text-white",
      numeric: true,
    };
  }

  if (typeof scoreValue === "number" && scoreValue >= 6) {
    return {
      label: formatScoreOutOfTen(scoreValue),
      classes: "bg-amber-600 text-white",
      numeric: true,
    };
  }

  return {
    label: formatScoreOutOfTen(scoreValue),
    classes: "bg-red-700 text-white",
    numeric: true,
  };
}

export function getCriterionSupportLabel(criterion: RenderableCriterion): string | null {
  if (isCertifiedCriterion(criterion)) return null;
  const primaryDefectReason = criterion.technical_defects
    ?.map((defect) => (defect?.author_facing_reason ?? "").trim())
    .find((reason) => reason.length > 0);

  if (primaryDefectReason) {
    return primaryDefectReason;
  }

  if (criterion.status === "NOT_APPLICABLE") {
    return "N/A — Not applicable for this evaluation context";
  }
  if (criterion.status === "NO_SIGNAL") {
    return "Score not certified — no observable evidence";
  }
  return "Score not certified — technical evidence certification shortfall";
}

function repairTruncatedQuotes(text: string): string {
  return text.replace(
    /[""“]([^""”]+)[""”]/g,
    (match, inner: string) => {
      const content = inner.trimEnd();
      if (/[.!?]$/.test(content)) return match;
      // Dangling apostrophe from a cut contraction (e.g. "wasn'" from "wasn't")
      if (/\w'\s*$/.test(content)) {
        const lastSpace = content.lastIndexOf(" ");
        if (lastSpace === -1) return match;
        const trimmed = content.slice(0, lastSpace).replace(/[,;:\s]+$/, "");
        return `“${trimmed}…”`;
      }
      return match;
    },
  );
}

export function getCriterionRationalePresentation(
  criterion: RenderableCriterion,
  rationale: string | null | undefined,
): CriterionRationalePresentation | null {
  const raw = (rationale ?? "").trim();
  if (!raw) return null;
  // Mistake-proofing: run full quality gate, then repair truncated quotes.
  const text = repairTruncatedQuotes(mistakeProofText(raw));

  if (isCertifiedCriterion(criterion)) {
    return {
      text,
      provisional: false,
    };
  }

  return {
    label: "Preliminary editorial observation (not evidence-certified)",
    text,
    provisional: true,
  };
}

export function getCertifiedCriteriaSummary(criteria: RenderableCriterion[]): string {
  // PR-J (2026-05-16): the legacy label "N of N certified" misled readers into
  // thinking every criterion carried equally strong evidence. "Certified" here
  // means scorable (the criterion had at least minimal observable signal), not
  // that it reached high confidence. Confidence is reported per-criterion via
  // getConfidencePresentation. The new label keeps the count but makes the
  // confidence variance explicit so readers do not over-trust uniform-looking
  // scores (e.g. Prose Control rendered alongside a Low Confidence badge).
  const total = criteria.length;
  const scorable = criteria.filter((criterion) => isCertifiedCriterion(criterion)).length;
  if (total === 0) {
    return "No criteria scored";
  }
  if (scorable === total) {
    return `${scorable} of ${total} criteria scored — confidence varies per criterion (see badges below)`;
  }
  return `${scorable} of ${total} criteria scored — ${total - scorable} non-scorable; confidence varies per criterion (see badges below)`;
}

export function sanitizeRenderData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeRenderData(entry)) as T;
  }

  if (value && typeof value === "object") {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "model_emitted_score_unverified")
      .map(([key, entryValue]) => [key, sanitizeRenderData(entryValue)]);

    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
}
