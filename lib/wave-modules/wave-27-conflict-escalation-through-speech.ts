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

const WAVE_NUMBER = 27;
const CRITERIA_IDS = ["VERBAL_CONFLICT", "STAKES_IN_DIALOGUE"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave27ConflictEscalationThroughSpeech(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 27 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 27 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const threatSignals = (text.match(/\b(no|never|can't|won't|unless|or else|leave|stop|don't)\b/gi) ?? []).length;
	const conciliatorySignals = (text.match(/\b(sorry|please|maybe|perhaps|fine)\b/gi) ?? []).length;
	if (threatSignals === 0) modifications.push("flag-low-verbal-conflict-pressure");
	if (threatSignals > 0) modifications.push(`verbal-conflict-signals:${threatSignals}`);
	if (conciliatorySignals > threatSignals && threatSignals < 2) modifications.push("directive-raise-stakes-through-speech-conflict");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 27 (${wave?.name ?? "Conflict Escalation Through Speech"}) analyzed whether dialogue increases stakes and forces consequential choices.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
