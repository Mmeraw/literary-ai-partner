import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { CRITERIA_KEYS, CriterionKey } from "../../schemas/criteria-keys";
import {
  CalibrationAnalysisResult,
  ClassCoverageEntry,
  CompressionGovernanceBand,
  DarkCriteriaFrequencyEntry,
  EvidenceDensityEntry,
  HistogramBucket,
  ManuscriptClassGroupingEntry,
  OutlierRecord,
  StatisticalSummary,
  TelemetryInputRecord,
} from "./types";

const HISTOGRAM_BUCKET_EDGES = [
  0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0, Infinity,
];

const BAND_ORDER: CompressionGovernanceBand[] = ["pass", "warn", "observe", null];

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function fixed(value: number, decimals = 6): number {
  return Number(value.toFixed(decimals));
}

function computeStatisticalSummary(values: number[]): StatisticalSummary | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    n,
    mean: fixed(mean),
    median: fixed(percentile(sorted, 50)),
    p1: fixed(percentile(sorted, 1)),
    p10: fixed(percentile(sorted, 10)),
    p25: fixed(percentile(sorted, 25)),
    p50: fixed(percentile(sorted, 50)),
    p75: fixed(percentile(sorted, 75)),
    p90: fixed(percentile(sorted, 90)),
    p95: fixed(percentile(sorted, 95)),
    p99: fixed(percentile(sorted, 99)),
    min: fixed(sorted[0]),
    max: fixed(sorted[n - 1]),
    stddev: fixed(Math.sqrt(variance)),
  };
}

function buildHistogram(values: number[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < HISTOGRAM_BUCKET_EDGES.length - 1; i++) {
    buckets.push({
      range_lo: HISTOGRAM_BUCKET_EDGES[i],
      range_hi: HISTOGRAM_BUCKET_EDGES[i + 1],
      count: 0,
    });
  }

  for (const value of values) {
    for (const bucket of buckets) {
      if (value >= bucket.range_lo && value < bucket.range_hi) {
        bucket.count += 1;
        break;
      }
    }
  }

  return buckets;
}

function computeClassCoverage(longForm: TelemetryInputRecord[]): ClassCoverageEntry[] {
  const total = longForm.length;
  return BAND_ORDER.map((band) => {
    const count = longForm.filter((r) => r.compression_governance_state === band).length;
    return {
      band,
      count,
      pct_of_long_form: total === 0 ? 0 : fixed((count / total) * 100, 2),
    };
  });
}

function computeManuscriptClassGrouping(
  longForm: TelemetryInputRecord[],
): ManuscriptClassGroupingEntry[] {
  const total = longForm.length;
  const counts = new Map<string, number>();

  for (const record of longForm) {
    const key =
      record.manuscript_class ?? record.manuscript_genre ?? record.manuscript_type ?? "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([manuscript_class, count]) => ({
      manuscript_class,
      count,
      pct_of_long_form: total === 0 ? 0 : fixed((count / total) * 100, 2),
    }));
}

