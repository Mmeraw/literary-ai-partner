/**
 * Regression suite: Density Repair + Template Completeness Gate
 *
 * Tests that buildLastResortRecommendations produces recs which always pass
 * isMeaningfulRecommendation for every criterion × score combination that
 * has historically triggered TEMPLATE_COMPLETENESS_GATE_FAILED or QG_* failures.
 *
 * Fixtures are derived from real failed evaluation jobs in production Supabase:
 *   - Sister (4,903 words)   — TEMPLATE_COMPLETENESS_GATE_FAILED × 4, QG_SHORT_REC, QG_FAILED, QG_LONG_REC
 *   - Cartel_Babies (109,472) — TEMPLATE_COMPLETENESS_GATE_FAILED × 2
 *   - Dear Players (443)      — QG_POV_MISSING_EVIDENCE
 */

import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { buildLastResortRecommendations } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { isMeaningfulRecommendation } from "@/lib/evaluation/pipeline/templateCompletenessGate";

export {};

// ─── Real production score profiles from failed jobs ────────────────────────
// Each entry: [jobId, failureCode, wordCount, criterion→score map]
const FAILED_JOB_PROFILES: Array<{
  jobId: string;
  failureCode: string;
  wordCount: number;
  scores: Record<string, number>;
}> = [
  {
    jobId: "2446968a",
    failureCode: "TEMPLATE_COMPLETENESS_GATE_FAILED",
    wordCount: 4903,
    scores: {
      concept: 7, narrativeDrive: 6, character: 8, voice: 7,
      sceneConstruction: 6, dialogue: 5, theme: 8, worldbuilding: 5,
      pacing: 5, proseControl: 7, tone: 7, narrativeClosure: 5, marketability: 6,
    },
  },
  {
    jobId: "f65018d3",
    failureCode: "TEMPLATE_COMPLETENESS_GATE_FAILED",
    wordCount: 4903,
    scores: {
      concept: 7, narrativeDrive: 6, character: 8, voice: 7,
      sceneConstruction: 6, dialogue: 4, theme: 8, worldbuilding: 7,
      pacing: 5, proseControl: 7, tone: 8, narrativeClosure: 5, marketability: 7,
    },
  },
  {
    jobId: "3389ade2",
    failureCode: "QG_SHORT_REC",
    wordCount: 4903,
    scores: {
      concept: 7, narrativeDrive: 6, character: 8, voice: 7,
      sceneConstruction: 6, dialogue: 5, theme: 7, worldbuilding: 6,
      pacing: 5, proseControl: 7, tone: 7, narrativeClosure: 5, marketability: 6,
    },
  },
  {
    jobId: "8fa29149",
    failureCode: "QG_FAILED",
    wordCount: 4903,
    scores: {
      concept: 7, narrativeDrive: 6, character: 8, voice: 7,
      sceneConstruction: 6, dialogue: 5, theme: 7, worldbuilding: 5,
      pacing: 5, proseControl: 7, tone: 8, narrativeClosure: 6, marketability: 5,
    },
  },
  {
    jobId: "49eb5a02",
    failureCode: "QG_LONG_REC",
    wordCount: 4903,
    scores: {
      concept: 7, narrativeDrive: 6, character: 8, voice: 7,
      sceneConstruction: 6, dialogue: 5, theme: 7, worldbuilding: 6,
      pacing: 5, proseControl: 6, tone: 7, narrativeClosure: 5, marketability: 6,
    },
  },
  {
    jobId: "24534861",
    failureCode: "TEMPLATE_COMPLETENESS_GATE_FAILED",
    wordCount: 109472,
    scores: {
      concept: 7, narrativeDrive: 8, character: 8, voice: 8,
      sceneConstruction: 8, dialogue: 8, theme: 8, worldbuilding: 8,
      pacing: 7, proseControl: 8, tone: 8, narrativeClosure: 6, marketability: 7,
    },
  },
  {
    jobId: "a7237540",
    failureCode: "TEMPLATE_COMPLETENESS_GATE_FAILED",
    wordCount: 109472,
    scores: {
      concept: 9, narrativeDrive: 8, character: 9, voice: 9,
      sceneConstruction: 9, dialogue: 9, theme: 9, worldbuilding: 9,
      pacing: 8, proseControl: 10, tone: 9, narrativeClosure: 7, marketability: 9,
    },
  },
  {
    jobId: "b2a4df4b",
    failureCode: "QG_POV_MISSING_EVIDENCE",
    wordCount: 443,
    scores: {
      concept: 5, narrativeDrive: 5, character: 5, voice: 6,
      sceneConstruction: 4, dialogue: 3, theme: 5, worldbuilding: 4,
      pacing: 4, proseControl: 5, tone: 5, narrativeClosure: 4, marketability: 4,
    },
  },
];

