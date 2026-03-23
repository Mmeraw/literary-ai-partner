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

const WAVE_NUMBER = 34;
const CRITERIA_IDS = ["SENTENCE_ENERGY", "CADENCE_VARIATION"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	return (text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

function wordCount(input: string): number {
	return input.split(/\s+/).filter(Boolean).length;
}

export default async function wave34SentenceEnergyVariation(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 34 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 34 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:sentence"] };
	}

	const sentences = splitSentences(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "pacing"}`,
		`wave-meta:scope:${wave?.scope ?? "sentence"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const counts = sentences.map(wordCount);
	for (let i = 0; i < counts.length; i += 1) {
		modifications.push(`sentence-words:s${i + 1}:${counts[i]}`);
	}
	if (counts.length > 2 && new Set(counts.map((c) => Math.min(3, Math.floor(c / 8)))).size <= 1) {
		modifications.push("flag-monotone-sentence-cadence");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 34 (${wave?.name ?? "Sentence Energy Variation"}) analyzed sentence-length and cadence variation.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
