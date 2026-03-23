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

const WAVE_NUMBER = 31;
const ESCALATION_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
	{ pattern: /\bcould get bad\b/gi, replacement: "things could turn fatal" },
	{ pattern: /\bmight go wrong\b/gi, replacement: "it could collapse fast" },
	{ pattern: /\bfelt nervous\b/gi, replacement: "pressure tightened through him" },
];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave31Escalation(
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
			notes: "Wave 31 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 31 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:sentence"],
		};
	}

	let proposedText = text;
	const changes: WaveChange[] = [];
	const modifications: string[] = [];

	for (const rule of ESCALATION_REPLACEMENTS) {
		const matches = proposedText.match(rule.pattern);
		if (!matches || matches.length === 0) {
			continue;
		}

		for (const match of matches) {
			changes.push({
				type: "replace",
				targetText: match,
				replacementText: rule.replacement,
				rationale: "Replace vague escalation language with concrete pressure framing.",
			});
		}

		proposedText = proposedText.replace(rule.pattern, rule.replacement);
		modifications.push(`escalation-upgrade:${rule.replacement}`);
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes:
			changes.length > 0
				? `Wave 31 (${wave?.name ?? "Escalation"}) upgraded vague threat phrasing.`
				: `Wave 31 (${wave?.name ?? "Escalation"}) no-op: no vague escalation phrasing detected.`,
		proposedText,
		changes,
		modifications,
	};
}
