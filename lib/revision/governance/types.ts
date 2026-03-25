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

export type WaveId = string;

export interface GovernanceContext {
  runId: string;
  sceneId: string;
  sceneType: SceneType;
  mode: RevisionMode;
  waveScores: Record<WaveId, number>;
  protectedSpanIds: string[];
}

export const WAVE_ORDER: WaveId[] = [
  'wave-01', 'wave-02', 'wave-03', 'wave-04', 'wave-05',
  'wave-06', 'wave-07', 'wave-08', 'wave-09', 'wave-10',
  'wave-11', 'wave-12', 'wave-13', 'wave-14', 'wave-15',
  'wave-16', 'wave-17', 'wave-18', 'wave-19', 'wave-20',
  'wave-21', 'wave-22', 'wave-23', 'wave-24', 'wave-25',
  'wave-26', 'wave-27', 'wave-28', 'wave-29', 'wave-30',
  'wave-31', 'wave-32', 'wave-33', 'wave-34', 'wave-35',
  'wave-36', 'wave-37', 'wave-38', 'wave-39', 'wave-40',
  'wave-41', 'wave-42', 'wave-43', 'wave-44', 'wave-45',
  'wave-46', 'wave-47', 'wave-48', 'wave-49', 'wave-50',
  'wave-51', 'wave-52', 'wave-53', 'wave-54', 'wave-55',
  'wave-56', 'wave-57', 'wave-58', 'wave-59', 'wave-60',
];

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
