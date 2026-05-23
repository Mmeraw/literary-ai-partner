import {
	CANON_DIALOGUE_TAGS,
	countCanonDialogueTags,
	hasCanonDialogueTag,
} from "../../../../lib/revision/canon/vocabulary";
import {
	buildVoiceProtectionModifications,
	classifyProtectedVoiceSpans,
	isProtectedVoiceSpan,
} from "../../../../lib/revision/canon/voiceProtection";
import wave19CharacterIdiolectSignatures from "../../../../lib/wave-modules/wave-19-character-idiolect-signatures";
import wave23AttributionFrictionReduction from "../../../../lib/wave-modules/wave-23-attribution-friction-reduction";
import wave54RepetitionAndEchoCleanup from "../../../../lib/wave-modules/wave-54-repetition-and-echo-cleanup";
import wave55RhythmAndCadencePolish from "../../../../lib/wave-modules/wave-55-rhythm-and-cadence-polish";

const STANDARD_MODE = "standard" as const;

describe("canon-bound revision voice protection", () => {
	test("dialogue tag registry is the single source used by attribution utilities", () => {
		expect(CANON_DIALOGUE_TAGS).toContain("said");
		expect(CANON_DIALOGUE_TAGS).toContain("whispered");
		expect(CANON_DIALOGUE_TAGS).toContain("rasped");

		const text = '"No time," she rasped. "Move," he said.';

		expect(hasCanonDialogueTag(text)).toBe(true);
		expect(countCanonDialogueTags(text)).toBe(2);
	});

	test("protects panic phrase repetition instead of treating it as generic cleanup", () => {
		const text = "No time. No time. He kept moving.";
		const hits = classifyProtectedVoiceSpans(text);

		expect(isProtectedVoiceSpan(text)).toBe(true);
		expect(hits.map((hit) => hit.protection)).toContain("PANIC_COGNITION");
		expect(buildVoiceProtectionModifications(text)).toContain(
			"voice-protection:PANIC_COGNITION:panic-cognition-phrase-repeat",
		);
	});

	test("protects dialect register as possible character voice", () => {
		const text = '"Ya gotta be kidding," he said.';
		const protections = classifyProtectedVoiceSpans(text).map((hit) => hit.protection);

		expect(protections).toContain("VOICE_DIALECT");
	});

	test("Wave 23 is bound to canonical dialogue tags", async () => {
		const result = await wave23AttributionFrictionReduction(
			'"No time," she rasped. "Move," he said.',
			[{ zone: "scene", issueType: "dialogue", recommendedWave: 23, priority: "medium" }],
			STANDARD_MODE,
		);

		expect(result.proposedText).toBe('"No time," she rasped. "Move," he said.');
		expect(result.changes).toEqual([]);
		expect(result.modifications).toContain("canon-bound:dialogue-tags");
		expect(result.modifications).toContain("attribution-chain-detected");
		expect(result.modifications).not.toContain("directive-verify-speaker-cues-without-explicit-tags");
	});

	test("Wave 19 surfaces protected voice signals without rewriting", async () => {
		const text = '"Ya gotta move," he said. "No time. No time."';
		const result = await wave19CharacterIdiolectSignatures(
			text,
			[{ zone: "scene", issueType: "voice", recommendedWave: 19, priority: "medium" }],
			"deep",
		);

		expect(result.proposedText).toBe(text);
		expect(result.changes).toEqual([]);
		expect(result.modifications).toContain("canon-bound:voice-protection");
		expect(result.modifications).toContain(
			"wave19-protect:VOICE_DIALECT:dialect-contraction-register",
		);
		expect(result.modifications).toContain(
			"wave19-protect:PANIC_COGNITION:panic-cognition-phrase-repeat",
		);
	});

	test("Wave 54 protects ritual repetition before cleanup", async () => {
		const text = "The chant came again and again. No time. No time.";
		const result = await wave54RepetitionAndEchoCleanup(
			text,
			[{ zone: "paragraph", issueType: "repetition", recommendedWave: 54, priority: "medium" }],
			STANDARD_MODE,
		);

		expect(result.proposedText).toBe(text);
		expect(result.changes).toEqual([]);
		expect(result.modifications).toContain("canon-bound:voice-protection");
		expect(result.modifications).toContain(
			"wave54-protect:CHANT_OR_SONG:chant-or-song-marker",
		);
		expect(result.modifications).toContain(
			"wave54-protect:PANIC_COGNITION:panic-cognition-phrase-repeat",
		);
	});

	test("Wave 55 surfaces cadence protection without changing prose", async () => {
		const text = "The refrain came soft, soft, soft, then hard. No time. No time.";
		const result = await wave55RhythmAndCadencePolish(
			text,
			[{ zone: "paragraph", issueType: "cadence", recommendedWave: 55, priority: "medium" }],
			STANDARD_MODE,
		);

		expect(result.proposedText).toBe(text);
		expect(result.changes).toEqual([]);
		expect(result.modifications).toContain("canon-bound:voice-protection");
		expect(result.modifications).toContain(
			"wave55-protect:RITUAL_REPETITION:ritual-repetition-marker",
		);
	});
});
