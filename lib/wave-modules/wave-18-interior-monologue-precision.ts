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

const WAVE_NUMBER = 18;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave18InteriorMonologuePrecision(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 18 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 18 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [
		"meta:id:18",
		"meta:name:Interior Monologue Precision",
		"meta:category:voice",
		"meta:scope:paragraph",
		"meta:criteria:INTERIORITY_PRECISION|POV_CONTAINMENT",
		"analysis:description:Refines internal thought prose for specificity, cadence, and viewpoint containment.",
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const p = paragraphs[i];
		if (/\b(he thought|she thought|they thought)\b/i.test(p) && /\b(I)\b/.test(p)) {
			mods.push(`paragraph-${i + 1}:flag-mixed-interiority-container`);
		}
		if (/\b(something|somehow|somewhat|sort of|kind of)\b/i.test(p)) {
			mods.push(`paragraph-${i + 1}:flag-vague-interior-language`);
		}
	}
	mods.push("directive-tighten-internal-thought-specificity-and-cadence");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 18 (${wave?.name ?? "Interior Monologue Precision"}) completed analytical interiority pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
