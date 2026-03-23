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

const WAVE_NUMBER = 9;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave09Foreshadowing(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 09 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 09 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [];
	const setupSignals = (text.match(/\b(foreshadow|hint|promise|vow|swear|one day|before long)\b/gi) ?? []).length;
	const payoffSignals = (text.match(/\b(payoff|fulfilled|resolved|came true|as promised|delivered)\b/gi) ?? []).length;

	if (setupSignals > payoffSignals) {
		modifications.push("flag-setup-without-clear-payoff-pathway");
	}
	if (payoffSignals > setupSignals + 1) {
		modifications.push("flag-payoff-with-insufficient-setup");
	}
	if (setupSignals === 0 && payoffSignals === 0) {
		modifications.push("directive-add-traceable-narrative-promises-and-payoffs");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 09 (${wave?.name ?? "Foreshadowing"}) tracked setup/payoff promise integrity.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
