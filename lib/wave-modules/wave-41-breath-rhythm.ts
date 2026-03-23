import {
	type EditScope,
	isAllowedScope,
	type RevisionMode,
} from "@/lib/revision/surgicalEnforcement";
import { type WaveEntry, WAVE_REGISTRY } from "@/lib/revision/waveRegistry";

type WaveTarget = {
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

type WaveModuleResult = {
	waveNumber: number;
	success: boolean;
	notes: string;
	proposedText: string;
	changes: WaveChange[];
	modifications: string[];
};

const WAVE_NUMBER = 41;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitSentences(text: string): string[] {
	const matches = text.match(/[^.!?]+[.!?]*|[^.!?]+$/g);
	if (!matches) return text.trim().length > 0 ? [text.trim()] : [];
	return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

function wordCount(input: string): number {
	return input.trim().split(/\s+/).filter(Boolean).length;
}

function rebalanceBreath(sentence: string): string {
	return sentence.replace(/,\s+and\s+/g, ". And ");
}

export default async function wave41BreathRhythm(
	text: string,
	targets: WaveTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return {
			waveNumber: WAVE_NUMBER,
			success: true,
			notes: "Wave 41 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 41 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:sentence"],
		};
	}

	const sentences = splitSentences(text);
	const changes: WaveChange[] = [];
	const modifications: string[] = [];
	const transformed: string[] = [];

	for (const sentence of sentences) {
		const isOverlong = wordCount(sentence) >= 35;
		const hasCommaAnd = /,\s+and\s+/i.test(sentence);
		if (!isOverlong || !hasCommaAnd) {
			transformed.push(sentence);
			continue;
		}

		const replacement = rebalanceBreath(sentence);
		transformed.push(replacement);
		changes.push({
			type: "replace",
			targetText: sentence,
			replacementText: replacement,
			rationale: "Split overlong comma-and sentence into stronger breath units.",
		});
		modifications.push("split-overlong-comma-and");
	}

	const proposedText = transformed.join(" ").replace(/\s{2,}/g, " ").trim();

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes:
			changes.length > 0
				? `Wave 41 (${wave?.name ?? "Breath Rhythm"}) rebalanced overlong sentences.`
				: `Wave 41 (${wave?.name ?? "Breath Rhythm"}) no-op: no qualifying overlong comma-and sentences found.`,
		proposedText,
		changes,
		modifications,
	};
}
