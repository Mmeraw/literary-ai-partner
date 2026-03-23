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

const WAVE_NUMBER = 11;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave11NarrativeVoiceConsistency(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 11 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 11 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [
		"meta:id:11",
		"meta:name:Narrative Voice Consistency",
		"meta:category:voice",
		"meta:scope:chapter",
		"meta:criteria:VOICE_CONSISTENCY|NARRATOR_STANCE",
		"analysis:description:Stabilizes narrator texture, stance, and lexical bias across the manuscript.",
	];

	let firstPerson = 0;
	let thirdPerson = 0;
	for (let i = 0; i < paragraphs.length; i += 1) {
		const p = paragraphs[i];
		if (/\bI\b/.test(p)) firstPerson += 1;
		if (/\b(he|she|they)\b/i.test(p)) thirdPerson += 1;
	}
	if (firstPerson > 0 && thirdPerson > 0) {
		mods.push("flag-voice-perspective-mixing");
	}
	mods.push("directive:stabilize-narrator-stance-and-lexical-bias");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 11 (${wave?.name ?? "Narrative Voice Consistency"}) completed analytical voice-consistency pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
