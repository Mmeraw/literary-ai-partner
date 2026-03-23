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

const WAVE_NUMBER = 32;
const CRITERIA_IDS = ["TENSION_CURVE", "PRESSURE_CONTINUITY"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function scorePressure(paragraph: string): number {
	const lower = paragraph.toLowerCase();
	return (lower.match(/\b(danger|risk|threat|urgent|before|must|can't|won't|pressure|fear|deadline)\b/g) ?? []).length;
}

export default async function wave32TensionCurveContinuity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 32 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 32 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const paragraphs = splitParagraphs(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "pacing"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	let previousScore: number | null = null;
	for (let i = 0; i < paragraphs.length; i += 1) {
		const score = scorePressure(paragraphs[i]);
		modifications.push(`pressure:p${i + 1}:${score}`);
		if (previousScore !== null && previousScore >= 3 && score === 0) {
			modifications.push(`flag-tension-drop-without-bridge:p${i + 1}`);
		}
		previousScore = score;
	}

	if (!modifications.some((entry) => entry.startsWith("flag-"))) {
		modifications.push("tension-curve-continuity-stable");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 32 (${wave?.name ?? "Tension Curve Continuity"}) analyzed pressure continuity and intentional tension dips.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
