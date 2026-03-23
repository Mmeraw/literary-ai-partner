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

const WAVE_NUMBER = 2;
const FUNCTION_SIGNALS = ["reveal", "escalate", "complicate", "resolve"] as const;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
}

function detectFunction(paragraph: string): string {
	const lower = paragraph.toLowerCase();
	if (/\b(reveal|disclose|uncover|learn|discover)\b/.test(lower)) return "reveal";
	if (/\b(escalate|worse|urgent|pressure|danger|threat)\b/.test(lower)) return "escalate";
	if (/\b(complicate|however|but|yet|obstacle|twist)\b/.test(lower)) return "complicate";
	if (/\b(resolve|therefore|finally|settled|concluded|ended)\b/.test(lower)) return "resolve";
	return "unknown";
}

export default async function wave02ChapterStructure(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return {
			waveNumber: WAVE_NUMBER,
			success: true,
			notes: "Wave 02 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 02 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:chapter"],
		};
	}

	const paragraphs = splitParagraphs(text);
	const mods: string[] = [];
	let previous = "";
	let progressionCount = 0;

	for (let i = 0; i < paragraphs.length; i += 1) {
		const fn = detectFunction(paragraphs[i]);
		if (fn !== "unknown" && FUNCTION_SIGNALS.includes(fn as (typeof FUNCTION_SIGNALS)[number])) {
			mods.push(`chapter-function:p${i + 1}:${fn}`);
		}
		if (fn !== "unknown" && fn !== previous) {
			progressionCount += 1;
		}
		if (fn !== "unknown" && previous === fn) {
			mods.push(`flag-repeat-function-without-progression:p${i + 1}:${fn}`);
		}
		if (fn !== "unknown") previous = fn;
	}

	if (progressionCount < 2) {
		mods.push("directive:add-clear-function-progression:reveal->escalate/complicate->resolve");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 02 (${wave?.name ?? "Chapter Structure"}) analyzed chapter narrative function progression.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
