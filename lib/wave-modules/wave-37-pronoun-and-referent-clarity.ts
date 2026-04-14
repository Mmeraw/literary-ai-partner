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

const WAVE_NUMBER = 37;
const CRITERIA_IDS = ["REFERENT_CLARITY", "PRONOUN_RESOLUTION"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	return (text.match(/[^.!?]+[.!?]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export default async function wave37PronounAndReferentClarity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 37 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 37 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:sentence"] };
	}

	const sentences = splitSentences(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "proseControl"}`,
		`wave-meta:scope:${wave?.scope ?? "sentence"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < sentences.length; i += 1) {
		const sentence = sentences[i];
		const pronouns = sentence.match(/\b(he|she|they|it|this|that|these|those|him|her|them)\b/gi) ?? [];
		const namedEntities = sentence.match(/\b[A-Z][a-z]+\b/g) ?? [];
		if (pronouns.length >= 2 && namedEntities.length === 0) {
			modifications.push(`sentence-${i + 1}:flag-ambiguous-referent-cluster`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 37 (${wave?.name ?? "Pronoun and Referent Clarity"}) analyzed ambiguous pronoun and referent usage.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
