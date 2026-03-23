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

const WAVE_NUMBER = 45;
const CRITERIA_IDS = ["PROP_CONTINUITY", "STATE_TRACKING"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave45ContinuityPropTracking(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 45 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 45 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const propSignals = ["key", "gun", "letter", "phone", "knife", "ring", "bag", "book"];
	for (const prop of propSignals) {
		const hits = text.match(new RegExp(`\\b${prop}\\b`, "gi")) ?? [];
		if (hits.length >= 2) {
			modifications.push(`tracked-prop:${prop}:${hits.length}`);
		}
	}
	if (/\b(dropped|lost|set down|put away|pocketed)\b/i.test(text) && /\b(still holding|gripped)\b/i.test(text)) {
		modifications.push("flag-prop-state-conflict");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 45 (${wave?.name ?? "Continuity Prop Tracking"}) analyzed physical object continuity and state changes.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
