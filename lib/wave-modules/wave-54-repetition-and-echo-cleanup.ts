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

const WAVE_NUMBER = 54;
const CRITERIA_IDS = ["REPETITION_CLEANUP", "LEXICAL_VARIETY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function repeatedWord(paragraph: string): string | null {
	const words = paragraph.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
	const seen = new Set<string>();
	for (const word of words) {
		if (seen.has(word)) return word;
		seen.add(word);
	}
	return null;
}

export default async function wave54RepetitionAndEchoCleanup(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 54 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 54 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "polish"}`,
		`wave-meta:scope:${wave?.scope ?? "paragraph"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const repeated = repeatedWord(paragraphs[i]);
		if (repeated) modifications.push(`paragraph-${i + 1}:flag-repeated-word:${repeated}`);
	}
	if (/\b(motif|echo|refrain|symbol)\b/i.test(text)) {
		modifications.push("protect-intentional-motif-repetition");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 54 (${wave?.name ?? "Repetition and Echo Cleanup"}) analyzed accidental wording repetition while protecting motifs.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
