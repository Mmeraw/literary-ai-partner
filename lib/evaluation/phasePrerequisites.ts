export type EvaluationRoute = 'short_form' | 'long_form' | 'long_form_multi_layer' | 'unknown';

export type PhasePrerequisiteStatus = 'valid' | 'degraded_allowed' | 'skipped' | 'missing' | 'blocked' | 'failed';

export type PhasePrerequisiteName =
  | 'phase_0'
  | 'seed_0_5a_story_map'
  | 'seed_0_5a_evaluation'
  | 'seed_0_5b_dream'
  | 'phase_1a_story_layer'
  | 'phase_1a_ledger_quality'
  | 'phase_2_handoff';

export interface PhasePrerequisiteCheck {
  name: PhasePrerequisiteName;
  status: PhasePrerequisiteStatus;
  required: boolean;
  code?: string;
  reason: string;
}

export interface PhasePrerequisiteDecision {
  ok: boolean;
  checks: PhasePrerequisiteCheck[];
  blockingCodes: string[];
  publicMessage: string | null;
}

export interface PhasePrerequisiteArtifact {
  artifact_type?: string | null;
  content?: unknown;
}

export interface PhasePrerequisiteProgress {
  phase0_completed_at?: unknown;
  phase0_total_duration_ms?: unknown;
  phase0_calibration_word_count?: unknown;
}

