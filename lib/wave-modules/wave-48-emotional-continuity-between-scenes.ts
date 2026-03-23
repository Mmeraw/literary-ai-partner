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

const WAVE_NUMBER = 48;
const CRITERIA_IDS = ["EMOTIONAL_CONTINUITY", "AFFECTIVE_LOGIC"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

function emotionScore(scene: string): number {
	return (scene.match(/\b(afraid|angry|grief|shame|joy|panic|relief|calm|furious|sad)\b/gi) ?? []).length;
}

export default async function wave48EmotionalContinuityBetweenScenes(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 48 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 48 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	let previous: number | null = null;
	for (let i = 0; i < scenes.length; i += 1) {
		const score = emotionScore(scenes[i]);
		modifications.push(`emotion-score:s${i + 1}:${score}`);
		if (previous !== null && previous >= 3 && score === 0) {
			modifications.push(`scene-${i + 1}:flag-emotional-reset-without-bridge`);
		}
		previous = score;
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 48 (${wave?.name ?? "Emotional Continuity Between Scenes"}) analyzed emotional carryover and affective logic across scenes.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
