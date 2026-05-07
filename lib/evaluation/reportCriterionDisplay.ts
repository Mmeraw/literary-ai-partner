export type RenderableCriterion = {
  score_0_10?: number | null;
  status?: "NOT_APPLICABLE" | "NO_SIGNAL" | "INSUFFICIENT_SIGNAL" | "SCORABLE";
  scorable?: boolean;
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
  insufficient_signal_reason?: {
    looked_for?: string[];
    not_found?: string[];
  };
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
      label: "Score not certified",
      classes: "bg-slate-100 text-slate-700",
      numeric: false,
    };
  }

  const scoreValue = criterion.score_0_10;
  if (typeof scoreValue === "number" && scoreValue >= 8) {
    return {
      label: `${scoreValue} / 10`,
      classes: "bg-green-100 text-green-800",
      numeric: true,
    };
  }

  if (typeof scoreValue === "number" && scoreValue >= 6) {
    return {
      label: `${scoreValue} / 10`,
      classes: "bg-yellow-100 text-yellow-800",
      numeric: true,
    };
  }

  return {
    label: `${scoreValue ?? "—"} / 10`,
    classes: "bg-red-100 text-red-800",
    numeric: true,
  };
}

export function getCriterionSupportLabel(criterion: RenderableCriterion): string | null {
  if (isCertifiedCriterion(criterion)) return null;
  if (criterion.status === "NOT_APPLICABLE") {
    return "N/A — Not applicable for this evaluation context";
  }
  if (criterion.status === "NO_SIGNAL") {
    return "Score not certified — no observable evidence";
  }
  return "Score not certified — insufficient evidence anchoring";
}

export function getCertifiedCriteriaSummary(criteria: RenderableCriterion[]): string {
  const total = criteria.length;
  const certified = criteria.filter((criterion) => isCertifiedCriterion(criterion)).length;
  return `${certified} of ${total} criteria certified`;
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
