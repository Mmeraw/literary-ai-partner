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

const WAVE_NUMBER = 25;
const CRITERIA_IDS = ["SPEECH_OVERLAP", "CONVERSATION_REALISM"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave25InterruptionsAndOverlapNaturalism(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 25 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 25 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const cutoffs = (text.match(/—|\.\.\./g) ?? []).length;
	if (cutoffs === 0) modifications.push("directive-evaluate-whether-clean-lines-need-interruption-pressure");
	if (cutoffs > 6) modifications.push("flag-overused-cutoffs-or-overlap-markers");
	if (/"[^"]+[—.]"\s+"[^"]+/i.test(text)) modifications.push("overlap-pattern-detected");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 25 (${wave?.name ?? "Interruptions and Overlap Naturalism"}) analyzed interruption and overlap realism in speech.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
