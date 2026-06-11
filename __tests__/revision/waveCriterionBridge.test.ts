/**
 * Wave Criterion Bridge tests
 *
 * Verifies that deriveWaveTargetsFromFindings produces manuscript-specific
 * wave IDs using the canonical criterion key → wave ID bridge, instead of
 * returning an empty array and falling back to generic waves.
 *
 * Root cause: The wave registry uses its own internal criterionIds
 * (STRUCTURE_SPINE, CLIMAX_CAUSALITY, etc.) that never appear in Pass 3
 * synthesis output. Pass 3 uses the 13 canonical keys (concept, narrativeDrive,
 * etc.). Without the bridge, the two token sets are completely disjoint.
 */
import { deriveWaveTargetsFromFindings } from "@/lib/revision/wavePlanner";

function buildPass3Findings(
	criteria: Array<{ key: string; final_score_0_10: number; recommendations?: unknown[] }>,
): Record<string, unknown> {
	return {
		criteria: criteria.map((c) => ({
			key: c.key,
			final_score_0_10: c.final_score_0_10,
			recommendations: c.recommendations ?? [],
			pressure_points: [],
			decision_points: [],
		})),
		overall: { overall_score_0_100: 80, verdict: "pass" },
	};
}

describe("Wave Criterion Bridge", () => {
	it("should derive non-empty wave IDs from standard Pass 3 findings", () => {
		const findings = buildPass3Findings([
			{ key: "concept", final_score_0_10: 7 },
			{ key: "narrativeDrive", final_score_0_10: 6 },
			{ key: "character", final_score_0_10: 8 },
			{ key: "voice", final_score_0_10: 7 },
			{ key: "pacing", final_score_0_10: 5 },
		]);

		const waveIds = deriveWaveTargetsFromFindings(findings);
		expect(waveIds.length).toBeGreaterThan(0);
	});

	it("should NOT return empty for Cartel Babies scores (all 8+)", () => {
		// This was the exact production failure: 13 criteria all scoring 8-10
		// returned 0 waves, triggering the generic fallback
		const findings = buildPass3Findings([
			{ key: "concept", final_score_0_10: 9 },
			{ key: "narrativeDrive", final_score_0_10: 8 },
			{ key: "character", final_score_0_10: 10 },
			{ key: "voice", final_score_0_10: 9 },
			{ key: "sceneConstruction", final_score_0_10: 9 },
			{ key: "dialogue", final_score_0_10: 9 },
			{ key: "theme", final_score_0_10: 10 },
			{ key: "worldbuilding", final_score_0_10: 10 },
			{ key: "pacing", final_score_0_10: 8 },
			{ key: "proseControl", final_score_0_10: 9 },
			{ key: "tone", final_score_0_10: 9 },
			{ key: "narrativeClosure", final_score_0_10: 9 },
			{ key: "marketability", final_score_0_10: 8 },
		]);

		const waveIds = deriveWaveTargetsFromFindings(findings);

		// Must produce manuscript-specific waves, not empty
		expect(waveIds.length).toBeGreaterThan(0);
		// Should be reasonable count (not zero, not all 63)
		expect(waveIds.length).toBeGreaterThanOrEqual(10);
		expect(waveIds.length).toBeLessThanOrEqual(30);
	});

	it("should produce more waves for low-scoring criteria than high-scoring", () => {
		const lowFindings = buildPass3Findings([
			{ key: "concept", final_score_0_10: 4 },
			{ key: "character", final_score_0_10: 5 },
			{ key: "pacing", final_score_0_10: 3 },
		]);
		const highFindings = buildPass3Findings([
			{ key: "concept", final_score_0_10: 9 },
			{ key: "character", final_score_0_10: 10 },
			{ key: "pacing", final_score_0_10: 9 },
		]);

		const lowWaves = deriveWaveTargetsFromFindings(lowFindings);
		const highWaves = deriveWaveTargetsFromFindings(highFindings);

		expect(lowWaves.length).toBeGreaterThan(highWaves.length);
	});

	it("should include continuity waves (59, 60) for score-10 criteria", () => {
		const findings = buildPass3Findings([
			{ key: "character", final_score_0_10: 10 },
			{ key: "theme", final_score_0_10: 10 },
		]);

		const waveIds = deriveWaveTargetsFromFindings(findings);

		// Wave 59 = Final Consistency, Wave 60 = Hook Alignment
		expect(waveIds).toContain(59);
		expect(waveIds).toContain(60);
	});

	it("should return empty array for empty findings (backward compat)", () => {
		const waveIds = deriveWaveTargetsFromFindings({});
		// Strategy 1 (token matching) and Strategy 2 (bridge) both find nothing
		expect(waveIds).toEqual([]);
	});

	it("should still match wave registry criterionIds via token scan (Strategy 1)", () => {
		// collectStringTokens normalizes each string value as a whole token,
		// so the value must be exactly a criterion ID to match
		const findings = {
			criteria: [],
			matched_criterion: "STRUCTURE_SPINE",
		};

		const waveIds = deriveWaveTargetsFromFindings(findings);
		// Wave 1 has criterionIds: ["STRUCTURE_SPINE", "CORE_CONFLICT"]
		expect(waveIds).toContain(1);
	});

	it("should include polish waves for criteria scoring 8-9", () => {
		const findings = buildPass3Findings([
			{ key: "proseControl", final_score_0_10: 9 },
		]);

		const waveIds = deriveWaveTargetsFromFindings(findings);
		// proseControl polish includes waves 51, 55, 56, 57, 58, 60
		expect(waveIds.length).toBeGreaterThanOrEqual(5);
		expect(waveIds).toContain(51); // Concision
	});

	it("should include structural waves for criteria scoring <= 7", () => {
		const findings = buildPass3Findings([
			{ key: "pacing", final_score_0_10: 5 },
		]);

		const waveIds = deriveWaveTargetsFromFindings(findings);
		// pacing structural bridge: [7, 31, 32, 33, 34, 35]
		expect(waveIds).toContain(7);
		expect(waveIds).toContain(31);
		// Should also include polish waves since score <= 9
		expect(waveIds).toContain(33);
		expect(waveIds).toContain(35);
	});
});
