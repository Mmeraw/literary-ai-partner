import {
	type EditScope,
	isAllowedScope,
	type RevisionMode,
} from "@/lib/revision/surgicalEnforcement";
import { type WaveEntry, WAVE_REGISTRY } from "@/lib/revision/waveRegistry";

type WaveTarget = {
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

type WaveModuleResult = {
	waveNumber: number;
	success: boolean;
	notes: string;
	proposedText: string;
	changes: WaveChange[];
	modifications: string[];
};

const WAVE_NUMBER = 7;
const DRAG_PATTERNS: Array<{ pattern: RegExp; replacement: string; rationale: string }> = [
	{
		pattern: /\bHe paused, then paused again\b/g,
		replacement: "He paused once.",
		rationale: "Compress repeated hesitation for forward movement.",
	},
	{
		pattern: /\bShe stopped, then stopped again\b/g,
		replacement: "She stopped once.",
		rationale: "Remove duplicated pacing drag.",
	},
	{
		pattern: /\bfor a long moment\b/gi,
		replacement: "for a moment",
		rationale: "Tighten temporal drag phrase.",
	},
];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave07ActPacing(
	text: string,
	targets: WaveTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "sentence";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return {
			waveNumber: WAVE_NUMBER,
			success: true,
			notes: "Wave 07 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 07 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:sentence"],
		};
	}

	let proposedText = text;
	const changes: WaveChange[] = [];
	const modifications: string[] = [];

	for (const entry of DRAG_PATTERNS) {
		const matches = proposedText.match(entry.pattern);
		if (!matches || matches.length === 0) {
			continue;
		}

		for (const match of matches) {
			changes.push({
				type: "replace",
				targetText: match,
				replacementText: entry.replacement,
				rationale: entry.rationale,
			});
		}

		proposedText = proposedText.replace(entry.pattern, entry.replacement);
		modifications.push(`compressed:${entry.replacement}`);
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes:
			changes.length > 0
				? `Wave 07 (${wave?.name ?? "Act Pacing"}) compressed hesitation and pacing-drag patterns.`
				: `Wave 07 (${wave?.name ?? "Act Pacing"}) no-op: no drag patterns detected.`,
		proposedText,
		changes,
		modifications,
	};
}
