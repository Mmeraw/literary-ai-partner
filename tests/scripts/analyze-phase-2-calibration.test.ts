import { describe, expect, it } from "@jest/globals";
import { analyzeCalibration } from "../../scripts/governance/analyze-phase-2-calibration";
import { TelemetryInputRecord } from "../../scripts/governance/types";

let jobCounter = 0;

function makeRecord(overrides: Partial<TelemetryInputRecord> = {}): TelemetryInputRecord {
  jobCounter += 1;
  return {
    job_id: `job-${jobCounter}`,
    manuscript_words: 30000,
    packet_source: "long_form_chunks_canonical",
    representation_compression_ratio: 0.15,
    compression_governance_state: "pass",
    manuscript_genre: "fantasy",
    manuscript_type: "novel",
    emitted_at: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("analyzeCalibration", () => {
  describe("empty input handling", () => {
    it("handles empty input gracefully", () => {
      const result = analyzeCalibration([]);
      expect(result.total_input_records).toBe(0);
      expect(result.long_form_record_count).toBe(0);
      expect(result.short_form_record_count_excluded).toBe(0);
      expect(result.statistical_summary).toBeNull();
      expect(result.outliers).toEqual([]);
      expect(result.class_coverage).toHaveLength(4);
      expect(result.histogram.length).toBeGreaterThan(0);
      expect(result.per_genre_breakdown).toEqual({});
      expect(result.phase_2_summary_markdown).toContain("Phase 2 Calibration Summary Artifact");
    });
  });

  describe("distribution and band coverage", () => {
    it("produces correct band counts and ratio summary", () => {
      const records: TelemetryInputRecord[] = [
        ...Array(5)
          .fill(0)
          .map(() =>
            makeRecord({ representation_compression_ratio: 0.2, compression_governance_state: "pass" }),
          ),
        ...Array(3)
          .fill(0)
          .map(() =>
            makeRecord({ representation_compression_ratio: 0.07, compression_governance_state: "warn" }),
          ),
        ...Array(2)
          .fill(0)
          .map(() =>
            makeRecord({ representation_compression_ratio: 0.03, compression_governance_state: "observe" }),
          ),
      ];

      const result = analyzeCalibration(records);
      const passEntry = result.class_coverage.find((c) => c.band === "pass");
      const warnEntry = result.class_coverage.find((c) => c.band === "warn");
      const observeEntry = result.class_coverage.find((c) => c.band === "observe");

      expect(passEntry?.count).toBe(5);
      expect(warnEntry?.count).toBe(3);
      expect(observeEntry?.count).toBe(2);
      expect(passEntry?.pct_of_long_form).toBe(50);
      expect(warnEntry?.pct_of_long_form).toBe(30);
      expect(observeEntry?.pct_of_long_form).toBe(20);

      expect(result.statistical_summary).not.toBeNull();
      expect(result.statistical_summary?.n).toBe(10);
      expect(result.statistical_summary?.min).toBeCloseTo(0.03, 4);
      expect(result.statistical_summary?.max).toBeCloseTo(0.2, 4);
    });
  });

  describe("mixed long-form + short-form handling", () => {
    it("excludes short-form from long-form analytics", () => {
      const records: TelemetryInputRecord[] = [
        ...Array(5)
          .fill(0)
          .map(() => makeRecord({ packet_source: "long_form_chunks_canonical" })),
        ...Array(3)
          .fill(0)
          .map(() =>
            makeRecord({
              packet_source: "short_form_initial_text",
              compression_governance_state: null,
              representation_compression_ratio: null,
              manuscript_words: 1200,
            }),
          ),
      ];

      const result = analyzeCalibration(records);
      expect(result.total_input_records).toBe(8);
      expect(result.long_form_record_count).toBe(5);
      expect(result.short_form_record_count_excluded).toBe(3);

      const totalBandCounts = result.class_coverage.reduce((sum, entry) => sum + entry.count, 0);
      expect(totalBandCounts).toBe(5);
    });
  });

  describe("manuscript grouping and dark criteria", () => {
    it("groups by manuscript class metadata and computes dark criteria frequency", () => {
      const records: TelemetryInputRecord[] = [
        makeRecord({ manuscript_class: "epic_fantasy", criteria_with_zero_evidence: ["sceneConstruction"] }),
        makeRecord({ manuscript_class: "epic_fantasy", criteria_with_zero_evidence: ["sceneConstruction", "voice"] }),
        makeRecord({ manuscript_genre: "mystery", manuscript_class: undefined, criteria_with_zero_evidence: ["voice"] }),
      ];

      const result = analyzeCalibration(records);
      expect(result.manuscript_class_grouping[0].manuscript_class).toBe("epic_fantasy");
      expect(result.manuscript_class_grouping[0].count).toBe(2);

      const sceneConstruction = result.dark_criteria_frequency.find(
        (entry) => entry.criterion_key === "sceneConstruction",
      );
      const voice = result.dark_criteria_frequency.find((entry) => entry.criterion_key === "voice");
      expect(sceneConstruction?.long_form_jobs_with_zero_evidence).toBe(2);
      expect(voice?.long_form_jobs_with_zero_evidence).toBe(2);
      expect(result.long_form_jobs_with_any_dark_criteria).toBe(3);
    });
  });

  describe("evidence density and outlier detection", () => {
    it("computes criterion evidence density and detects percentile outliers", () => {
      const records: TelemetryInputRecord[] = [
        makeRecord({
          representation_compression_ratio: 0.001,
          evidence_count_by_criterion: { concept: 0, sceneConstruction: 0, voice: 0 },
        }),
        ...Array(98)
          .fill(0)
          .map(() =>
            makeRecord({
              representation_compression_ratio: 0.15,
              evidence_count_by_criterion: { concept: 3, sceneConstruction: 2, voice: 1 },
            }),
          ),
        makeRecord({
          representation_compression_ratio: 0.99,
          evidence_count_by_criterion: { concept: 1, sceneConstruction: 0, voice: 0 },
        }),
      ];

      const result = analyzeCalibration(records);
      const conceptDensity = result.evidence_density_by_criterion.find(
        (entry) => entry.criterion_key === "concept",
      );

      expect(conceptDensity).toBeDefined();
      expect(conceptDensity!.avg_evidence_count_per_long_form_job).toBeGreaterThan(2.8);
      expect(conceptDensity!.pct_long_form_jobs_with_evidence).toBeGreaterThan(95);

      const hasLowOutlier = result.outliers.some((o) => o.reason === "below_p1");
      const hasHighOutlier = result.outliers.some((o) => o.reason === "above_p99");
      expect(hasLowOutlier).toBe(true);
      expect(hasHighOutlier).toBe(true);
    });
  });
});
