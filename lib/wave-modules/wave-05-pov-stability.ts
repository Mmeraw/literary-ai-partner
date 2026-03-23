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

const WAVE_NUMBER = 5;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	return (text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export default async function wave05PovStability(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 05 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 05 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const sentences = splitSentences(text);
	const modifications: string[] = [];
	const cognitionPattern = /\b(thought|knew|felt|wondered|remembered|noticed|realized)\b/i;
	const firstPerson = /\bI\b/;
	const thirdPerson = /\b(he|she|they)\b/i;

	let firstPersonCount = 0;
	let thirdPersonCount = 0;

	for (let i = 0; i < sentences.length; i += 1) {
		const s = sentences[i];
		if (firstPerson.test(s)) firstPersonCount += 1;
		if (thirdPerson.test(s)) thirdPersonCount += 1;
		if (cognitionPattern.test(s) && /\b(he|she|they)\b/i.test(s) && /\bI\b/.test(text)) {
			modifications.push(`sentence-${i + 1}:flag-possible-head-hop`);
		}
	}

	if (firstPersonCount > 0 && thirdPersonCount > 0) {
		modifications.push("flag-mixed-pov-signals");
	}
	modifications.push("directive:stabilize-narrative-distance-to-controlling-perspective");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 05 (${wave?.name ?? "POV Stability"}) analyzed perspective integrity and potential head-hopping.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
