/**
 * Mistake-proofed author-facing integrity repair for Pass 3 synthesis output.
 *
 * Recovery chain:
 *   1. Tier-1 normalization (normalizeArtifact).
 *   2. Whole-envelope validation (inspectAuthorFacingIntegrity).
 *   3. Targeted required-field regeneration, with fresh validation after every
 *      mutation and a strict mutation boundary.
 *   4. Targeted candidate-field regeneration/quarantine, with fresh validation.
 *   5. Final whole-envelope validation before the caller runs certification.
 *
 * Required and candidate prose keep separate retry counters.
 */

import { buildEnrichedActionItems } from '@/lib/evaluation/actionItemQualityGate';
import { normalizeArtifact } from '@/lib/evaluation/pipeline/normalizeArtifact';
import {
  attemptCandidateIntegrityRepair,
  isCandidateTextViolationPath,
} from '@/lib/evaluation/pipeline/candidateIntegrityRepair';
import {
  assertOnlyRequestedPathsChanged,
  regenerateRequiredProse,
} from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import type { SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import {
  AuthorFacingIntegrityError,
  inspectAuthorFacingIntegrity,
  type AuthorFacingIntegrityViolation,
} from '@/lib/text/authorFacingIntegrity';
import { ArtifactTextContractError } from '@/lib/evaluation/pipeline/normalizeArtifact';

export interface RepairSynthesisIntegrityOptions {
  openaiApiKey?: string;
  title?: string;
  manuscriptText?: string;
  maxRequiredAttempts?: number;
  maxCandidateAttempts?: number;
}

export interface RepairSynthesisIntegrityResult {
  ok: boolean;
  synthesis: SynthesisOutput;
  requiredAttempts: number;
  candidateAttempts: number;
  regeneratedFields: string[];
  quarantinedFields: string[];
  remainingViolations: AuthorFacingIntegrityViolation[];
  telemetry: Record<string, unknown>;
}

function buildAuthorEnvelope(
  synthesis: SynthesisOutput,
  quickWins: Array<Record<string, unknown>>,
  strategicRevisions: Array<Record<string, unknown>>,
) {
  return {
    overview: synthesis.overall,
    criteria: synthesis.criteria,
    recommendations: {
      quick_wins: quickWins,
      strategic_revisions: strategicRevisions,
    },
  };
}

function getQuickWins(synthesis: SynthesisOutput) {
  return buildEnrichedActionItems(
    synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
    'high',
    5,
  ) as Array<Record<string, unknown>>;
}

function getStrategicRevisions(synthesis: SynthesisOutput) {
  return buildEnrichedActionItems(
    synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
    'medium',
    5,
  ) as Array<Record<string, unknown>>;
}

function normalizeArtifactEnvelope(synthesis: SynthesisOutput) {
  const quickWins = getQuickWins(synthesis);
  const strategicRevisions = getStrategicRevisions(synthesis);
  normalizeArtifact(synthesis, quickWins, strategicRevisions);
  return { quickWins, strategicRevisions };
}

function collectViolations(
  synthesis: SynthesisOutput,
  quickWins: Array<Record<string, unknown>>,
  strategicRevisions: Array<Record<string, unknown>>,
  rootPath = 'evaluation_result_v2',
): AuthorFacingIntegrityViolation[] {
  return inspectAuthorFacingIntegrity(
    buildAuthorEnvelope(synthesis, quickWins, strategicRevisions),
    { rootPath },
  );
}

function contractErrorToViolation(err: ArtifactTextContractError): AuthorFacingIntegrityViolation {
  return {
    path: `evaluation_result_v2.${err.field}`,
    code: 'AUTHOR_TEXT_CONTRACT_FAILED' as AuthorFacingIntegrityViolation['code'],
    value: '',
    message: err.message,
  };
}

function normalizeViolations(violations: AuthorFacingIntegrityViolation[]) {
  const seen = new Set<string>();
  const out: AuthorFacingIntegrityViolation[] = [];
  for (const v of violations) {
    if (seen.has(v.path)) continue;
    seen.add(v.path);
    out.push(v);
  }
  return out;
}

export async function repairSynthesisIntegrity(
  synthesis: SynthesisOutput,
  options: RepairSynthesisIntegrityOptions = {},
): Promise<RepairSynthesisIntegrityResult> {
  const maxRequiredAttempts = options.maxRequiredAttempts ?? 2;
  const maxCandidateAttempts = options.maxCandidateAttempts ?? 2;

  const telemetry: Record<string, unknown> = {
    requiredAttempts: 0,
    candidateAttempts: 0,
    regeneratedFields: [],
    quarantinedFields: [],
    requiredAttemptsTelemetry: [],
    candidateAttemptsTelemetry: [],
  };

  let requiredAttempts = 0;
  let candidateAttempts = 0;
  let regeneratedFields: string[] = [];
  let quarantinedFields: string[] = [];

  // Required-prose repair loop.
  for (let i = 0; i < maxRequiredAttempts; i++) {
    let quickWins: Array<Record<string, unknown>> = [];
    let strategicRevisions: Array<Record<string, unknown>> = [];
    let violations: AuthorFacingIntegrityViolation[] = [];

    try {
      const envelope = normalizeArtifactEnvelope(synthesis);
      quickWins = envelope.quickWins;
      strategicRevisions = envelope.strategicRevisions;
      violations = collectViolations(synthesis, quickWins, strategicRevisions);
    } catch (err) {
      if (err instanceof ArtifactTextContractError) {
        violations = [contractErrorToViolation(err)];
      } else if (err instanceof AuthorFacingIntegrityError) {
        violations = err.violations;
      } else {
        throw err;
      }
    }

    const required = normalizeViolations(violations.filter((v) => !isCandidateTextViolationPath(v.path)));
    if (required.length === 0) break;

    requiredAttempts++;
    const beforeSnapshot: SynthesisOutput = JSON.parse(JSON.stringify(synthesis));
    const result = await regenerateRequiredProse(synthesis, required, {
      openaiApiKey: options.openaiApiKey,
      title: options.title,
      manuscriptText: options.manuscriptText,
    });
    telemetry.requiredAttemptsTelemetry = [
      ...(telemetry.requiredAttemptsTelemetry as Record<string, unknown>[]),
      result.telemetry,
    ];
    regeneratedFields = [...new Set([...regeneratedFields, ...result.regeneratedFields])];

    const illegalMutations = assertOnlyRequestedPathsChanged(
      beforeSnapshot,
      synthesis,
      required.map((v) => v.path),
    );
    if (illegalMutations.length > 0) {
      Object.assign(synthesis, beforeSnapshot);
      return {
        ok: false,
        synthesis,
        requiredAttempts,
        candidateAttempts,
        regeneratedFields,
        quarantinedFields,
        remainingViolations: required,
        telemetry: {
          ...telemetry,
          mutationBoundaryViolations: illegalMutations,
        },
      };
    }
  }

  // Candidate-prose repair loop.
  for (let i = 0; i < maxCandidateAttempts; i++) {
    let quickWins: Array<Record<string, unknown>> = [];
    let strategicRevisions: Array<Record<string, unknown>> = [];
    let violations: AuthorFacingIntegrityViolation[] = [];

    try {
      const envelope = normalizeArtifactEnvelope(synthesis);
      quickWins = envelope.quickWins;
      strategicRevisions = envelope.strategicRevisions;
      violations = collectViolations(synthesis, quickWins, strategicRevisions);
    } catch (err) {
      if (err instanceof ArtifactTextContractError) {
        violations = [contractErrorToViolation(err)];
      } else if (err instanceof AuthorFacingIntegrityError) {
        violations = err.violations;
      } else {
        throw err;
      }
    }

    const candidates = normalizeViolations(violations.filter((v) => isCandidateTextViolationPath(v.path)));
    if (candidates.length === 0) break;

    candidateAttempts++;
    const candidateError = new AuthorFacingIntegrityError(candidates);
    const result = attemptCandidateIntegrityRepair(synthesis, candidateError);
    telemetry.candidateAttemptsTelemetry = [
      ...(telemetry.candidateAttemptsTelemetry as Record<string, unknown>[]),
      result.telemetry,
    ];
    quarantinedFields = [...new Set([...quarantinedFields, ...result.affectedPaths])];
  }

  // Final validation: normalize + inspect to produce the canonical remaining list.
  let finalViolations: AuthorFacingIntegrityViolation[] = [];
  let finalQuickWins: Array<Record<string, unknown>> = [];
  let finalStrategicRevisions: Array<Record<string, unknown>> = [];

  try {
    const envelope = normalizeArtifactEnvelope(synthesis);
    finalQuickWins = envelope.quickWins;
    finalStrategicRevisions = envelope.strategicRevisions;
    finalViolations = collectViolations(synthesis, finalQuickWins, finalStrategicRevisions);
  } catch (err) {
    if (err instanceof ArtifactTextContractError) {
      finalViolations = [contractErrorToViolation(err)];
    } else if (err instanceof AuthorFacingIntegrityError) {
      finalViolations = err.violations;
    } else {
      throw err;
    }
  }

  const remainingRequired = finalViolations.filter((v) => !isCandidateTextViolationPath(v.path));
  const remainingCandidate = finalViolations.filter((v) => isCandidateTextViolationPath(v.path));

  telemetry.requiredAttempts = requiredAttempts;
  telemetry.candidateAttempts = candidateAttempts;
  telemetry.regeneratedFields = regeneratedFields;
  telemetry.quarantinedFields = quarantinedFields;
  telemetry.remainingRequired = remainingRequired.length;
  telemetry.remainingCandidate = remainingCandidate.length;

  return {
    ok: finalViolations.length === 0,
    synthesis,
    requiredAttempts,
    candidateAttempts,
    regeneratedFields,
    quarantinedFields,
    remainingViolations: finalViolations,
    telemetry,
  };
}
