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

const WAVE_NUMBER = 60;
const POLISH_RULES: Array<{ pattern: RegExp; replacement: string; rationale: string }> = [
	{ pattern: /\bvery\b/gi, replacement: "", rationale: "Remove weak intensifier." },
	{ pattern: /\breally\b/gi, replacement: "", rationale: "Remove weak intensifier." },
	{ pattern: /\bquite\b/gi, replacement: "", rationale: "Remove weak intensifier." },
	{ pattern: /\bseemed to\b/gi, replacement: "appeared to", rationale: "Use stronger authority phrasing." },
	{ pattern: /\bin order to\b/gi, replacement: "to", rationale: "Tighten phrase for authority and concision." },
];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function cleanSpacing(text: string): string {
	return text
		.replace(/\s{2,}/g, " ")
		.replace(/\s+([,.;:!?])/g, "$1")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export default async function wave60FinalAuthorityPolish(
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
			notes: "Wave 60 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 60 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:sentence"],
		};
	}

	let proposedText = text;
	const changes: WaveChange[] = [];
	const modifications: string[] = [];

	for (const rule of POLISH_RULES) {
		const matches = proposedText.match(rule.pattern);
		if (!matches || matches.length === 0) {
			continue;
		}

		for (const match of matches) {
			changes.push({
				type: "replace",
				targetText: match,
				replacementText: rule.replacement,
				rationale: rule.rationale,
			});
		}

		proposedText = proposedText.replace(rule.pattern, rule.replacement);
		modifications.push(`authority-polish:${rule.rationale}`);
	}

	const cleaned = cleanSpacing(proposedText);
	if (cleaned !== proposedText) {
		changes.push({
			type: "replace",
			targetText: proposedText,
			replacementText: cleaned,
			rationale: "Normalize excess spacing after polish substitutions.",
		});
		modifications.push("spacing-cleanup");
		proposedText = cleaned;
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes:
			changes.length > 0
				? `Wave 60 (${wave?.name ?? "Final Authority Polish"}) removed weak intensifiers and tightened phrasing.`
				: `Wave 60 (${wave?.name ?? "Final Authority Polish"}) no-op: no weak intensifiers or target phrases found.`,
		proposedText,
		changes,
		modifications,
	};
}
