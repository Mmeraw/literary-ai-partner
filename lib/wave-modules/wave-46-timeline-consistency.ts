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

const WAVE_NUMBER = 46;
const CRITERIA_IDS = ["TIMELINE_CONSISTENCY", "CHRONOLOGY_INTEGRITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave46TimelineConsistency(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 46 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 46 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const dayMarkers = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tomorrow)\b/gi) ?? [];
	if (dayMarkers.length > 0) {
		modifications.push(`time-markers-detected:${dayMarkers.length}`);
	}
	if (/\b(yesterday)\b[\s\S]{0,100}\b(today)\b[\s\S]{0,100}\b(yesterday)\b/i.test(text)) {
		modifications.push("flag-chronology-reversal-pattern");
	}
	if (/\b(hours later)\b[\s\S]{0,60}\b(sunrise)\b/i.test(text) && /\bmidnight\b/i.test(text)) {
		modifications.push("flag-time-math-feasibility-issue");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 46 (${wave?.name ?? "Timeline Consistency"}) analyzed chronology math and sequencing feasibility.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
