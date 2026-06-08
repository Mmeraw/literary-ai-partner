type JsonObject = Record<string, unknown>;

type RevisionEventRow = {
  created_at?: string;
  metadata?: unknown;
};

type CountRow = {
  key: string;
  count: number;
};

type ModelPromptCountRow = {
  model: string;
  prompt_version: string;
  count: number;
};

type AnalyticsPayload = {
  total_rejected_events: number;
  reason_code_counts: CountRow[];
  criterion_counts: CountRow[];
  revision_operation_counts: CountRow[];
  model_prompt_version_counts: ModelPromptCountRow[];
  overlap_score_buckets: CountRow[];
  candidate_word_count_buckets: CountRow[];
  hydration_result_counts: CountRow[];
  candidate_generation_status_counts: CountRow[];
};

const OVERLAP_BUCKETS = [
  "0.00-0.09",
  "0.10-0.24",
  "0.25-0.49",
  "0.50-0.74",
  "0.75-1.00",
  "out_of_range",
] as const;

const WORD_COUNT_BUCKETS = [
  "0",
  "1-20",
  "21-50",
  "51-100",
  "101-200",
  "201+",
] as const;

function asRecord(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown, fallback = "unknown"): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scoreBucket(score: number): (typeof OVERLAP_BUCKETS)[number] {
  if (score < 0 || score > 1) return "out_of_range";
  if (score < 0.1) return "0.00-0.09";
  if (score < 0.25) return "0.10-0.24";
  if (score < 0.5) return "0.25-0.49";
  if (score < 0.75) return "0.50-0.74";
  return "0.75-1.00";
}

function wordCountBucket(count: number): (typeof WORD_COUNT_BUCKETS)[number] {
  if (count <= 0) return "0";
  if (count <= 20) return "1-20";
  if (count <= 50) return "21-50";
  if (count <= 100) return "51-100";
  if (count <= 200) return "101-200";
  return "201+";
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toCountRows(map: Map<string, number>): CountRow[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function toModelPromptRows(map: Map<string, number>): ModelPromptCountRow[] {
  return [...map.entries()]
    .map(([compound, count]) => {
      const [model, prompt_version] = compound.split("::");
      return {
        model: model || "unknown",
        prompt_version: prompt_version || "unknown",
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model) || a.prompt_version.localeCompare(b.prompt_version));
}

export function aggregateRejectedReviseCandidateAnalytics(rows: RevisionEventRow[]): AnalyticsPayload {
  const reasonCodeCounts = new Map<string, number>();
  const criterionCounts = new Map<string, number>();
  const revisionOperationCounts = new Map<string, number>();
  const modelPromptCounts = new Map<string, number>();
  const overlapBuckets = new Map<string, number>();
  const wordCountBuckets = new Map<string, number>();
  const hydrationResultCounts = new Map<string, number>();
  const candidateGenerationStatusCounts = new Map<string, number>();

  for (const bucket of OVERLAP_BUCKETS) overlapBuckets.set(bucket, 0);
  for (const bucket of WORD_COUNT_BUCKETS) wordCountBuckets.set(bucket, 0);

  for (const row of rows) {
    const metadata = asRecord(row.metadata);
    if (!metadata) continue;

    const reasons = Array.isArray(metadata.rejection_reasons)
      ? metadata.rejection_reasons.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
    if (reasons.length === 0) {
      increment(reasonCodeCounts, "unknown");
    } else {
      for (const reason of reasons) increment(reasonCodeCounts, reason);
    }

    increment(criterionCounts, asString(metadata.criterion));
    increment(revisionOperationCounts, asString(metadata.revision_operation));
    increment(hydrationResultCounts, asString(metadata.hydration_result));
    increment(candidateGenerationStatusCounts, asString(metadata.candidate_generation_status));

    const model = asString(metadata.model);
    const promptVersion = asString(metadata.prompt_version);
    increment(modelPromptCounts, `${model}::${promptVersion}`);

    const overlap = asRecord(metadata.candidate_anchor_overlap_scores);
    if (overlap) {
      for (const key of ["a", "b", "c"] as const) {
        const score = asNumber(overlap[key]);
        if (score !== null) {
          increment(overlapBuckets, scoreBucket(score));
        }
      }
    }

    const counts = asRecord(metadata.candidate_word_counts);
    if (counts) {
      for (const key of ["a", "b", "c"] as const) {
        const count = asNumber(counts[key]);
        if (count !== null) {
          increment(wordCountBuckets, wordCountBucket(Math.max(0, Math.floor(count))));
        }
      }
    }
  }

  return {
    total_rejected_events: rows.length,
    reason_code_counts: toCountRows(reasonCodeCounts),
    criterion_counts: toCountRows(criterionCounts),
    revision_operation_counts: toCountRows(revisionOperationCounts),
    model_prompt_version_counts: toModelPromptRows(modelPromptCounts),
    overlap_score_buckets: toCountRows(overlapBuckets),
    candidate_word_count_buckets: toCountRows(wordCountBuckets),
    hydration_result_counts: toCountRows(hydrationResultCounts),
    candidate_generation_status_counts: toCountRows(candidateGenerationStatusCounts),
  };
}