const PHASE0_MIN_DURATION_MS = 11_900;
const PHASE0_MIN_WORDS = 500;
const LONG_FORM_WORD_THRESHOLD = 25_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasIsoLikeTimestamp(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function artifactContent(artifact: PhasePrerequisiteArtifact | null | undefined): Record<string, unknown> | null {
  return isRecord(artifact?.content) ? artifact.content : null;
}

function statusFromArtifact(
  artifact: PhasePrerequisiteArtifact | null | undefined,
  args: { name: PhasePrerequisiteName; required: boolean; label: string; allowDegraded: boolean },
): PhasePrerequisiteCheck {
  if (!artifact) {
    return {
      name: args.name,
      status: 'missing',
      required: args.required,
      code: `${args.name.toUpperCase()}_MISSING`,
      reason: `${args.label} artifact is missing.`,
    };
  }

  const content = artifactContent(artifact);
  const artifactStatus = typeof content?.artifact_status === 'string' ? content.artifact_status : null;
  const semanticStatus = typeof content?.semantic_status === 'string' ? content.semantic_status : null;
  const schemaValid = content?.schema_valid;

  if (artifactStatus === 'failed') {
    return {
      name: args.name,
      status: 'failed',
      required: args.required,
      code: `${args.name.toUpperCase()}_FAILED`,
      reason: `${args.label} artifact is marked failed.`,
    };
  }

  if (semanticStatus === 'blocked') {
    return {
      name: args.name,
      status: 'blocked',
      required: args.required,
      code: `${args.name.toUpperCase()}_BLOCKED`,
      reason: `${args.label} artifact is blocked.`,
    };
  }

  if (schemaValid === false) {
    return {
      name: args.name,
      status: 'blocked',
      required: args.required,
      code: `${args.name.toUpperCase()}_SCHEMA_INVALID`,
      reason: `${args.label} artifact failed schema validation.`,
    };
  }

  if (semanticStatus === 'degraded_with_reasons') {
    return {
      name: args.name,
      status: args.allowDegraded ? 'degraded_allowed' : 'blocked',
      required: args.required,
      code: args.allowDegraded ? `${args.name.toUpperCase()}_DEGRADED_ALLOWED` : `${args.name.toUpperCase()}_DEGRADED_BLOCKED`,
      reason: args.allowDegraded
        ? `${args.label} artifact is degraded but policy allows this phase to continue.`
        : `${args.label} artifact is degraded and this route requires clean upstream evidence.`,
    };
  }

  return {
    name: args.name,
    status: 'valid',
    required: args.required,
    reason: `${args.label} artifact is valid.`,
  };
}

export function resolveEvaluationRoute(args: {
  manuscriptWordCount?: number | null;
  requestedRoute?: string | null;
  reportType?: string | null;
}): EvaluationRoute {
  const route = `${args.requestedRoute ?? ''} ${args.reportType ?? ''}`.toLowerCase();
  if (route.includes('multi')) return 'long_form_multi_layer';
  if (route.includes('long')) return 'long_form';
  if (route.includes('short')) return 'short_form';

  const wordCount = asFiniteNumber(args.manuscriptWordCount);
  if (wordCount === null) return 'unknown';
  return wordCount >= LONG_FORM_WORD_THRESHOLD ? 'long_form' : 'short_form';
}

export function requiresDreamSeed(route: EvaluationRoute): boolean {
  return route === 'long_form' || route === 'long_form_multi_layer';
}

export function classifyPhase0Prerequisite(progress: PhasePrerequisiteProgress | null | undefined): PhasePrerequisiteCheck {
  const duration = asFiniteNumber(progress?.phase0_total_duration_ms);
  const words = asFiniteNumber(progress?.phase0_calibration_word_count);

  if (!hasIsoLikeTimestamp(progress?.phase0_completed_at)) {
    return {
      name: 'phase_0',
      status: 'missing',
      required: true,
      code: 'PHASE_0_MISSING',
      reason: 'Phase 0 did not complete.',
    };
  }

  if (duration === null || duration < PHASE0_MIN_DURATION_MS) {
    return {
      name: 'phase_0',
      status: 'blocked',
      required: true,
      code: 'PHASE_0_DWELL_INCOMPLETE',
      reason: 'Phase 0 completed without the required calibration dwell.',
    };
  }

  if (words === null || words < PHASE0_MIN_WORDS) {
    return {
      name: 'phase_0',
      status: 'blocked',
      required: true,
      code: 'PHASE_0_CALIBRATION_INCOMPLETE',
      reason: 'Phase 0 completed without enough calibration text.',
    };
  }

  return {
    name: 'phase_0',
    status: 'valid',
    required: true,
    reason: 'Phase 0 completed with enough calibration evidence.',
  };
}

function findArtifact(artifacts: PhasePrerequisiteArtifact[], artifactType: string): PhasePrerequisiteArtifact | null {
  return artifacts.find((artifact) => artifact.artifact_type === artifactType) ?? null;
}

export function evaluatePhase1aPrerequisites(args: {
  progress?: PhasePrerequisiteProgress | null;
  artifacts?: PhasePrerequisiteArtifact[] | null;
  route: EvaluationRoute;
  allowDegradedSeeds?: boolean;
}): PhasePrerequisiteDecision {
  const artifacts = args.artifacts ?? [];
  const allowDegraded = args.allowDegradedSeeds ?? false;
  const dreamRequired = requiresDreamSeed(args.route);

  const checks: PhasePrerequisiteCheck[] = [
    classifyPhase0Prerequisite(args.progress),
    statusFromArtifact(findArtifact(artifacts, 'story_map_seed_v1'), {
      name: 'seed_0_5a_story_map',
      required: true,
      label: 'Story Map Seed 0.5A',
      allowDegraded,
    }),
    statusFromArtifact(findArtifact(artifacts, 'evaluation_seed_v1'), {
      name: 'seed_0_5a_evaluation',
      required: true,
      label: 'Evaluation Seed 0.5A',
      allowDegraded,
    }),
  ];

  if (dreamRequired) {
    checks.push(
      statusFromArtifact(findArtifact(artifacts, 'editorial_dream_seed_v1'), {
        name: 'seed_0_5b_dream',
        required: true,
        label: 'DREAM Seed 0.5B',
        allowDegraded: false,
      }),
    );
  } else {
    checks.push({
      name: 'seed_0_5b_dream',
      status: 'skipped',
      required: false,
      reason: 'DREAM Seed 0.5B is skipped by design for short-form evaluations.',
    });
  }

  return decisionFromChecks(checks);
}

export function evaluatePhase2Prerequisites(args: {
  artifacts?: PhasePrerequisiteArtifact[] | null;
  route: EvaluationRoute;
  allowDegradedPhase1a?: boolean;
}): PhasePrerequisiteDecision {
  const artifacts = args.artifacts ?? [];
  const allowDegraded = args.allowDegradedPhase1a ?? args.route === 'short_form';
  const checks = [
    statusFromArtifact(findArtifact(artifacts, 'pass1a_story_layer_v1'), {
      name: 'phase_1a_story_layer',
      required: true,
      label: 'Phase 1A Story Layer',
      allowDegraded,
    }),
    statusFromArtifact(findArtifact(artifacts, 'ledger_quality_report_v1'), {
      name: 'phase_1a_ledger_quality',
      required: true,
      label: 'Phase 1A Ledger Quality Report',
      allowDegraded,
    }),
  ];

  return decisionFromChecks(checks);
}

export function evaluatePhase3Prerequisites(args: {
  artifacts?: PhasePrerequisiteArtifact[] | null;
}): PhasePrerequisiteDecision {
  const checks = [
    statusFromArtifact(findArtifact(args.artifacts ?? [], 'pass12_handoff_v1'), {
      name: 'phase_2_handoff',
      required: true,
      label: 'Phase 2 Handoff',
      allowDegraded: false,
    }),
  ];

  return decisionFromChecks(checks);
}

export function decisionFromChecks(checks: PhasePrerequisiteCheck[]): PhasePrerequisiteDecision {
  const blocking = checks.filter((check) =>
    check.required && (check.status === 'missing' || check.status === 'blocked' || check.status === 'failed'),
  );

  return {
    ok: blocking.length === 0,
    checks,
    blockingCodes: blocking.map((check) => check.code ?? `${check.name.toUpperCase()}_${check.status.toUpperCase()}`),
    publicMessage: blocking.length === 0
      ? null
      : 'We encountered a technical issue while processing your manuscript. To protect report accuracy, RevisionGrade paused this evaluation rather than generating an incomplete or potentially misleading report. Your manuscript and completed analysis have been preserved.',
  };
}