// ─── Density floor rules (mirrored from runPass3Synthesis) ──────────────────
const DENSITY_FLOOR: Record<string, number> = { "<=5": 2, "6-7": 1, "8": 1, "9": 1 };
function getBucket(score: number): string {
  return score <= 5 ? "<=5" : score <= 7 ? "6-7" : score === 8 ? "8" : "9";
}
function getMinRecs(score: number): number {
  if (score >= 10) return 0;
  return DENSITY_FLOOR[getBucket(score)] ?? 1;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Last-resort recs pass isMeaningfulRecommendation for all 13 criteria", () => {
  for (const key of CRITERIA_KEYS) {
    it(`${key} — score 5 (needs 2 recs)`, () => {
      const recs = buildLastResortRecommendations(key, 5, 2);
      expect(recs.length).toBe(2);
      for (const r of recs) {
        expect(isMeaningfulRecommendation(r)).toBe(true);
      }
    });

    it(`${key} — score 7 (needs 1 rec)`, () => {
      const recs = buildLastResortRecommendations(key, 7, 1);
      expect(recs.length).toBe(1);
      expect(isMeaningfulRecommendation(recs[0])).toBe(true);
    });
  }
});

describe("Last-resort recs fill density floor for real failed jobs", () => {
  for (const profile of FAILED_JOB_PROFILES) {
    describe(`Job ${profile.jobId} (${profile.failureCode}, ${profile.wordCount}w)`, () => {
      for (const [criterion, score] of Object.entries(profile.scores)) {
        const minRecs = getMinRecs(score);
        if (minRecs === 0) continue;

        it(`${criterion} score=${score} → ${minRecs} last-resort rec(s) all pass gate`, () => {
          const recs = buildLastResortRecommendations(criterion, score, minRecs);
          expect(recs.length).toBe(minRecs);
          for (const r of recs) {
            expect(isMeaningfulRecommendation(r)).toBe(true);
          }
        });
      }
    });
  }
});

describe("Exhaustive: every criterion × every score 0-9 produces passing recs", () => {
  for (const key of CRITERIA_KEYS) {
    for (let score = 0; score <= 9; score++) {
      const needed = getMinRecs(score);
      if (needed === 0) continue;

      it(`${key} score=${score} → ${needed} rec(s)`, () => {
        const recs = buildLastResortRecommendations(key, score, needed);
        expect(recs.length).toBe(needed);
        for (const r of recs) {
          expect(isMeaningfulRecommendation(r)).toBe(true);
        }
      });
    }
  }
});

describe("Edge cases", () => {
  it("needed=0 returns empty array", () => {
    expect(buildLastResortRecommendations("concept", 7, 0)).toEqual([]);
  });

  it("score=9 triggers density floor = 1 (growth area rec)", () => {
    expect(getMinRecs(9)).toBe(1);
    expect(getMinRecs(10)).toBe(0);
  });

  it("needed > 1 returns exactly the requested count", () => {
    const recs = buildLastResortRecommendations("pacing", 3, 3);
    expect(recs.length).toBe(3);
    for (const r of recs) {
      expect(isMeaningfulRecommendation(r)).toBe(true);
    }
  });

  it("all 13 criteria keys have last-resort templates", () => {
    for (const key of CRITERIA_KEYS) {
      const recs = buildLastResortRecommendations(key, 5, 1);
      expect(recs.length).toBeGreaterThan(0);
    }
  });

  it("last-resort recs have required structural fields", () => {
    for (const key of CRITERIA_KEYS) {
      const recs = buildLastResortRecommendations(key, 5, 1);
      const rec = recs[0] as Record<string, unknown>;
      expect(typeof rec.action).toBe("string");
      expect(typeof rec.specific_fix).toBe("string");
      expect(typeof rec.anchor_snippet).toBe("string");
      expect(typeof rec.symptom).toBe("string");
      expect(typeof rec.mechanism).toBe("string");
      expect(typeof rec.reader_effect).toBe("string");
      expect(typeof rec.expected_impact).toBe("string");
      expect((rec.action as string).length).toBeGreaterThanOrEqual(12);
      expect((rec.specific_fix as string).length).toBeGreaterThanOrEqual(12);
      expect((rec.anchor_snippet as string).length).toBeGreaterThanOrEqual(20);
      expect((rec.symptom as string).length).toBeGreaterThanOrEqual(20);
    }
  });
});
