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

const WAVE_NUMBER = 42;
const CRITERIA_IDS = ["SCENE_TRANSITIONS", "FLOW_CONTINUITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave42SceneTransitionCoherence(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 42 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 42 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 1; i < scenes.length; i += 1) {
		const current = scenes[i];
		const hasTransition = /\b(meanwhile|later|then|after|before|when|as|back at|across town|the next)\b/i.test(current);
		if (!hasTransition) {
			modifications.push(`scene-${i + 1}:flag-weak-handoff-from-previous-scene`);
		}
	}

	if (scenes.length <= 1) {
		modifications.push("insufficient-scene-count-for-transition-analysis");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 42 (${wave?.name ?? "Scene Transition Coherence"}) analyzed scene-to-scene handoff clarity for time, place, and momentum.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
