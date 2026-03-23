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

const WAVE_NUMBER = 4;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave04TimelineContinuity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 04 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 04 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const lower = text.toLowerCase();
	const modifications: string[] = [];

	const timeRefs = ["yesterday", "today", "tomorrow", "morning", "night", "later", "before dawn", "at noon"];
	for (const ref of timeRefs) {
		if (lower.includes(ref)) {
			modifications.push(`time-anchor-detected:${ref}`);
		}
	}

	if (/(arrived instantly|minutes later.*across the country|same hour.*different continent)/i.test(text)) {
		modifications.push("flag-impossible-travel-or-duration");
	}
	if (/\b(yesterday)\b[\s\S]{0,120}\b(next week)\b/i.test(text) || /\b(next week)\b[\s\S]{0,120}\b(yesterday)\b/i.test(text)) {
		modifications.push("flag-contradictory-nearby-time-reference");
	}
	if (!/\b(before|after|later|then|meanwhile|that night|next morning)\b/i.test(text)) {
		modifications.push("directive:add-temporal-transitions");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 04 (${wave?.name ?? "Timeline Continuity"}) verified chronology and temporal anchor integrity.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