function computeDarkCriteriaFrequency(longForm: TelemetryInputRecord[]): {
  frequency: DarkCriteriaFrequencyEntry[];
  jobsWithAnyDarkCriteria: number;
} {
  const total = longForm.length;
  const counts = new Map<CriterionKey, number>(CRITERIA_KEYS.map((k) => [k, 0]));
  let jobsWithAnyDarkCriteria = 0;

  for (const record of longForm) {
    const raw = record.criteria_with_zero_evidence ?? [];
    const keys = new Set(raw.filter((key): key is CriterionKey => CRITERIA_KEYS.includes(key as CriterionKey)));
    if (keys.size > 0) {
      jobsWithAnyDarkCriteria += 1;
    }
    for (const key of keys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const frequency = CRITERIA_KEYS.map((criterion_key) => {
    const count = counts.get(criterion_key) ?? 0;
    return {
      criterion_key,
      long_form_jobs_with_zero_evidence: count,
      pct_of_long_form: total === 0 ? 0 : fixed((count / total) * 100, 2),
    };
  });

  return { frequency, jobsWithAnyDarkCriteria };
}

function computeEvidenceDensityByCriterion(
  longForm: TelemetryInputRecord[],
): EvidenceDensityEntry[] {
  const total = longForm.length;

  return CRITERIA_KEYS.map((criterion_key) => {
    const values = longForm.map((record) => {
      const raw = record.evidence_count_by_criterion?.[criterion_key];
      return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : 0;
    });

    const sorted = [...values].sort((a, b) => a - b);
    const jobsWithEvidence = values.filter((v) => v > 0).length;

    return {
      criterion_key,
      avg_evidence_count_per_long_form_job:
        values.length === 0 ? 0 : fixed(values.reduce((s, v) => s + v, 0) / values.length, 4),
      median_evidence_count_per_long_form_job: sorted.length === 0 ? 0 : fixed(percentile(sorted, 50), 4),
      p90_evidence_count_per_long_form_job: sorted.length === 0 ? 0 : fixed(percentile(sorted, 90), 4),
      long_form_jobs_with_evidence: jobsWithEvidence,
      pct_long_form_jobs_with_evidence: total === 0 ? 0 : fixed((jobsWithEvidence / total) * 100, 2),
    };
  });
}

function detectOutliers(
  longForm: TelemetryInputRecord[],
  summary: StatisticalSummary | null,
): OutlierRecord[] {
  if (!summary) return [];

  const outliers: OutlierRecord[] = [];

  for (const record of longForm) {
    const ratio = record.representation_compression_ratio;
    if (ratio === null || !Number.isFinite(ratio)) continue;

    let reason: OutlierRecord["reason"] | null = null;
    if (ratio < summary.p1) {
      reason = "below_p1";
    } else if (ratio > summary.p99) {
      reason = "above_p99";
    }

    if (!reason) continue;

    outliers.push({
      job_id: record.job_id,
      ratio,
      reason,
      manuscript_words: record.manuscript_words,
      manuscript_genre: record.manuscript_genre,
      manuscript_type: record.manuscript_type,
      manuscript_class: record.manuscript_class,
    });
  }

  return outliers;
}

function computePerGenreBreakdown(
  longForm: TelemetryInputRecord[],
): Record<string, StatisticalSummary> {
  const byGenre = new Map<string, number[]>();

  for (const record of longForm) {
    const ratio = record.representation_compression_ratio;
    if (ratio === null || !Number.isFinite(ratio)) continue;

    const genre = record.manuscript_genre ?? "unspecified";
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(ratio);
  }

  const output: Record<string, StatisticalSummary> = {};
  for (const [genre, ratios] of byGenre.entries()) {
    const summary = computeStatisticalSummary(ratios);
    if (summary) {
      output[genre] = summary;
    }
  }

  return output;
}

function buildMarkdownSummary(result: CalibrationAnalysisResult): string {
  const lines: string[] = [];
  const summary = result.statistical_summary;
  const topDarkCriteria = [...result.dark_criteria_frequency]
    .sort((a, b) => b.long_form_jobs_with_zero_evidence - a.long_form_jobs_with_zero_evidence)
    .slice(0, 5);

  lines.push("# Phase 2 Calibration Summary Artifact");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push("");
  lines.push("## Coverage");
  lines.push(`- Total input records: ${result.total_input_records}`);
  lines.push(`- Long-form analyzed: ${result.long_form_record_count}`);
  lines.push(`- Short-form excluded: ${result.short_form_record_count_excluded}`);
  lines.push("");

  lines.push("## Compression Ratio Distribution");
  if (!summary) {
    lines.push("- No long-form finite ratio data available.");
  } else {
    lines.push(`- mean: ${summary.mean}`);
    lines.push(`- median: ${summary.median}`);
    lines.push(`- p10: ${summary.p10}`);
    lines.push(`- p25: ${summary.p25}`);
    lines.push(`- p75: ${summary.p75}`);
    lines.push(`- p90: ${summary.p90}`);
    lines.push(`- p95: ${summary.p95}`);
    lines.push(`- p99: ${summary.p99}`);
  }
  lines.push("");

  lines.push("## Governance Band Coverage (Long-form)");
  for (const entry of result.class_coverage) {
    lines.push(`- ${entry.band ?? "null"}: ${entry.count} (${entry.pct_of_long_form}%)`);
  }
  lines.push("");

  lines.push("## Manuscript Class Grouping");
  if (result.manuscript_class_grouping.length === 0) {
    lines.push("- No class metadata available.");
  } else {
    for (const entry of result.manuscript_class_grouping) {
      lines.push(`- ${entry.manuscript_class}: ${entry.count} (${entry.pct_of_long_form}%)`);
    }
  }
  lines.push("");

  lines.push("## Dark Criteria Frequency");
  lines.push(
    `- Jobs with any dark criteria: ${result.long_form_jobs_with_any_dark_criteria} / ${result.long_form_record_count}`,
  );
  for (const entry of topDarkCriteria) {
    lines.push(
      `- ${entry.criterion_key}: ${entry.long_form_jobs_with_zero_evidence} (${entry.pct_of_long_form}%)`,
    );
  }
  lines.push("");

  lines.push("## Evidence Density by Criterion (Top 5 by average)");
  const topEvidence = [...result.evidence_density_by_criterion]
    .sort((a, b) => b.avg_evidence_count_per_long_form_job - a.avg_evidence_count_per_long_form_job)
    .slice(0, 5);
  for (const entry of topEvidence) {
    lines.push(
      `- ${entry.criterion_key}: avg=${entry.avg_evidence_count_per_long_form_job}, median=${entry.median_evidence_count_per_long_form_job}, p90=${entry.p90_evidence_count_per_long_form_job}`,
    );
  }
  lines.push("");

  lines.push("## Outliers");
  lines.push(`- Total outliers: ${result.outliers.length}`);
  if (result.outliers.length > 0) {
    lines.push(
      `- Example: ${result.outliers[0].job_id} (${result.outliers[0].reason}, ratio=${result.outliers[0].ratio})`,
    );
  }
  lines.push("");

  lines.push("## Decision Support Notes");
  lines.push(
    "- This artifact is observational input for Phase 2 threshold derivation; it does not change runtime enforcement.",
  );
  lines.push("- Validate outlier root causes before proposing any threshold lock.");

  return lines.join("\n");
}

export function analyzeCalibration(records: TelemetryInputRecord[]): CalibrationAnalysisResult {
  const longForm = records.filter((r) => r.packet_source === "long_form_chunks_canonical");
  const shortForm = records.filter((r) => r.packet_source === "short_form_initial_text");

  const longFormRatios = longForm
    .map((r) => r.representation_compression_ratio)
    .filter((ratio): ratio is number => ratio !== null && Number.isFinite(ratio));

  const statisticalSummary = computeStatisticalSummary(longFormRatios);
  const histogram = buildHistogram(longFormRatios);
  const classCoverage = computeClassCoverage(longForm);
  const manuscriptClassGrouping = computeManuscriptClassGrouping(longForm);
  const darkCriteria = computeDarkCriteriaFrequency(longForm);
  const evidenceDensityByCriterion = computeEvidenceDensityByCriterion(longForm);
  const outliers = detectOutliers(longForm, statisticalSummary);
  const perGenreBreakdown = computePerGenreBreakdown(longForm);

  const provisional: CalibrationAnalysisResult = {
    total_input_records: records.length,
    long_form_record_count: longForm.length,
    short_form_record_count_excluded: shortForm.length,
    histogram,
    statistical_summary: statisticalSummary,
    class_coverage: classCoverage,
    manuscript_class_grouping: manuscriptClassGrouping,
    dark_criteria_frequency: darkCriteria.frequency,
    long_form_jobs_with_any_dark_criteria: darkCriteria.jobsWithAnyDarkCriteria,
    evidence_density_by_criterion: evidenceDensityByCriterion,
    outliers,
    per_genre_breakdown: perGenreBreakdown,
    generated_at: new Date().toISOString(),
    phase_2_summary_markdown: "",
  };

  return {
    ...provisional,
    phase_2_summary_markdown: buildMarkdownSummary(provisional),
  };
}

function parseArgs(argv: string[]): {
  inputPath: string;
  outputPath: string;
  markdownOutputPath?: string;
} {
  if (argv.length < 1) {
    console.error(
      "Usage: analyze-phase-2-calibration.ts <input.json|-> [output.json|/dev/stdout] [--markdown output.md]",
    );
    process.exit(2);
  }

  const inputPath = argv[0];
  const outputPath = argv[1] ?? "/dev/stdout";

  let markdownOutputPath: string | undefined;
  const markdownFlagIndex = argv.indexOf("--markdown");
  if (markdownFlagIndex >= 0) {
    const markdownPath = argv[markdownFlagIndex + 1];
    if (!markdownPath) {
      console.error("--markdown flag requires a path argument");
      process.exit(2);
    }
    markdownOutputPath = markdownPath;
  }

  return { inputPath, outputPath, markdownOutputPath };
}

function loadInputRecords(inputPath: string): TelemetryInputRecord[] {
  const raw = inputPath === "-" ? readFileSync(0, "utf-8") : readFileSync(inputPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Input must be a JSON array of TelemetryInputRecord");
  }

  return parsed as TelemetryInputRecord[];
}

async function main(): Promise<void> {
  const { inputPath, outputPath, markdownOutputPath } = parseArgs(process.argv.slice(2));
  const records = loadInputRecords(inputPath);
  const result = analyzeCalibration(records);
  const outputJson = JSON.stringify(result, null, 2);

  if (outputPath === "/dev/stdout") {
    console.log(outputJson);
  } else {
    writeFileSync(outputPath, outputJson, "utf-8");
    console.error(`Wrote JSON analysis to ${outputPath}`);
  }

  if (markdownOutputPath) {
    writeFileSync(markdownOutputPath, result.phase_2_summary_markdown, "utf-8");
    console.error(`Wrote Markdown summary to ${markdownOutputPath}`);
  }
}

const isMain = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
