import wave23AttributionFrictionReduction from "../lib/wave-modules/wave-23-attribution-friction-reduction";

const STANDARD_MODE = "standard" as const;

const I44_DOMINATUS_INPUT = '"No time," she rasped. "Move," he said.';

describe("I:44 governed revision signal contract", () => {
	test("engine seam emits required canonical Wave 23 signals inclusively", async () => {
		const result = await wave23AttributionFrictionReduction(
			I44_DOMINATUS_INPUT,
			[
				{
					zone: "scene",
					issueType: "dialogue",
					recommendedWave: 23,
					priority: "medium",
				},
			],
			STANDARD_MODE,
		);

		expect(result.modifications).toEqual(
			expect.arrayContaining([
				"criterion:ATTRIBUTION_CLARITY",
				"criterion:DIALOGUE_FLOW",
				"canon-bound:dialogue-tags",
			]),
		);
	});
});
