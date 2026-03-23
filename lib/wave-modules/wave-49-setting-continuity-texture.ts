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

const WAVE_NUMBER = 49;
const CRITERIA_IDS = ["SETTING_CONTINUITY", "ENVIRONMENTAL_STABILITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave49SettingContinuityTexture(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 49 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 49 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "continuity"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const scene = scenes[i];
		const settingSignals = (scene.match(/\b(room|street|hall|kitchen|forest|rain|snow|sun|lamp|door|window|river)\b/gi) ?? []).length;
		if (settingSignals === 0) {
			modifications.push(`scene-${i + 1}:flag-thin-setting-texture`);
		}
		if (/\b(rain)\b/i.test(scene) && /\b(bright sun)\b/i.test(scene)) {
			modifications.push(`scene-${i + 1}:flag-setting-atmosphere-conflict`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 49 (${wave?.name ?? "Setting Continuity Texture"}) analyzed environmental continuity and atmospheric stability.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
