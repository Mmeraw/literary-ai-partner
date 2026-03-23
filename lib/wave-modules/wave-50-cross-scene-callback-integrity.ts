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

const WAVE_NUMBER = 50;
const CRITERIA_IDS = ["CALLBACK_INTEGRITY", "LONG_RANGE_COHESION"];

function getWave(): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === WAVE_NUMBER);
}

export default async function wave50CrossSceneCallbackIntegrity(
	text: string,
	targets: RevisionTarget[],
	mode: RevisionMode,
): Promise<WaveModuleResult> {
	const wave = getWave();
	const scope: EditScope = "chapter";
	const requested = targets.some((t) => t.recommendedWave === WAVE_NUMBER);

	if (!requested) {
		return { waveNumber: WAVE_NUMBER, success: true, notes: "Wave 50 skipped: no matching recommendedWave in targets.", proposedText: text, changes: [], modifications: [] };
	}
	if (!isAllowedScope(scope, mode)) {
		return { waveNumber: WAVE_NUMBER, success: false, notes: "Wave 50 blocked by scope policy.", proposedText: text, changes: [], modifications: ["scope-blocked:chapter"] };
	}

	const modifications: string[] = [
		`wave-meta:category:${wave?.category ?? "scene"}`,
		`wave-meta:scope:${wave?.scope ?? "chapter"}`,
		...CRITERIA_IDS.map((id) => `criterion:${id}`),
	];

	const callbackSignals = ["promise", "echo", "again", "remember", "as before", "returned", "the same"];
	let callbackCount = 0;
	for (const signal of callbackSignals) {
		const hits = text.match(new RegExp(`\\b${signal.replace(/\s+/g, "\\s+")}\\b`, "gi")) ?? [];
		callbackCount += hits.length;
	}
	modifications.push(`callback-signals:${callbackCount}`);
	if (callbackCount === 0) {
		modifications.push("directive-verify-long-range-callback-payoffs");
	}
	if (/\b(promised|foreshadowed)\b/i.test(text) && !/\b(returned|resolved|fulfilled|echoed)\b/i.test(text)) {
		modifications.push("flag-setup-without-callback-resolution");
	}

	return {
		waveNumber: WAVE_NUMBER,
		success: true,
		notes: `Wave 50 (${wave?.name ?? "Cross-Scene Callback Integrity"}) analyzed long-range echoes, callbacks, and payoff cohesion.`,
		proposedText: text,
		changes: [],
		modifications,
	};
}
