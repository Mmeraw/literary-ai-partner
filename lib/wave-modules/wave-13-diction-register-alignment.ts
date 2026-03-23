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

const WAVE_NUMBER = 13;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

export default async function wave13DictionRegisterAlignment(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "paragraph";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 13 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 13 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:paragraph"] };
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [
		"meta:id:13",
		"meta:name:Diction Register Alignment",
		"meta:category:voice",
		"meta:scope:paragraph",
		"meta:criteria:DICTION_REGISTER|LEXICAL_COHERENCE",
		"analysis:description:Aligns word choice register with genre, era, and character social positioning.",
	];

	for (let i = 0; i < paragraphs.length; i += 1) {
		const p = paragraphs[i];
		if (/\b(gonna|wanna|ain't)\b/i.test(p) && /\b(henceforth|therein|notwithstanding)\b/i.test(p)) {
			mods.push(`paragraph-${i + 1}:flag-register-collision-colloquial-vs-formal`);
		}
	}
	mods.push("directive:normalize-register-by-character-context-and-era");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 13 (${wave?.name ?? "Diction Register Alignment"}) completed analytical diction-register pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
