import type { CriterionKey } from "../../schemas/criteria-keys";

export type CompressionGovernanceBand = "pass" | "warn" | "observe" | null;

export type PacketSource = "long_form_chunks_canonical" | "short_form_initial_text";

export interface TelemetryInputRecord {
  job_id: string;
  manuscript_words: number;
  packet_source: PacketSource;
  representation_compression_ratio: number | null;
  compression_governance_state: CompressionGovernanceBand;
  manuscript_genre?: string;
  manuscript_type?: string;
  manuscript_class?: string;
  criteria_with_zero_evidence?: string[];
  evidence_count_by_criterion?: Partial<Record<CriterionKey, number>>;
  emitted_at: string; // ISO 8601
}

export interface HistogramBucket {
  range_lo: number;
  range_hi: number;
  count: number;
}

export interface StatisticalSummary {
  n: number;
  mean: number;
  median: number;
  p1: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stddev: number;
}

export interface ClassCoverageEntry {
  band: CompressionGovernanceBand;
  count: number;
  pct_of_long_form: number;
}

export interface ManuscriptClassGroupingEntry {
  manuscript_class: string;
  count: number;
  pct_of_long_form: number;
}

export interface DarkCriteriaFrequencyEntry {
  criterion_key: CriterionKey;
  long_form_jobs_with_zero_evidence: number;
  pct_of_long_form: number;
}

export interface EvidenceDensityEntry {
  criterion_key: CriterionKey;
  avg_evidence_count_per_long_form_job: number;
  median_evidence_count_per_long_form_job: number;
  p90_evidence_count_per_long_form_job: number;
  long_form_jobs_with_evidence: number;
  pct_long_form_jobs_with_evidence: number;
}

export interface OutlierRecord {
  job_id: string;
  ratio: number;
  reason: "below_p1" | "above_p99";
  manuscript_words: number;
  manuscript_genre?: string;
  manuscript_type?: string;
  manuscript_class?: string;
}

export interface CalibrationAnalysisResult {
  total_input_records: number;
  long_form_record_count: number;
  short_form_record_count_excluded: number;
  histogram: HistogramBucket[];
  statistical_summary: StatisticalSummary | null;
  class_coverage: ClassCoverageEntry[];
  manuscript_class_grouping: ManuscriptClassGroupingEntry[];
  dark_criteria_frequency: DarkCriteriaFrequencyEntry[];
  long_form_jobs_with_any_dark_criteria: number;
  evidence_density_by_criterion: EvidenceDensityEntry[];
  outliers: OutlierRecord[];
  per_genre_breakdown: Record<string, StatisticalSummary>;
  generated_at: string;
  phase_2_summary_markdown: string;
}
