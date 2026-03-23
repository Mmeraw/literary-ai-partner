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

const WAVE_NUMBER = 10;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

function normalize(scene: string): string {
	return scene.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export default async function wave10StructuralRedundancy(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 10 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 10 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const scenes = splitScenes(text);
	const seen = new Map<string, number>();
	const modifications: string[] = [];

	for (let i = 0; i < scenes.length; i += 1) {
		const n = normalize(scenes[i]);
		const key = n.split(" ").slice(0, 14).join(" ");
		if (key.length === 0) continue;
		if (seen.has(key)) {
			const first = seen.get(key) ?? 0;
			modifications.push(`flag-duplicate-scene-function:s${first + 1}->s${i + 1}`);
			modifications.push(`directive-compress-or-merge:s${i + 1}`);
		} else {
			seen.set(key, i);
		}
	}

	if (/\b(motif|symbol|echo|refrain)\b/i.test(text)) {
		modifications.push("protect-deliberate-motif-repetition");
	}
	if (modifications.length === 0) {
		modifications.push("no-structural-redundancy-detected");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 10 (${wave?.name ?? "Structural Redundancy"}) analyzed repeated scene functions and emotional beat duplication.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
