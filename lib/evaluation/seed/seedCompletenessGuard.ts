import { CRITERIA_KEYS, type CriterionKey } from '@/schemas/criteria-keys';
import {
  STORY_LAYER_COUNT,
  STORY_LAYER_KEYS,
  type StoryLayerCoreLayerKey,
} from '@/lib/evaluation/artifacts/artifactTypes';
import type { SeedEvaluationMode } from '@/lib/evaluation/seed/seedScaffoldFactory';

export const SEED_FIT_GAP_REPORT_TYPE = 'seed_fit_gap_report_v1' as const;

export type SeedArtifactType = 'story_map_seed_v1' | 'evaluation_seed_v1';
export type SeedGapSeverity = 'blocker' | 'warning';

export type SeedFitGap = {
  artifact_type: SeedArtifactType;
  section: string;
  severity: SeedGapSeverity;
  message: string;
  required_action: string;
};

export type SeedFitGapReportV1 = {
  artifact_type: typeof SEED_FIT_GAP_REPORT_TYPE;
  status: 'blocked' | 'passed' | 'passed_with_warnings';
  generated_at: string;
  doctrine: 'complete_seed_artifacts_required_before_phase_1a';
  gaps: SeedFitGap[];
};

export class SeedFitGapBlockedError extends Error {
  readonly code = 'SEED_FIT_GAP_BLOCKED';
  readonly report: SeedFitGapReportV1;

  constructor(report: SeedFitGapReportV1) {
    const summary = report.gaps
      .filter((gap) => gap.severity === 'blocker')
      .map((gap) => `${gap.artifact_type}:${gap.section}`)
      .join(', ');

    super(`SEED_FIT_GAP_BLOCKED: ${summary}`);
    this.name = 'SeedFitGapBlockedError';
    this.report = report;
  }
}

export type StorySeedV1Minimum = {
  artifact_type: 'story_map_seed_v1';
  authority: 'seed_only';
  artifact_status: string;
  layer_scaffolds?: Partial<Record<StoryLayerCoreLayerKey, unknown>>;
  global_candidate_inputs?: {
    candidate_entity_registry?: unknown;
    candidate_alias_map?: unknown;
    candidate_pov_map?: unknown;
    candidate_relationship_map?: unknown;
    candidate_pressure_map?: unknown;
    candidate_object_shortlist?: unknown;
    candidate_location_map?: unknown;
    candidate_timeline_hypotheses?: unknown;
    uncertainty_flags?: unknown;
  };
  governance_rail?: {
    seed_must_be_used_as_phase1a_baseline?: unknown;
    phase1a_must_verify_seed_against_manuscript_evidence?: unknown;
    seed_may_authorize_downstream_truth?: unknown;
    accepted_story_ledger_required_for_phase2?: unknown;
  };
};

export type EvaluationSeedV1Minimum = {
  artifact_type: 'evaluation_seed_v1';
  authority: 'seed_only';
  artifact_status: string;
  manuscript_profile?: {
    word_count?: unknown;
    word_count_tier?: unknown;
    evaluation_mode?: unknown;
    work_type?: unknown;
  };
  reporting_template_path?: {
    selected_template?: unknown;
    short_form_template?: unknown;
    long_form_template?: unknown;
    long_form_multilayer_template?: unknown;
  };
  criterion_scaffolds?: Array<{ criterion_key?: CriterionKey | string }>;
  governance_rail?: {
    seed_must_be_used_as_phase1a_evaluation_baseline?: unknown;
    phase1a_must_verify_seed_against_manuscript_evidence?: unknown;
    seed_may_authorize_downstream_truth?: unknown;
    final_craft_scores_forbidden?: unknown;
    final_executive_verdict_forbidden?: unknown;
    accepted_story_ledger_required_for_phase2?: unknown;
  };
};

type CandidateInputKind = 'array' | 'record';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: unknown, key: string): boolean {
  return isRecord(record) && Object.prototype.hasOwnProperty.call(record, key);
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0;
}

function candidateInputMatchesKind(value: unknown, kind: CandidateInputKind): boolean {
  if (kind === 'array') return Array.isArray(value);
  return isRecord(value);
}

