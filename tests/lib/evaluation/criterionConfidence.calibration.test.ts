import { describe, expect, test } from "@jest/globals";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

const FIXTURE_DIR = join(__dirname, "fixtures", "criterion-artifacts");

interface FixtureCriterion {
  key: string;
  final_score_0_10: number | null;
  final_rationale: string | null;
  evidence: Array<{ snippet: string }>;
  recommendations?: Array<{
    action: string;
    anchor_snippet?: string;
  }>;
}

interface FixtureArtifact {
  job_id: string;
  source_text?: string;
  criteria: FixtureCriterion[];
}

function loadFixtures(): FixtureArtifact[] {
  if (!existsSync(FIXTURE_DIR)) return [];

  return readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const raw = readFileSync(join(FIXTURE_DIR, name), "utf8");
      return JSON.parse(raw) as FixtureArtifact;
    });
}

describe("computeCriterionConfidence — calibration harness", () => {
  const fixtures = loadFixtures();

  if (fixtures.length === 0) {
    test.skip("calibration harness skipped — no fixtures committed", () => {
      // Marker test: fixture-only, non-blocking by design.
    });
    return;
  }

  test.each(fixtures)(
    "fixture $job_id: every criterion produces bounded confidence output",
    (artifact) => {
      for (const criterion of artifact.criteria) {
        const result = computeCriterionConfidence(criterion, artifact.source_text);

        expect(typeof result.confidence_score_0_100).toBe("number");
        expect(result.confidence_score_0_100).toBeGreaterThanOrEqual(0);
        expect(result.confidence_score_0_100).toBeLessThanOrEqual(100);
        expect(["high", "moderate", "low"]).toContain(result.confidence_level);
        expect(["scorable", "scorable_low_confidence", "non_scorable"]).toContain(
          result.scorability_status,
        );
      }
    },
  );
});
