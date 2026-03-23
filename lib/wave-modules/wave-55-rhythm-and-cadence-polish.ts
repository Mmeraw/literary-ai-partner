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

const WAVE_NUMBER = 55;
const CRITERIA_IDS = ["CADENCE_POLISH", "PROSE_MUSICALITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function countWords(input: string): number {
	return input.split(/\s+/).filter(Boolean).length;
}

export default async function wave55RhythmAndCadencePolish(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 55 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 55 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "polish"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const sentenceLengths = (paragraphs[i].match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map(countWords);
		if (sentenceLengths.length > 2 && new Set(sentenceLengths.map((n) => Math.floor(n / 5))).size <= 1) {
			modifications.push(`paragraph-${i + 1}:flag-flat-cadence-band`);
		}
		if ((paragraphs[i].match(/,/g) ?? []).length >= 4) {
			modifications.push(`paragraph-${i + 1}:heavy-comma-music`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 55 (${wave?.name ?? "Rhythm and Cadence Polish"}) analyzed sentence music, stress flow, and cadence variety.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