function pushGap(
  gaps: SeedFitGap[],
  artifact_type: SeedArtifactType,
  section: string,
  message: string,
  required_action: string,
  severity: SeedGapSeverity = 'blocker',
): void {
  gaps.push({ artifact_type, section, severity, message, required_action });
}

// ── Canonical layer scaffold template fields ──────────────────────────
// Every layer scaffold in a story_map_seed_v1 must contain these fields, matching
// the DREAM/gold standard benchmark format from seedScaffoldFactory.ts.
const LAYER_SCAFFOLD_REQUIRED_FIELDS = [
  'required_sections',
  'phase1a_must_fill',
  'phase1a_must_verify',
  'mistake_proofing',
] as const;

// ── Canonical evaluation mode ↔ template consistency ──────────────────
// The evaluation seed's mode must match the template selection.
const VALID_EVALUATION_MODES: readonly SeedEvaluationMode[] = [
  'short_form_evaluation',
  'long_form_evaluation',
  'long_form_multi_layer_evaluation',
];

// ── Canonical criterion scaffold template fields ──────────────────────
// Every criterion scaffold in an evaluation_seed_v1 must contain these fields.
const CRITERION_SCAFFOLD_REQUIRED_FIELDS = [
  'short_form_template_sections',
  'long_form_template_sections',
  'phase1a_must_collect',
  'mistake_proofing',
] as const;

