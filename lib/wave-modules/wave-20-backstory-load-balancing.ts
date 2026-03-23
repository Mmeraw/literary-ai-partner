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

const WAVE_NUMBER = 20;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave20BackstoryLoadBalancing(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 20 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 20 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [
		"meta:id:20",
		"meta:name:Backstory Load Balancing",
		"meta:category:character",
		"meta:scope:chapter",
		"meta:criteria:BACKSTORY_DOSING|EXPOSITION_BALANCE",
		"analysis:description:Distributes history reveals to maximize relevance and minimize exposition drag.",
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const p = paragraphs[i];
		const backstorySignals = (p.match(/\b(used to|years ago|back then|once|history|childhood|before this)\b/gi) ?? []).length;
		if (backstorySignals >= 3) {
			mods.push(`paragraph-${i + 1}:flag-backstory-cluster-density`);
		}
	}
	mods.push("directive-space-history-reveals-across-active-scenes");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 20 (${wave?.name ?? "Backstory Load Balancing"}) completed analytical backstory-load pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
