/**
 * Gate A6 — Report Credibility Layer
 * Canonical types for evaluation report credibility metadata
 */

export type RubricAxis = {
  key: string;
  label: string;
  score: number | null;
  explanation: string;
};

export type Credibility = {
  rubricBreakdown: RubricAxis[];
  confidence: number; // 0–1
  evidenceCount: number;
  coverageRatio: number; // processed / total
  varianceStability: number; // 0–1
  modelVersion: string;
};

export type ReportContent = {
  summary: string;
  overall_score: number;
  chunk_count: number;
  processed_count: number;
  generated_at: string;
  credibility?: Credibility; // Gate A6: optional for backward compatibility
};