export function validateStorySeedCompleteness(seed: unknown): SeedFitGap[] {
  const gaps: SeedFitGap[] = [];

  if (!isRecord(seed)) {
    pushGap(gaps, 'story_map_seed_v1', 'artifact', 'story_map_seed_v1 is missing or not an object.', 'Regenerate a complete story_map_seed_v1.');
    return gaps;
  }

  const artifact = seed as Partial<StorySeedV1Minimum>;

  if (artifact.artifact_type !== 'story_map_seed_v1') pushGap(gaps, 'story_map_seed_v1', 'artifact_type', 'Wrong or missing artifact_type.', 'Set artifact_type to story_map_seed_v1.');
  if (artifact.authority !== 'seed_only') pushGap(gaps, 'story_map_seed_v1', 'authority', 'Seed authority must be seed_only.', 'Regenerate with authority=seed_only.');
  if (!hasNonEmptyString(artifact.artifact_status)) pushGap(gaps, 'story_map_seed_v1', 'artifact_status', 'Missing artifact_status.', 'Set artifact_status to a non-empty lifecycle value.');

  if (!isRecord(artifact.layer_scaffolds)) {
    pushGap(gaps, 'story_map_seed_v1', 'layer_scaffolds', 'Missing complete Story Ledger layer scaffolds.', `Create scaffolds for all ${STORY_LAYER_COUNT} Story Ledger layers.`);
  } else {
    for (const layerKey of STORY_LAYER_KEYS) {
      if (!hasOwn(artifact.layer_scaffolds, layerKey)) {
        pushGap(gaps, 'story_map_seed_v1', `layer_scaffolds.${layerKey}`, `Missing scaffold for ${layerKey}.`, 'Seed must include every Story Ledger layer before Phase 1A.');
      } else if (!isNonEmptyRecord(artifact.layer_scaffolds[layerKey])) {
        pushGap(gaps, 'story_map_seed_v1', `layer_scaffolds.${layerKey}`, `Scaffold for ${layerKey} is empty or malformed.`, 'Seed scaffold must be a non-empty object with baseline expectations, risks, or required verification targets.');
      } else {
        // ── Layer scaffold format conformance ──
        // Each scaffold must match the canonical template: required_sections,
        // phase1a_must_fill, phase1a_must_verify, mistake_proofing.
        const scaffold = artifact.layer_scaffolds[layerKey] as Record<string, unknown>;
        for (const requiredField of LAYER_SCAFFOLD_REQUIRED_FIELDS) {
          if (!Array.isArray(scaffold[requiredField])) {
            pushGap(
              gaps, 'story_map_seed_v1',
              `layer_scaffolds.${layerKey}.${requiredField}`,
              `Layer scaffold for ${layerKey} missing required field '${requiredField}' (must be a non-empty array).`,
              `Add ${requiredField} matching the canonical template from DREAM/gold standard benchmarks.`,
              'warning',
            );
          } else if ((scaffold[requiredField] as unknown[]).length === 0) {
            pushGap(
              gaps, 'story_map_seed_v1',
              `layer_scaffolds.${layerKey}.${requiredField}`,
              `Layer scaffold for ${layerKey} has empty '${requiredField}' array.`,
              `Populate ${requiredField} with at least one entry from the canonical template.`,
              'warning',
            );
          }
        }
        if (scaffold.baseline_rule !== 'phase_1a_must_use_as_story_layer_creation_baseline') {
          pushGap(
            gaps, 'story_map_seed_v1',
            `layer_scaffolds.${layerKey}.baseline_rule`,
            `Layer scaffold for ${layerKey} missing or incorrect baseline_rule.`,
            'Set baseline_rule to "phase_1a_must_use_as_story_layer_creation_baseline".',
            'warning',
          );
        }
      }
    }
  }

  const inputs = artifact.global_candidate_inputs;
  const requiredInputs: Array<{ key: keyof NonNullable<StorySeedV1Minimum['global_candidate_inputs']>; kind: CandidateInputKind }> = [
    { key: 'candidate_entity_registry', kind: 'array' },
    { key: 'candidate_alias_map', kind: 'record' },
    { key: 'candidate_pov_map', kind: 'array' },
    { key: 'candidate_relationship_map', kind: 'array' },
    { key: 'candidate_pressure_map', kind: 'array' },
    { key: 'candidate_object_shortlist', kind: 'array' },
    { key: 'candidate_location_map', kind: 'array' },
    { key: 'candidate_timeline_hypotheses', kind: 'array' },
    { key: 'uncertainty_flags', kind: 'array' },
  ];
  for (const { key, kind } of requiredInputs) {
    if (!hasOwn(inputs, key)) {
      pushGap(gaps, 'story_map_seed_v1', `global_candidate_inputs.${key}`, `Missing ${key}.`, 'Regenerate story seed with all candidate input collections.');
    } else if (!candidateInputMatchesKind(inputs?.[key], kind)) {
      pushGap(gaps, 'story_map_seed_v1', `global_candidate_inputs.${key}`, `${key} has the wrong shape.`, `Expected ${kind === 'array' ? 'an array' : 'an object'} for ${key}.`);
    }
  }

  const rail = artifact.governance_rail;
  if (rail?.seed_must_be_used_as_phase1a_baseline !== true) pushGap(gaps, 'story_map_seed_v1', 'governance_rail.seed_must_be_used_as_phase1a_baseline', 'Story seed must be mandatory Phase 1A baseline.', 'Set true and enforce before chunk extraction.');
  if (rail?.phase1a_must_verify_seed_against_manuscript_evidence !== true) pushGap(gaps, 'story_map_seed_v1', 'governance_rail.phase1a_must_verify_seed_against_manuscript_evidence', 'Phase 1A verification must be mandatory.', 'Set true and record claim resolution.');
  if (rail?.seed_may_authorize_downstream_truth !== false) pushGap(gaps, 'story_map_seed_v1', 'governance_rail.seed_may_authorize_downstream_truth', 'Seed must never authorize downstream truth.', 'Set false.');
  if (rail?.accepted_story_ledger_required_for_phase2 !== true) pushGap(gaps, 'story_map_seed_v1', 'governance_rail.accepted_story_ledger_required_for_phase2', 'Phase 2 must require accepted_story_ledger_v1.', 'Set true and enforce Phase 2 gate.');

  return gaps;
}

