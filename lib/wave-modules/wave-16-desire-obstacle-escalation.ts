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

const WAVE_NUMBER = 16;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave16DesireObstacleEscalation(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 16 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 16 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const mods: string[] = [
		"meta:id:16",
		"meta:name:Desire-Obstacle Escalation",
		"meta:category:character",
		"meta:scope:scene",
		"meta:criteria:DESIRE_OBSTACLE|DRAMATIC_PRESSURE",
		"analysis:description:Escalates friction between want and resistance to sustain dramatic propulsion.",
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const s = scenes[i];
		const hasDesire = /\b(want|need|must|goal|desire)\b/i.test(s);
		const hasObstacle = /\b(but|however|blocked|failed|resisted|denied|obstacle)\b/i.test(s);
		if (hasDesire && !hasObstacle) {
			mods.push(`scene-${i + 1}:flag-desire-without-obstacle-escalation`);
		}
	}
	mods.push("directive:introduce-escalating-resistance-against-stated-desire");

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 16 (${wave?.name ?? "Desire-Obstacle Escalation"}) completed analytical desire/obstacle pass.`,
		proposedText: text,
		changes: [],
		modifications: mods,
	};
}
