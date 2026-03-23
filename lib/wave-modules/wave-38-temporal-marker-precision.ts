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

const WAVE_NUMBER = 38;
const CRITERIA_IDS = ["TEMPORAL_PRECISION", "TIMELINE_READABILITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave38TemporalMarkerPrecision(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 38 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 38 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "clarity"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const paragraph = paragraphs[i];
		if (/\b(later|afterward|then|soon)\b/i.test(paragraph) && !/\b(minutes|hours|days|night|morning|evening|noon|midnight)\b/i.test(paragraph)) {
			modifications.push(`paragraph-${i + 1}:flag-vague-temporal-marker`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 38 (${wave?.name ?? "Temporal Marker Precision"}) analyzed time markers for timeline readability.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
