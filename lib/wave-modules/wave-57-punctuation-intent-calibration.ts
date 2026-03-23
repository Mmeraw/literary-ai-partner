import {
	type RevisionMode,
	type EditScope,
	isAllowedScope,
} from "../revision/surgicalEnforcement";
import { type WaveEntry, WAVE_REGISTRY } from "../revision/waveRegistry";

export type RevisionTarget = {
	zone: string;
	issueType: string;
	recommendedWave: number;
	priority: string;
	directive?: string;
};

type WaveChange = {
	type: "replace" | "insert" | "delete";
	targetText: string;
	replacementText?: string;
	rationale: string;
};

export type WaveModuleResult = {
	waveNumber: number;
	success: boolean;
	notes: string;
	proposedText: string;
	changes: WaveChange[];
	modifications: string[];
};

const WAVE_NUMBER = 57;
const CRITERIA_IDS = ["PUNCTUATION_INTENT", "MICRO_PACING"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	return (text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export default async function wave57PunctuationIntentCalibration(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 57 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 57 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:sentence"] };
	}

	const sentences = splitSentences(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "polish"}`,
		`wave-meta:scope:${wave?.scope ?? "sentence"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < sentences.length; i += 1) {
		const sentence = sentences[i];
		const punctuationCount = (sentence.match(/[,:;—!?]/g) ?? []).length;
		if (punctuationCount >= 4) modifications.push(`sentence-${i + 1}:flag-heavy-punctuation-stack`);
		if (/!!|\.\.\.|,,|;;/.test(sentence)) modifications.push(`sentence-${i + 1}:flag-punctuation-intent-drift`);
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 57 (${wave?.name ?? "Punctuation Intent Calibration"}) analyzed punctuation for clarity, emphasis, and voice-consistent pacing.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