export function validateEvaluationSeedCompleteness(seed: unknown): SeedFitGap[] {
  const gaps: SeedFitGap[] = [];

  if (!isRecord(seed)) {
    pushGap(gaps, 'evaluation_seed_v1', 'artifact', 'evaluation_seed_v1 is missing or not an object.', 'Regenerate a complete evaluation_seed_v1.');
    return gaps;
  }

  const artifact = seed as Partial<EvaluationSeedV1Minimum>;

  if (artifact.artifact_type !== 'evaluation_seed_v1') pushGap(gaps, 'evaluation_seed_v1', 'artifact_type', 'Wrong or missing artifact_type.', 'Set artifact_type to evaluation_seed_v1.');
  if (artifact.authority !== 'seed_only') pushGap(gaps, 'evaluation_seed_v1', 'authority', 'Seed authority must be seed_only.', 'Regenerate with authority=seed_only.');
  if (!hasNonEmptyString(artifact.artifact_status)) pushGap(gaps, 'evaluation_seed_v1', 'artifact_status', 'Missing artifact_status.', 'Set artifact_status to a non-empty lifecycle value.');

  const profile = artifact.manuscript_profile;
  if (!hasFiniteNumber(profile?.word_count)) pushGap(gaps, 'evaluation_seed_v1', 'manuscript_profile.word_count', 'Missing or invalid word_count.', 'Evaluation seed must include a finite numeric word_count.');
  for (const key of ['word_count_tier', 'evaluation_mode', 'work_type'] as const) {
    if (!hasNonEmptyString(profile?.[key])) pushGap(gaps, 'evaluation_seed_v1', `manuscript_profile.${key}`, `Missing ${key}.`, 'Evaluation seed must route short/long/multilayer mode before Phase 1A.');
  }

  // ── Evaluation mode validity: must be one of the three canonical forms ──
  const evalMode = profile?.evaluation_mode;
  if (
    hasNonEmptyString(evalMode) &&
    !VALID_EVALUATION_MODES.includes(evalMode as SeedEvaluationMode)
  ) {
    pushGap(
      gaps, 'evaluation_seed_v1',
      'manuscript_profile.evaluation_mode',
      `Invalid evaluation_mode '${String(evalMode)}'. Must be one of: ${VALID_EVALUATION_MODES.join(', ')}.`,
      'Set evaluation_mode to short_form_evaluation, long_form_evaluation, or long_form_multi_layer_evaluation.',
    );
  }

  const templates = artifact.reporting_template_path;
  for (const key of ['selected_template', 'short_form_template', 'long_form_template', 'long_form_multilayer_template'] as const) {
    if (!hasNonEmptyString(templates?.[key])) pushGap(gaps, 'evaluation_seed_v1', `reporting_template_path.${key}`, `Missing ${key}.`, 'Evaluation seed must carry polished short and long-form template paths.');
  }

  // ── Mode ↔ template consistency: selected_template must match evaluation_mode ──
  if (hasNonEmptyString(evalMode) && hasNonEmptyString(templates?.selected_template)) {
    const mode = evalMode as string;
    const selected = templates?.selected_template as string;
    const expectedTemplateSubstrings: Record<string, string> = {
      'short_form_evaluation': 'short-form',
      'long_form_evaluation': 'long-form-v',
      'long_form_multi_layer_evaluation': 'long-form-multilayer',
    };
    const expectedSub = expectedTemplateSubstrings[mode];
    if (expectedSub && !selected.includes(expectedSub)) {
      pushGap(
        gaps, 'evaluation_seed_v1',
        'reporting_template_path.selected_template',
        `Template '${selected}' does not match evaluation_mode '${mode}'. Expected template containing '${expectedSub}'.`,
        `Set selected_template to the canonical template for ${mode}.`,
      );
    }
  }

  const criteria = Array.isArray(artifact.criterion_scaffolds)
    ? artifact.criterion_scaffolds.filter(isRecord)
    : [];
  const malformedCriteria = Array.isArray(artifact.criterion_scaffolds)
    ? artifact.criterion_scaffolds.length - criteria.length
    : 0;

  if (!Array.isArray(artifact.criterion_scaffolds)) {
    pushGap(gaps, 'evaluation_seed_v1', 'criterion_scaffolds', 'criterion_scaffolds is missing or not an array.', 'Evaluation seed must scaffold all 13 criteria.');
  } else if (malformedCriteria > 0) {
    pushGap(gaps, 'evaluation_seed_v1', 'criterion_scaffolds.malformed', `${malformedCriteria} criterion scaffold item(s) are malformed.`, 'Every criterion scaffold must be an object with a criterion_key.');
  }

  const present = new Set(criteria.map((item) => item.criterion_key).filter(hasNonEmptyString));
  for (const key of CRITERIA_KEYS) {
    if (!present.has(key)) pushGap(gaps, 'evaluation_seed_v1', `criterion_scaffolds.${key}`, `Missing criterion scaffold for ${key}.`, 'Evaluation seed must scaffold all 13 criteria.');
  }

  // ── Criterion scaffold format conformance ──
  // Each criterion scaffold must contain the canonical template fields.
  for (const item of criteria) {
    const criterionKey = hasNonEmptyString(item.criterion_key) ? String(item.criterion_key) : 'unknown';
    for (const requiredField of CRITERION_SCAFFOLD_REQUIRED_FIELDS) {
      if (!Array.isArray(item[requiredField])) {
        pushGap(
          gaps, 'evaluation_seed_v1',
          `criterion_scaffolds.${criterionKey}.${requiredField}`,
          `Criterion scaffold for ${criterionKey} missing required field '${requiredField}'.`,
          `Add ${requiredField} matching the canonical template from DREAM/gold standard benchmarks.`,
          'warning',
        );
      } else if ((item[requiredField] as unknown[]).length === 0) {
        pushGap(
          gaps, 'evaluation_seed_v1',
          `criterion_scaffolds.${criterionKey}.${requiredField}`,
          `Criterion scaffold for ${criterionKey} has empty '${requiredField}'.`,
          `Populate ${requiredField} with canonical template entries.`,
          'warning',
        );
      }
    }
  }

  const rail = artifact.governance_rail;
  if (rail?.seed_must_be_used_as_phase1a_evaluation_baseline !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.seed_must_be_used_as_phase1a_evaluation_baseline', 'Evaluation seed must be mandatory Phase 1A baseline.', 'Set true and enforce before evaluation evidence extraction.');
  if (rail?.phase1a_must_verify_seed_against_manuscript_evidence !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.phase1a_must_verify_seed_against_manuscript_evidence', 'Phase 1A verification must be mandatory.', 'Set true and record fit-gap.');
  if (rail?.seed_may_authorize_downstream_truth !== false) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.seed_may_authorize_downstream_truth', 'Seed must never authorize downstream truth.', 'Set false.');
  if (rail?.final_craft_scores_forbidden !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.final_craft_scores_forbidden', 'Seed must not contain final craft scores.', 'Set true and reject scored seed artifacts.');
  if (rail?.final_executive_verdict_forbidden !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.final_executive_verdict_forbidden', 'Seed must not contain final executive verdict.', 'Set true and reject verdict-bearing seed artifacts.');
  if (rail?.accepted_story_ledger_required_for_phase2 !== true) pushGap(gaps, 'evaluation_seed_v1', 'governance_rail.accepted_story_ledger_required_for_phase2', 'Phase 2 must require accepted_story_ledger_v1.', 'Set true and enforce Phase 2 gate.');

  return gaps;
}

export function buildSeedFitGapReport(args: { storySeed: unknown; evaluationSeed: unknown; generatedAt?: string }): SeedFitGapReportV1 {
  const gaps = [
    ...validateStorySeedCompleteness(args.storySeed),
    ...validateEvaluationSeedCompleteness(args.evaluationSeed),
  ];
  const hasBlockers = gaps.some((gap) => gap.severity === 'blocker');
  return {
    artifact_type: SEED_FIT_GAP_REPORT_TYPE,
    status: hasBlockers ? 'blocked' : gaps.length > 0 ? 'passed_with_warnings' : 'passed',
    generated_at: args.generatedAt ?? new Date().toISOString(),
    doctrine: 'complete_seed_artifacts_required_before_phase_1a',
    gaps,
  };
}

export function assertSeedsCompleteForPhase1a(args: { storySeed: unknown; evaluationSeed: unknown }): void {
  const report = buildSeedFitGapReport(args);
  if (report.status === 'blocked') {
    throw new SeedFitGapBlockedError(report);
  }
}
