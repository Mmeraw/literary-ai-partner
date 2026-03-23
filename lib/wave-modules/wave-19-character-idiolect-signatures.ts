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

const WAVE_NUMBER = 19;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitDialogueLines(text: string): string[] {
	return (text.match(/"[^"]+"|“[^”]+”/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export default async function wave19CharacterIdiolectSignatures(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 19 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 19 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const lines = splitDialogueLines(text);
	const mods: string[] = [
		"meta:id:19",
		"meta:name:Character Idiolect Signatures",
		"meta:category:character",
		"meta:scope:scene",
		"meta:criteria:IDIOLECT_SIGNATURE|CHARACTER_DIFFERENTIATION",
		"analysis:description:Builds distinct lexical and syntactic fingerprints for principal speakers.",
	];

	if (lines.length > 1) {
		let allSameLen = true;
		const baseline = lines[0].split(/\s+/).length;
		for (let i = 1; i < lines.length; i += 1) {
			if (Math.abs(lines[i].split(/\s+/).length - baseline) > 2) {
				allSameLen = false;
				break;
			}
		}
		if (allSameLen) {
			mods.push("flag-flat-dialogue-cadence-across-speakers");
		}
	}
	mods.push("directive-strengthen-speaker-specific-lexical-and-rhythmic-fingerprints");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 19 (${wave?.name ?? "Character Idiolect Signatures"}) completed analytical idiolect pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
