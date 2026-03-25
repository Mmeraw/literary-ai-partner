/**
 * RevisionGrade Governance Types
 * Phase 2: Scene-level enforcement for the revision pipeline
 */

export type SceneType = 'PROPAGATING_SCENE' | 'VIGNETTE' | 'TRANSITION' | 'DOCTRINE';
export type SceneFunction = 'SYSTEM_EXPOSURE' | 'PROPAGATION' | 'TRANSITION' | 'DOCTRINAL_REFRAMING';
export type StoryLayer = 'HUMAN' | 'FROG' | 'REALM' | 'SCRIPTURE';
export type RevisionMode = 'DIAGNOSTIC_ONLY' | 'MICRO_EDIT' | 'FULL_REWRITE';
export type GovernanceStatus = 'PASS' | 'FAIL' | 'BLOCKED';

export interface GovernanceResult {
  pass: boolean;
  reason?: string;
}

export type WaveRejectionReason =
  | 'SCENE_TYPE_BLOCK'
  | 'SCENE_FUNCTION_BLOCK'
  | 'PROPAGATION_BLOCK'
  | 'MODE_BLOCK'
  | 'LAYER_BLOCK'
  | 'DESTRUCTION_LIMIT_BLOCK'
  | 'INTENT_LOCK_BLOCK'
  | 'SUFFICIENCY_BLOCK'
  | 'PATCH_VALIDATION_BLOCK';

export interface ProtectedSpan {
  start: number;
  end: number;
  reason: 'CHARACTER_IDENTITY' | 'CLASS_SIGNAL' | 'TONAL_ANCHOR' | 'DOCTRINAL_LANGUAGE' | 'USER_LOCKED_TEXT';
}

export interface WaveLayerPolicy {
  mayTouch: StoryLayer[];
  mayIntroduce: StoryLayer[];
}

export interface SceneContext {
  sceneId: string;
  chapterId: string;
  text: string;
  sceneType: SceneType;
  sceneFunction: SceneFunction;
  activeLayers: StoryLayer[];
  intent: string;
  protectedSpans: ProtectedSpan[];
  propagationRequired: boolean;
}

export interface PassResults {
  function: 'PASS' | 'FAIL' | 'MIXED';
  theme: 'PASS' | 'FAIL' | 'MIXED';
  tone: 'PASS' | 'FAIL' | 'MIXED';
  structure: 'PASS' | 'FAIL' | 'MIXED';
}

export interface WaveEligibilityResult {
  allowed: string[];
  rejected: Array<{
    waveId: string;
    reason: WaveRejectionReason;
    detail: string;
  }>;
  status: 'PASS' | 'FAIL';
}

export interface DiffSummary {
  charsRemoved: number;
  charsOriginal: number;
}

export interface RemovedRange {
  start: number;
  end: number;
}

export interface ProposedPatch {
  text: string;
  introducedLayers: StoryLayer[];
  diff: DiffSummary;
  removedRanges: RemovedRange[];
}

export interface PatchValidationResult {
  valid: boolean;
  violations: Array<{
    reason: WaveRejectionReason;
    detail: string;
  }>;
}

export interface GovernanceLogEntry {
  sceneId: string;
  chapterId: string;
  stage: string;
  status: GovernanceStatus;
  detail: string;
  data?: Record<string, unknown>;
}

export interface PipelineResult {
  action: 'EVALUATION_ONLY' | 'NO_CHANGE_REQUIRED' | 'WAVE_BLOCKED' | 'PATCH_REJECTED' | 'PATCH_ACCEPTED';
  originalText: string;
  finalText: string;
  mode: RevisionMode;
  executedWaves: string[];
  logs: GovernanceLogEntry[];
  rejections: Array<{
    waveId?: string;
    reason: WaveRejectionReason;
    detail: string;
  }>;
  passResults: PassResults;
}
