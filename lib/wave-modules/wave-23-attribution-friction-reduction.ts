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

const WAVE_NUMBER = 23;
const CRITERIA_IDS = ["ATTRIBUTION_CLARITY", "DIALOGUE_FLOW"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave23AttributionFrictionReduction(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 23 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 23 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const tagMatches = text.match(/\b(said|asked|replied|whispered|shouted|murmured|snapped)\b/gi) ?? [];
	if (tagMatches.length > 6) modifications.push("flag-heavy-attribution-density");
	if (/"[^"]+"\s*,\s*[^\n]{0,25}\b(said|asked|replied)\b[\s\S]{0,60}"[^"]+"/i.test(text)) {
		modifications.push("attribution-chain-detected");
	}
	if (!/\b(said|asked|replied|whispered|shouted|murmured|snapped)\b/i.test(text)) {
		modifications.push("directive-verify-speaker-cues-without-explicit-tags");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 23 (${wave?.name ?? "Attribution Friction Reduction"}) analyzed dialogue tags, beats, and speaker-tracking friction.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
