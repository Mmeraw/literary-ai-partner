export type Severity = "info" | "warning" | "fail";

export type TextAnchor = {
  excerpt: string;
  startOffset?: number;
  endOffset?: number;
  sceneRef?: string;
  paragraphRef?: string;
};

export type PovRenderType =
  | "integrated_cognition"
  | "marked_cognition"
  | "mixed_rendering"
  | "external_consciousness"
  | "audible_dialogue"
  | "unknown";

export type PovIssueCode =
  | "ITALICS_BASELINE_COGNITION"
  | "MIXED_THOUGHT_RENDERING_NO_LOGIC"
  | "NON_AUDITORY_IN_QUOTES"
  | "COGNITIVE_SOURCE_AMBIGUITY"
  | "THOUGHT_REPORTED_NOT_LIVED";

export type PovPositiveSignal =
  | "INTEGRATED_COGNITION_STRONG"
  | "ZERO_ITALICS_CLOSE_POV_VALID"
  | "THOUGHT_CHANNEL_STABLE"
  | "EXTERNAL_CONSCIOUSNESS_CORRECTLY_SEPARATED";

export type DialogueIssueCode =
  | "REDUNDANT_ATTRIBUTION"
  | "TAG_DENSITY_EXCEEDED"
  | "SOFT_TAG_OVERUSE"
  | "BEAT_REPLACEMENT_CANDIDATE"
  | "ATTRIBUTION_DEPENDENCY_HIGH";

export type DialoguePositiveSignal =
  | "DIALOGUE_SELF_SUPPORTING"
  | "ATTRIBUTION_MINIMAL_AND_CLEAR"
  | "VOICE_DIFFERENTIATION_SUFFICIENT"
  | "TAG_REMOVAL_SAFE";

export interface PovFinding {
  code: PovIssueCode | PovPositiveSignal;
  severity: Severity;
  renderType: PovRenderType;
  rationale: string;
  anchor: TextAnchor;
  ruleSource:
    | "VOL_II_POV_RENDERING_CONSISTENCY"
    | "VOL_II_WHISPER_RULE"
    | "VOL_II_FORMATTING_STANDARD";
}

export interface DialogueFinding {
  code: DialogueIssueCode | DialoguePositiveSignal;
  severity: Severity;
  rationale: string;
  anchor: TextAnchor;
  tag?: string;
  speakerCountEstimate?: number;
  removable?: boolean;
  ruleSource:
    | "GATE_15_1_ATTRIBUTION_DENSITY"
    | "GATE_15_1_SOFT_TAG_CAP"
    | "ATTRIBUTION_INDEPENDENCE_CHECK";
}

export interface PovDiagnosticSummary {
  dominantMode: PovRenderType;
  integratedThoughtCount: number;
  markedThoughtCount: number;
  mixedRenderingCount: number;
  externalConsciousnessCount: number;
  issueCount: number;
  findings: PovFinding[];
}

export interface DialogueDiagnosticSummary {
  totalDialogueLines: number;
  totalAttributionTags: number;
  tagsPerThousandWords: number;
  softTagCount: number;
  removableTagCount: number;
  dependencyScore: number;
  findings: DialogueFinding[];
}

export interface PovVoiceCriterionEvidencePack {
  criterion: "voice";
  pov: PovDiagnosticSummary;
  dialogue: DialogueDiagnosticSummary;
  requiredEvidencePresent: boolean;
  invalidReason?:
    | "MISSING_POV_EVIDENCE"
    | "MISSING_DIALOGUE_EVIDENCE"
    | "GENERIC_REASONING"
    | "NO_MANUSCRIPT_ANCHOR";
}
