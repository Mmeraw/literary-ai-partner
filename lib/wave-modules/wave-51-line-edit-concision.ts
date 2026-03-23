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

const WAVE_NUMBER = 51;
const CRITERIA_IDS = ["CONCISION", "LINE_EFFICIENCY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	return (text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

function wordCount(input: string): number {
	return input.split(/\s+/).filter(Boolean).length;
}

export default async function wave51LineEditConcision(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 51 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 51 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:sentence"] };
	}

	const sentences = splitSentences(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "polish"}`,
		`wave-meta:scope:${wave?.scope ?? "sentence"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < sentences.length; i += 1) {
		const count = wordCount(sentences[i]);
		if (count > 24) modifications.push(`sentence-${i + 1}:flag-wordy-line:${count}`);
		if (/\b(in order to|began to|started to|there was|it was)\b/i.test(sentences[i])) {
			modifications.push(`sentence-${i + 1}:flag-surplus-construction`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 51 (${wave?.name ?? "Line Edit Concision"}) analyzed sentence-level surplus wording and efficiency.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
