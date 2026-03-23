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

const WAVE_NUMBER = 6;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave06OpeningAuthority(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 06 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 06 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const opening = text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean).slice(0, 2).join(" ");
	const mods: string[] = [];

	if (!/\b(want|need|must|danger|threat|before|if|until|consequence|risk)\b/i.test(opening)) {
		mods.push("flag-delay-to-first-tension-signal");
	}
	if (/\b(suddenly|somehow|it was|there was|in a world|once upon a time)\b/i.test(opening)) {
		mods.push("flag-soft-generic-opening-phrasing");
	}
	if (!/\b(I|he|she|they|name|mother|father|captain|doctor|detective|girl|boy)\b/i.test(opening)) {
		mods.push("flag-low-character-relevance-in-opening");
	}
	if (!/\b(stakes|cost|lose|failure|deadline|threat|danger)\b/i.test(opening)) {
		mods.push("directive-surface-immediate-stakes-and-voice-authority");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 06 (${wave?.name ?? "Opening Authority"}) analyzed voice authority and opening pull.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
