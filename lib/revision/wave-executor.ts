import {
	type EditScope,
	isAllowedScope,
	type RevisionMode,
} from "@/lib/revision/surgicalEnforcement";
import { type WaveEntry, WAVE_REGISTRY } from "@/lib/revision/waveRegistry";
import wave01Premise from "@/lib/wave-modules/wave-01-premise";
import wave07ActPacing from "@/lib/wave-modules/wave-07-act-pacing";
import wave31Escalation from "@/lib/wave-modules/wave-31-escalation";
import wave41BreathRhythm from "@/lib/wave-modules/wave-41-breath-rhythm";
import wave60FinalAuthorityPolish from "@/lib/wave-modules/wave-60-final-authority-polish";

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

type WaveModule = (
	text: string,
	targets: WaveTarget[],
	mode: RevisionMode,
) => Promise<WaveModuleResult>;

export const WAVE_MODULES: Record<number, WaveModule> = {
	1: wave01Premise,
	7: wave07ActPacing,
	31: wave31Escalation,
	41: wave41BreathRhythm,
	60: wave60FinalAuthorityPolish,
};

export type ExecuteWaveModulesInput = {
	pipelineRunId?: string;
	text: string;
	targets: WaveTarget[];
	requestedWaves: number[];
	mode: RevisionMode;
};

export type ExecuteWaveModulesResult = {
	pipelineRunId: string;
	results: WaveModuleResult[];
	success: boolean;
	finalText: string;
};

const executionStore = new Map<string, ExecuteWaveModulesResult>();

function resolveWaveEntry(waveNumber: number): WaveEntry | undefined {
	return WAVE_REGISTRY.find((wave) => wave.id === waveNumber);
}

function getScopeForWave(wave: WaveEntry | undefined): EditScope {
	if (!wave) {
		return "sentence";
	}

	if (wave.scope === "sentence") return "sentence";
	if (wave.scope === "paragraph") return "paragraph";
	if (wave.scope === "scene") return "scene";
	return "chapter";
}

async function persistWaveExecution(result: ExecuteWaveModulesResult): Promise<void> {
	executionStore.set(result.pipelineRunId, result);
}

export function getPersistedWaveExecution(
	pipelineRunId: string,
): ExecuteWaveModulesResult | undefined {
	return executionStore.get(pipelineRunId);
}

export async function executeWaveModules(
	input: ExecuteWaveModulesInput,
): Promise<ExecuteWaveModulesResult> {
	const pipelineRunId = input.pipelineRunId ?? crypto.randomUUID();
	const results: WaveModuleResult[] = [];
	let currentText = input.text;

	for (const waveNumber of input.requestedWaves) {
		const module = WAVE_MODULES[waveNumber];
		const wave = resolveWaveEntry(waveNumber);
		const scope = getScopeForWave(wave);

		if (!module) {
			results.push({
				waveNumber,
				success: false,
				notes: "No module registered for requested wave.",
				proposedText: currentText,
				changes: [],
				modifications: ["module-missing"],
			});
			continue;
		}

		if (!isAllowedScope(scope, input.mode)) {
			results.push({
				waveNumber,
				success: false,
				notes: `Wave blocked by surgical scope policy (${scope}).`,
				proposedText: currentText,
				changes: [],
				modifications: [`scope-blocked:${scope}`],
			});
			continue;
		}

		const result = await module(currentText, input.targets, input.mode);
		results.push(result);

		if (result.success && result.proposedText !== currentText) {
			currentText = result.proposedText;
		}
	}

	const output: ExecuteWaveModulesResult = {
		pipelineRunId,
		results,
		success: results.every((r) => r.success),
		finalText: currentText,
	};

	await persistWaveExecution(output);
	return output;
}
