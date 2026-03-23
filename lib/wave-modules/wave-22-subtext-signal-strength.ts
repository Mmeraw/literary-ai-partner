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

const WAVE_NUMBER = 22;
const CRITERIA_IDS = ["SUBTEXT_DEPTH", "IMPLICIT_CONFLICT"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function getDialogueLines(text: string): string[] {
	return text.match(/"[^"]+"|“[^”]+”/g) ?? [];
}

export default async function wave22SubtextSignalStrength(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 22 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 22 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const lines = getDialogueLines(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const hasExplicitEmotion = /\b(angry|sad|afraid|love|hate|because i feel|i am upset)\b/i.test(line);
		const hasSubtextSignal = /\b(fine|sure|right|okay|nothing|whatever)\b/i.test(line) || /\.\.\.|—/.test(line);
		if (hasExplicitEmotion && !hasSubtextSignal) {
			modifications.push(`line-${i + 1}:flag-explicit-over-implicit-dialogue`);
		}
		if (hasSubtextSignal) {
			modifications.push(`line-${i + 1}:subtext-signal-present`);
		}
	}

	if (lines.length === 0) modifications.push("flag-no-dialogue-lines-detected-for-subtext-analysis");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 22 (${wave?.name ?? "Subtext Signal Strength"}) analyzed implied meaning beneath explicit speech.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
