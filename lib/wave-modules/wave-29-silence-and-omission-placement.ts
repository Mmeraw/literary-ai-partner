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

const WAVE_NUMBER = 29;
const CRITERIA_IDS = ["SILENCE_STRATEGY", "OMISSION_DRAMA"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave29SilenceAndOmissionPlacement(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 29 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 29 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const silenceSignals = (text.match(/\.\.\.|—|\b(silence|silent|said nothing|didn't answer|did not answer|no reply)\b/gi) ?? []).length;
	if (silenceSignals === 0) modifications.push("directive-evaluate-where-withheld-response-could-add-dramatic-leverage");
	if (silenceSignals > 0) modifications.push(`silence-signals:${silenceSignals}`);
	if (/\banswered immediately\b/i.test(text) && silenceSignals === 0) modifications.push("flag-low-omission-pressure");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 29 (${wave?.name ?? "Silence and Omission Placement"}) analyzed pauses, withheld replies, and dramatic gaps.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
