import {
	type EditScope,
	isAllowedScope,
	type RevisionMode,
} from "@/lib/revision/surgicalEnforcement";
import { type WaveEntry, WAVE_REGISTRY } from "@/lib/revision/waveRegistry";
import wave01Premise from "@/lib/wave-modules/wave-01-premise";
import wave02ChapterStructure from "@/lib/wave-modules/wave-02-chapter-structure";
import wave03SceneFunction from "@/lib/wave-modules/wave-03-scene-function";
import wave04TimelineContinuity from "@/lib/wave-modules/wave-04-timeline-continuity";
import wave05PovStability from "@/lib/wave-modules/wave-05-pov-stability";
import wave06OpeningAuthority from "@/lib/wave-modules/wave-06-opening-authority";
import wave07ActPacing from "@/lib/wave-modules/wave-07-act-pacing";
import wave08SubplotIntegration from "@/lib/wave-modules/wave-08-subplot-integration";
import wave09Foreshadowing from "@/lib/wave-modules/wave-09-foreshadowing";
import wave10StructuralRedundancy from "@/lib/wave-modules/wave-10-structural-redundancy";
import wave11NarrativeVoiceConsistency from "@/lib/wave-modules/wave-11-narrative-voice-consistency";
import wave12PovVoiceDistinction from "@/lib/wave-modules/wave-12-pov-voice-distinction";
import wave13DictionRegisterAlignment from "@/lib/wave-modules/wave-13-diction-register-alignment";
import wave14EmotionalToneModulation from "@/lib/wave-modules/wave-14-emotional-tone-modulation";
import wave15CharacterMotivationClarity from "@/lib/wave-modules/wave-15-character-motivation-clarity";
import wave16DesireObstacleEscalation from "@/lib/wave-modules/wave-16-desire-obstacle-escalation";
import wave17CharacterArcInflectionPoints from "@/lib/wave-modules/wave-17-character-arc-inflection-points";
import wave18InteriorMonologuePrecision from "@/lib/wave-modules/wave-18-interior-monologue-precision";
import wave19CharacterIdiolectSignatures from "@/lib/wave-modules/wave-19-character-idiolect-signatures";
import wave20BackstoryLoadBalancing from "@/lib/wave-modules/wave-20-backstory-load-balancing";
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
	2: wave02ChapterStructure,
	3: wave03SceneFunction,
	4: wave04TimelineContinuity,
	5: wave05PovStability,
	6: wave06OpeningAuthority,
	7: wave07ActPacing,
	8: wave08SubplotIntegration,
	9: wave09Foreshadowing,
	10: wave10StructuralRedundancy,
	11: wave11NarrativeVoiceConsistency,
	12: wave12PovVoiceDistinction,
	13: wave13DictionRegisterAlignment,
	14: wave14EmotionalToneModulation,
	15: wave15CharacterMotivationClarity,
	16: wave16DesireObstacleEscalation,
	17: wave17CharacterArcInflectionPoints,
	18: wave18InteriorMonologuePrecision,
	19: wave19CharacterIdiolectSignatures,
	20: wave20BackstoryLoadBalancing,
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
