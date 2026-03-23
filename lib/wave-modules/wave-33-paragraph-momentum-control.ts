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

const WAVE_NUMBER = 33;
const CRITERIA_IDS = ["PARAGRAPH_MOMENTUM", "READING_VELOCITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function wordCount(input: string): number {
	return input.split(/\s+/).filter(Boolean).length;
}

export default async function wave33ParagraphMomentumControl(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 33 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 33 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "pacing"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const count = wordCount(paragraphs[i]);
		modifications.push(`paragraph-words:p${i + 1}:${count}`);
		if (count > 120) modifications.push(`flag-long-paragraph-drag:p${i + 1}`);
		if (count < 8) modifications.push(`short-paragraph-burst:p${i + 1}`);
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 33 (${wave?.name ?? "Paragraph Momentum Control"}) analyzed paragraph length and momentum drag.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
