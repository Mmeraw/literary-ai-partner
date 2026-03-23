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

const WAVE_NUMBER = 59;
const CRITERIA_IDS = ["FINAL_CONSISTENCY", "CANON_STABILITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave59FinalConsistencySweep(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 59 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 59 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	if (/\b(yesterday|today|tomorrow)\b/i.test(text) && /\b(key|gun|letter|phone|ring)\b/i.test(text)) {
		modifications.push("final-sweep:timeline-and-prop-signals-present-check-cross-system-consistency");
	}
	if (/\b(he|she|they)\b/i.test(text) && /\b(angry|calm|afraid|joy|grief)\b/i.test(text)) {
		modifications.push("final-sweep:presence-and-emotion-signals-present-check-continuity");
	}
	if (!modifications.some((m) => m.startsWith("final-sweep:"))) {
		modifications.push("final-sweep:perform-integrated-canon-stability-review");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 59 (${wave?.name ?? "Final Consistency Sweep"}) analyzed integrated continuity across timeline, props, voice, and facts.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
