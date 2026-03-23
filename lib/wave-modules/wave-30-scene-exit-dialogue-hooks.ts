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

const WAVE_NUMBER = 30;
const CRITERIA_IDS = ["EXIT_HOOKS", "SCENE_HANDOFF"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	return text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
}

export default async function wave30SceneExitDialogueHooks(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 30 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 30 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "dialogue"}`,
		`wave-meta:scope:${wave?.scope ?? "scene"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	for (let i = 0; i < scenes.length; i += 1) {
		const lines = scenes[i].match(/[^\n]+/g) ?? [];
		const lastLine = lines[lines.length - 1] ?? "";
		if (/"[^"]+"|“[^”]+”/.test(lastLine)) {
			if (/\?|\b(wait|tomorrow|unless|before|remember this|one more thing)\b/i.test(lastLine)) {
				modifications.push(`scene-${i + 1}:exit-hook-present`);
			} else {
				modifications.push(`scene-${i + 1}:flag-flat-dialogue-exit`);
			}
		}
	}

	if (!modifications.some((entry) => entry.includes("scene-"))) {
		modifications.push("flag-no-scene-closing-dialogue-hooks-detected");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 30 (${wave?.name ?? "Scene Exit Dialogue Hooks"}) analyzed scene-closing lines for curiosity and handoff pressure.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
