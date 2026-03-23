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

const WAVE_NUMBER = 21;
const CRITERIA_IDS = ["DIALOGUE_FUNCTION", "INTENT_DENSITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function getDialogueLines(text: string): string[] {
	return text.match(/"[^"]+"|“[^”]+”/g) ?? [];
}

function classifyGoal(line: string): string {
	const lower = line.toLowerCase();
	if (/\b(reveal|tell|truth|confess|admit|know)\b/.test(lower)) return "reveal";
	if (/\b(unless|or else|now|do it|must|can't|won't)\b/.test(lower)) return "pressure";
	if (/\b(not exactly|fine|sure|nothing|never mind)\b/.test(lower)) return "concealment";
	if (/\b(but|however|then|wait|listen|look)\b/.test(lower)) return "pivot";
	return "unclear";
}

export default async function wave21DialogueGoalPerLine(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 21 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 21 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const dialogueLines = getDialogueLines(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < dialogueLines.length; i += 1) {
		const goal = classifyGoal(dialogueLines[i]);
		if (goal === "unclear") {
			modifications.push(`line-${i + 1}:flag-unclear-dialogue-intent`);
		} else {
			modifications.push(`line-${i + 1}:dialogue-goal:${goal}`);
		}
	}

	if (dialogueLines.length === 0) {
		modifications.push("flag-no-dialogue-lines-detected-for-goal-analysis");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 21 (${wave?.name ?? "Dialogue Goal Per Line"}) analyzed whether each spoken line performs intent: pressure, concealment, reveal, or pivot.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
