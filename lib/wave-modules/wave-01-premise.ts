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

const WAVE_NUMBER = 1;
const OPENING_SIGNAL_REGEX = /\b(want|need|must|search|find|escape|stop|save|kill|hide|leave|return|before|if)\b/i;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/g)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
}

function resolveAnchorLine(targets: WaveTarget[]): string {
	const firstDirective = targets.find((t) => t.recommendedWave === WAVE_NUMBER && t.directive?.trim())?.directive;
	if (firstDirective && firstDirective.trim().length > 0) {
		return `Premise anchor: ${firstDirective.trim()}`;
	}
	return "Premise anchor: They must pursue the central conflict now, before the cost hardens beyond repair.";
}

export default async function wave01Premise(
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
			notes: "Wave 01 skipped: no matching recommendedWave in targets.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (!isAllowedScope(scope, mode)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 01 blocked by scope policy.",
			proposedText: text,
			changes: [],
			modifications: ["scope-blocked:sentence"],
		};
	}

	const paragraphs = splitParagraphs(text);
	const opening = paragraphs[0] ?? text.trim();
	if (opening.length === 0) {
		return {
			waveNumber: WAVE_NUMBER,
			success: false,
			notes: "Wave 01 could not run: empty text.",
			proposedText: text,
			changes: [],
			modifications: [],
		};
	}

	if (OPENING_SIGNAL_REGEX.test(opening)) {
		return {
			waveNumber: WAVE_NUMBER,
			success: true,
			notes: `Wave 01 (${wave?.name ?? "Premise"}) no-op: opening already contains conflict/pursuit signal language.`,
			proposedText: text,
			changes: [],
			modifications: ["opening-signal-present"],
		};
	}

	const anchorLine = resolveAnchorLine(targets);
	const proposedText = `${anchorLine}\n\n${text.trim()}`;

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 01 (${wave?.name ?? "Premise"}) inserted premise anchor line at opening.`,
		proposedText,
		changes: [
			{
				type: "insert",
				targetText: opening,
				replacementText: `${anchorLine}\n\n${opening}`,
				rationale: "Opening lacked explicit pursuit/conflict signal words; injected premise anchor to establish directional pressure.",
			},
		],
		modifications: ["inserted-premise-anchor"],
	};
}
