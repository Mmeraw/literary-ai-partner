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

const WAVE_NUMBER = 15;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave15CharacterMotivationClarity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 15 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 15 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const mods: string[] = [
		"meta:id:15",
		"meta:name:Character Motivation Clarity",
		"meta:category:character",
		"meta:scope:scene",
		"meta:criteria:MOTIVATION_CLARITY|CHARACTER_OBJECTIVE",
		"analysis:description:Makes immediate character objectives legible at decision points and reversals.",
	];

	for (let i = 0; i < scenes.length; i += 1) {
		if (!/\b(want|need|must|goal|decide|chose|refused)\b/i.test(scenes[i])) {
			mods.push(`scene-${i + 1}:flag-motivation-obscure`);
		}
	}
	mods.push("directive:surface-objective-language-at-decision-points");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 15 (${wave?.name ?? "Character Motivation Clarity"}) completed analytical motivation-clarity pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
