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

const WAVE_NUMBER = 28;
const CRITERIA_IDS = ["SPEAKER_RHYTHM", "VOICE_DIFFERENTIATION"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function getDialogueLines(text: string): string[] {
	return text.match(/"[^"]+"|“[^”]+”/g) ?? [];
}

function countWords(input: string): number {
	return input.replace(/["“”]/g, "").trim().split(/\s+/).filter(Boolean).length;
}

export default async function wave28DistinctSpeakerRhythm(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 28 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 28 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const lines = getDialogueLines(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const lengths = lines.map((line) => countWords(line));
	const uniqueLengths = new Set(lengths);
	if (lines.length > 2 && uniqueLengths.size <= 2) modifications.push("flag-flat-speaker-rhythm-variation");
	if (lengths.some((len) => len <= 3)) modifications.push("short-burst-rhythm-present");
	if (lengths.some((len) => len >= 14)) modifications.push("long-line-rhythm-present");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 28 (${wave?.name ?? "Distinct Speaker Rhythm"}) analyzed cadence and line-length differentiation among speakers.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
