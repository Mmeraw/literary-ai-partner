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
import wave21DialogueGoalPerLine from "@/lib/wave-modules/wave-21-dialogue-goal-per-line";
import wave22SubtextSignalStrength from "@/lib/wave-modules/wave-22-subtext-signal-strength";
import wave23AttributionFrictionReduction from "@/lib/wave-modules/wave-23-attribution-friction-reduction";
import wave24DialogueBeatIntegration from "@/lib/wave-modules/wave-24-dialogue-beat-integration";
import wave25InterruptionsAndOverlapNaturalism from "@/lib/wave-modules/wave-25-interruptions-and-overlap-naturalism";
import wave26ExpositionInDialogueDeflation from "@/lib/wave-modules/wave-26-exposition-in-dialogue-deflation";
import wave27ConflictEscalationThroughSpeech from "@/lib/wave-modules/wave-27-conflict-escalation-through-speech";
import wave28DistinctSpeakerRhythm from "@/lib/wave-modules/wave-28-distinct-speaker-rhythm";
import wave29SilenceAndOmissionPlacement from "@/lib/wave-modules/wave-29-silence-and-omission-placement";
import wave30SceneExitDialogueHooks from "@/lib/wave-modules/wave-30-scene-exit-dialogue-hooks";
import wave31Escalation from "@/lib/wave-modules/wave-31-escalation";
import wave32TensionCurveContinuity from "@/lib/wave-modules/wave-32-tension-curve-continuity";
import wave33ParagraphMomentumControl from "@/lib/wave-modules/wave-33-paragraph-momentum-control";
import wave34SentenceEnergyVariation from "@/lib/wave-modules/wave-34-sentence-energy-variation";
import wave35DragSegmentCompression from "@/lib/wave-modules/wave-35-drag-segment-compression";
import wave36ClarityOfCausalLinks from "@/lib/wave-modules/wave-36-clarity-of-causal-links";
import wave37PronounAndReferentClarity from "@/lib/wave-modules/wave-37-pronoun-and-referent-clarity";
import wave38TemporalMarkerPrecision from "@/lib/wave-modules/wave-38-temporal-marker-precision";
import wave39SpatialOrientationClarity from "@/lib/wave-modules/wave-39-spatial-orientation-clarity";
import wave40CognitiveLoadReduction from "@/lib/wave-modules/wave-40-cognitive-load-reduction";
import wave41BreathRhythm from "@/lib/wave-modules/wave-41-breath-rhythm";
import wave42SceneTransitionCoherence from "@/lib/wave-modules/wave-42-scene-transition-coherence";
import wave43SceneEntryTiming from "@/lib/wave-modules/wave-43-scene-entry-timing";
import wave44SceneExitResonance from "@/lib/wave-modules/wave-44-scene-exit-resonance";
import wave45ContinuityPropTracking from "@/lib/wave-modules/wave-45-continuity-prop-tracking";
import wave46TimelineConsistency from "@/lib/wave-modules/wave-46-timeline-consistency";
import wave47CharacterPresenceContinuity from "@/lib/wave-modules/wave-47-character-presence-continuity";
import wave48EmotionalContinuityBetweenScenes from "@/lib/wave-modules/wave-48-emotional-continuity-between-scenes";
import wave49SettingContinuityTexture from "@/lib/wave-modules/wave-49-setting-continuity-texture";
import wave50CrossSceneCallbackIntegrity from "@/lib/wave-modules/wave-50-cross-scene-callback-integrity";
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
	21: wave21DialogueGoalPerLine,
	22: wave22SubtextSignalStrength,
	23: wave23AttributionFrictionReduction,
	24: wave24DialogueBeatIntegration,
	25: wave25InterruptionsAndOverlapNaturalism,
	26: wave26ExpositionInDialogueDeflation,
	27: wave27ConflictEscalationThroughSpeech,
	28: wave28DistinctSpeakerRhythm,
	29: wave29SilenceAndOmissionPlacement,
	30: wave30SceneExitDialogueHooks,
	31: wave31Escalation,
	32: wave32TensionCurveContinuity,
	33: wave33ParagraphMomentumControl,
	34: wave34SentenceEnergyVariation,
	35: wave35DragSegmentCompression,
	36: wave36ClarityOfCausalLinks,
	37: wave37PronounAndReferentClarity,
	38: wave38TemporalMarkerPrecision,
	39: wave39SpatialOrientationClarity,
	40: wave40CognitiveLoadReduction,
	41: wave41BreathRhythm,
	42: wave42SceneTransitionCoherence,
	43: wave43SceneEntryTiming,
	44: wave44SceneExitResonance,
	45: wave45ContinuityPropTracking,
	46: wave46TimelineConsistency,
	47: wave47CharacterPresenceContinuity,
	48: wave48EmotionalContinuityBetweenScenes,
	49: wave49SettingContinuityTexture,
	50: wave50CrossSceneCallbackIntegrity,
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
