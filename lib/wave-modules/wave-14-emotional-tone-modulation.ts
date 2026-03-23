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

const WAVE_NUMBER = 14;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave14EmotionalToneModulation(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 14 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 14 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const mods: string[] = [
		"meta:id:14",
		"meta:name:Emotional Tone Modulation",
		"meta:category:voice",
		"meta:scope:scene",
		"meta:criteria:TONE_CONTROL|EMOTIONAL_ARC",
		"analysis:description:Shapes tonal gradients so emotional intensity rises and releases deliberately.",
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const s = scenes[i];
		const exclam = (s.match(/!/g) ?? []).length;
		if (exclam >= 4) {
			mods.push(`scene-${i + 1}:flag-overheated-tone-density`);
		}
		if (/\b(calm|quiet)\b/i.test(s) && /\b(panic|terror|rage)\b/i.test(s)) {
			mods.push(`scene-${i + 1}:flag-tone-whiplash-needs-bridge`);
		}
	}
	mods.push("directive:modulate-emotional-ramp-and-release-with-clear-bridges");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 14 (${wave?.name ?? "Emotional Tone Modulation"}) completed analytical tone-modulation pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
