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

const WAVE_NUMBER = 47;
const CRITERIA_IDS = ["PRESENCE_CONTINUITY", "CHARACTER_LOGISTICS"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave47CharacterPresenceContinuity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 47 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 47 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const scene = scenes[i];
		const presenceSignals = (scene.match(/\b(he|she|they|we|captain|doctor|mother|father|john|mary)\b/gi) ?? []).length;
		if (presenceSignals === 0) {
			modifications.push(`scene-${i + 1}:flag-unclear-character-presence`);
		}
		if (/\bentered\b/i.test(scene) && /\bwas already there\b/i.test(scene)) {
			modifications.push(`scene-${i + 1}:flag-presence-state-conflict`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 47 (${wave?.name ?? "Character Presence Continuity"}) analyzed who is present, absent, and aware across scenes.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
