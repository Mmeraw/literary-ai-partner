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

const WAVE_NUMBER = 43;
const CRITERIA_IDS = ["LATE_ENTRY", "SCENE_EFFICIENCY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave43SceneEntryTiming(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 43 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 43 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "scene"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const openingWords = scenes[i].split(/\s+/).slice(0, 20).join(" ");
		if (/\b(woke up|walked in|was there|there was|it was|began to)\b/i.test(openingWords)) {
			modifications.push(`scene-${i + 1}:flag-early-entry-before-consequential-motion`);
		}
		if (/\b(suddenly|must|before|ran|opened|said|found|realized)\b/i.test(openingWords)) {
			modifications.push(`scene-${i + 1}:entry-near-motion`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 43 (${wave?.name ?? "Scene Entry Timing"}) analyzed whether scenes begin late enough to catch consequential motion.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
