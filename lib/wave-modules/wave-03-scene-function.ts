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

const WAVE_NUMBER = 3;

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

function splitScenes(text: string): string[] {
	const byBreak = text.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
	return byBreak.length > 0 ? byBreak : [text.trim()].filter(Boolean);
}

function classifyScene(scene: string): { advancesPlot: boolean; revealsCharacter: boolean; deepensTheme: boolean } {
	const lower = scene.toLowerCase();
	return {
		advancesPlot: /\b(decide|decided|choose|chose|action|acted|plan|goal|must|escape|find|consequence)\b/.test(lower),
		revealsCharacter: /\b(remembered|felt|thought|regret|fear|desire|ashamed|confessed|refused)\b/.test(lower),
		deepensTheme: /\b(truth|justice|power|faith|freedom|duty|cost|mercy|betrayal)\b/.test(lower),
	};
}

export default async function wave03SceneFunction(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "scene";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 03 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 03 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:scene"] };
	}

	const scenes = splitScenes(text);
	const modifications: string[] = [];

	for (let i = 0; i < scenes.length; i += 1) {
		const state = classifyScene(scenes[i]);
		const score = Number(state.advancesPlot) + Number(state.revealsCharacter) + Number(state.deepensTheme);
		if (score === 0) {
			modifications.push(`scene-${i + 1}:flag-cut-or-merge:no-plot-character-theme-advance`);
		} else if (score === 1) {
			modifications.push(`scene-${i + 1}:flag-escalate:single-axis-only`);
		} else {
			modifications.push(`scene-${i + 1}:state-change-present`);
		}
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 03 (${wave?.name ?? "Scene Function"}) analyzed scene utility and narrative state change.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
