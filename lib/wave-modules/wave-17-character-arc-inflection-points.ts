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

const WAVE_NUMBER = 17;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave17CharacterArcInflectionPoints(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 17 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 17 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [
		"meta:id:17",
		"meta:name:Character Arc Inflection Points",
		"meta:category:character",
		"meta:scope:chapter",
		"meta:criteria:ARC_INFLECTION|CHARACTER_GROWTH",
		"analysis:description:Places attitude and behavior shifts at earned moments rather than convenience beats.",
	];

	for (let i = 1; i < paragraphs.length; i += 1) {
		const prev = paragraphs[i - 1];
		const curr = paragraphs[i];
		if (/\b(refused|hated|would never)\b/i.test(prev) && /\b(agreed|embraced|immediately accepted)\b/i.test(curr)) {
			mods.push(`paragraph-${i + 1}:flag-unearned-arc-flip`);
		}
	}
	mods.push("directive-anchor-arc-shifts-to-pressure-cost-or-revelation");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 17 (${wave?.name ?? "Character Arc Inflection Points"}) completed analytical arc-inflection pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
