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

const WAVE_NUMBER = 58;
const CRITERIA_IDS = ["FORMAT_READABILITY", "PRESENTATION_HYGIENE"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave58FormattingAndReadabilitySweep(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 58 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 58 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "polish"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	if (/\n{3,}/.test(text)) modifications.push("flag-excess-blank-lines");
	if (/\t/.test(text)) modifications.push("flag-tab-indentation-in-reading-copy");
	if (/\s{2,}/.test(text)) modifications.push("flag-excess-inline-spacing");
	if (!/\n\s*\n/.test(text)) modifications.push("directive-evaluate-paragraph-break-readability");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 58 (${wave?.name ?? "Formatting and Readability Sweep"}) analyzed formatting hygiene and presentation readability.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
