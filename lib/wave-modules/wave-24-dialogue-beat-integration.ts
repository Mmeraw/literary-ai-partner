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

const WAVE_NUMBER = 24;
const CRITERIA_IDS = ["DIALOGUE_BEATS", "EMBODIED_SPEECH"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave24DialogueBeatIntegration(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 24 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 24 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const dialogueCount = (text.match(/"[^"]+"|“[^”]+”/g) ?? []).length;
	const beatCount = (text.match(/\b(shrugged|looked|turned|stepped|smiled|flinched|nodded|stared|leaned)\b/gi) ?? []).length;
	if (dialogueCount > 0 && beatCount === 0) modifications.push("flag-unembodied-dialogue-exchange");
	if (beatCount > dialogueCount * 2 && dialogueCount > 0) modifications.push("flag-overloaded-action-beats-around-dialogue");
	if (dialogueCount > 0 && beatCount > 0) modifications.push("dialogue-beat-coupling-present");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 24 (${wave?.name ?? "Dialogue Beat Integration"}) analyzed action beats around speech for embodied blocking.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
