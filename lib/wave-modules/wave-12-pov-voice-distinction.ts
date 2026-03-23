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

const WAVE_NUMBER = 12;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave12PovVoiceDistinction(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 12 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 12 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const mods: string[] = [
		"meta:id:12",
		"meta:name:POV Voice Distinction",
		"meta:category:voice",
		"meta:scope:scene",
		"meta:criteria:POV_VOICE_DISTINCTION|FOCALIZATION",
		"analysis:description:Differentiates focal voices so each perspective remains instantly recognizable.",
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const s = scenes[i];
		const fp = /\bI\b/.test(s);
		const tp = /\b(he|she|they)\b/i.test(s);
		if (fp && tp) {
			mods.push(`scene-${i + 1}:flag-voice-blend-in-focalization`);
		}
	}
	mods.push("directive:increase-lexical-and-cadence-separation-between-pov-blocks");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 12 (${wave?.name ?? "POV Voice Distinction"}) completed analytical POV distinction pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
