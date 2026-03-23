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

const WAVE_NUMBER = 8;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave08SubplotIntegration(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 08 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 08 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [];
	const lower = text.toLowerCase();

	if (/\bsubplot\b/.test(lower)) {
		modifications.push("subplot-beats-detected");
	}
	if (/\bsubplot\b/.test(lower) && !/\btherefore|because|as a result|which forced\b/.test(lower)) {
		modifications.push("flag-subplot-weak-causal-linkage-to-main-arc");
	}
	if (/\bside quest|detour|meanwhile\b/i.test(text) && !/\breturns?|rejoins?|affects?\b/i.test(text)) {
		modifications.push("flag-orphaned-subplot-beat");
	}
	modifications.push("directive-strengthen-subplot-to-main-arc-causality");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 08 (${wave?.name ?? "Subplot Integration"}) analyzed subplot relevance and causal integration.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
