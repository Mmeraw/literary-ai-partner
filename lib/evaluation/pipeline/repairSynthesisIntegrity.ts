/**
 * Mistake-proofed author-facing integrity repair for Pass 3 synthesis output.
 *
 * Recovery chain:
 *   1. Build the EvaluationResultV2 projection from canonical synthesis and a
 *      derived-field resolver so every author-facing path has an owner before
 *      any normalization/validation runs.
 *   2. Tier-1 normalization (normalizeArtifact) on the projection.
 *   3. Whole-envelope validation (inspectAuthorFacingIntegrity) on the derived
 *      EvaluationResultV2 projection.
 *   4. Path ownership: every violation is resolved to its canonical writable
 *      source via the derived-field resolver. Derived recommendation paths
 *      (quick_wins / strategic_revisions) map back to
 *      criteria[sourceCriterionIndex].recommendations[sourceRecommendationIndex].sourceField.
 *   5. Targeted required-field regeneration mutates only canonical SynthesisOutput
 *      fields, then the projection is rebuilt from scratch and re-validated.
 *   6. Targeted candidate-field regeneration/quarantine, with fresh validation.
 *   7. Final whole-envelope validation and derived-recommendation parity check
 *      before the caller runs certification.
 *
 * Required and candidate prose keep separate retry counters.
 */

import {
  buildEnrichedActionItems,
  toPublicActionItem,
  type EnrichedActionItem,
} from '@/lib/evaluation/actionItemQualityGate';
import { normalizeArtifact } from '@/lib/evaluation/pipeline/normalizeArtifact';
import {
  buildWritableAuthorFieldResolver,
  assertDerivedRecommendationParity,
  UnownedAuthorFacingFieldError,
} from '@/lib/evaluation/pipeline/derivedFieldResolver';
import { isCandidateTextViolationPath } from '@/lib/evaluation/pipeline/candidateIntegrityRepair';
import {
  assertOnlyRequestedPathsChanged,
  quarantineCandidateFields,
  regenerateCandidateProse,
  regenerateRequiredProse,
} from '@/lib/evaluation/pipeline/requiredProseRegeneration';
import type { Pass3PreflightDraft, SinglePassOutput, SynthesisOutput } from '@/lib/evaluation/pipeline/types';
import {
  AuthorFacingIntegrityError,
  type AuthorFacingIntegrityViolation,
} from '@/lib/text/authorFacingIntegrity';
import { inspectRegisteredAuthorFacingArtifact } from '@/lib/text/authorFacingProseAuthority';
import { ArtifactTextContractError } from '@/lib/evaluation/pipeline/normalizeArtifact';

export interface RepairSynthesisIntegrityOptions {
  openaiApiKey?: string;
  title?: string;
  manuscriptText?: string;
  /** Pass 3A preflight draft carrying synthesized strength/weakness context. */
  pass3PreflightDraft?: Pass3PreflightDraft | null;
  /** Authoritative Pass 1 craft output for provenanced regeneration context. */
  pass1Output?: SinglePassOutput | null;
  /** Authoritative Pass 2 editorial output for provenanced regeneration context. */
  pass2Output?: SinglePassOutput | null;
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
  mutationBoundaryViolations: string[];
  remainingViolations: AuthorFacingIntegrityViolation[];
  telemetry: Record<string, unknown>;
}

function buildAuthorEnvelope(
  synthesis: SynthesisOutput,
  quickWins: EnrichedActionItem[],
  strategicRevisions: EnrichedActionItem[],
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

function buildProjection(synthesis: SynthesisOutput) {
  const quickWins = buildEnrichedActionItems(
    synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
    'high',
    5,
  );
  const strategicRevisions = buildEnrichedActionItems(
    synthesis.criteria.map((c) => ({ key: c.key, recommendations: c.recommendations })),
    'medium',
    5,
  );
  const resolver = buildWritableAuthorFieldResolver(quickWins, strategicRevisions);
  return { quickWins, strategicRevisions, resolver };
}

function collectViolations(
  synthesis: SynthesisOutput,
  quickWins: EnrichedActionItem[],
  strategicRevisions: EnrichedActionItem[],
  rootPath = 'evaluation_result_v2',
): { violations: AuthorFacingIntegrityViolation[]; unregisteredPaths: string[] } {
  const { violations, unregisteredPaths } = inspectRegisteredAuthorFacingArtifact(
    buildAuthorEnvelope(
      synthesis,
      quickWins.map(toPublicActionItem),
      strategicRevisions.map(toPublicActionItem),
    ),
    rootPath,
  );
  return { violations, unregisteredPaths };
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

function resolveRequiredCanonicalPaths(
  violations: AuthorFacingIntegrityViolation[],
  resolver: ReturnType<typeof buildWritableAuthorFieldResolver>,
): { resolved: AuthorFacingIntegrityViolation[]; unowned: string[] } {
  const resolved: AuthorFacingIntegrityViolation[] = [];
  const unowned: string[] = [];
  for (const v of violations) {
    const field = resolver(v.path);
    if (!field) {
      unowned.push(v.path);
      continue;
    }
    resolved.push({
      ...v,
      path: field.canonicalPath,
    });
  }
  return { resolved, unowned };
}

function normalizeAndInspectProjection(
  synthesis: SynthesisOutput,
  quickWins: EnrichedActionItem[],
  strategicRevisions: EnrichedActionItem[],
  enforceParity: boolean,
): AuthorFacingIntegrityViolation[] {
  const preViolations: AuthorFacingIntegrityViolation[] = [];
  try {
    normalizeArtifact(synthesis, quickWins, strategicRevisions);
  } catch (err) {
    if (err instanceof ArtifactTextContractError) {
      preViolations.push(contractErrorToViolation(err));
    } else if (err instanceof AuthorFacingIntegrityError) {
      preViolations.push(...err.violations);
    } else {
      throw err;
    }
  }

  if (enforceParity && preViolations.length === 0) {
    assertDerivedRecommendationParity(synthesis, quickWins, strategicRevisions);
  }

  const { violations: collected, unregisteredPaths } = collectViolations(synthesis, quickWins, strategicRevisions);
  if (unregisteredPaths.length > 0) {
    throw new UnownedAuthorFacingFieldError(unregisteredPaths);
  }

  const seen = new Set<string>();
  const out: AuthorFacingIntegrityViolation[] = [];
  for (const v of [...preViolations, ...collected]) {
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
  let mutationBoundaryViolations: string[] = [];

  // Required-prose repair loop.
  for (let i = 0; i < maxRequiredAttempts; i++) {
    const { quickWins, strategicRevisions, resolver } = buildProjection(synthesis);
    const violations = normalizeAndInspectProjection(synthesis, quickWins, strategicRevisions, false);

    const requiredViolations = normalizeViolations(
      violations.filter((v) => !isCandidateTextViolationPath(v.path)),
    );

    const { resolved, unowned } = resolveRequiredCanonicalPaths(requiredViolations, resolver);
    if (unowned.length > 0) {
      throw new UnownedAuthorFacingFieldError(unowned);
    }
    if (resolved.length === 0) break;

    requiredAttempts++;
    const beforeSnapshot: SynthesisOutput = JSON.parse(JSON.stringify(synthesis));
    const result = await regenerateRequiredProse(synthesis, resolved, {
      openaiApiKey: options.openaiApiKey,
      title: options.title,
      manuscriptText: options.manuscriptText,
      pass3PreflightDraft: options.pass3PreflightDraft,
      pass1Output: options.pass1Output,
      pass2Output: options.pass2Output,
    });
    telemetry.requiredAttemptsTelemetry = [
      ...(telemetry.requiredAttemptsTelemetry as Record<string, unknown>[]),
      result.telemetry,
    ];
    regeneratedFields = [...new Set([...regeneratedFields, ...result.regeneratedFields])];

    const illegalMutations = assertOnlyRequestedPathsChanged(
      beforeSnapshot,
      synthesis,
      resolved.map((v) => v.path),
    );
    if (illegalMutations.length > 0) {
      Object.assign(synthesis, beforeSnapshot);
      mutationBoundaryViolations = illegalMutations;
      return {
        ok: false,
        synthesis,
        requiredAttempts,
        candidateAttempts,
        regeneratedFields,
        quarantinedFields,
        mutationBoundaryViolations,
        remainingViolations: resolved,
        telemetry: {
          ...telemetry,
          mutationBoundaryViolations: illegalMutations,
        },
      };
    }
  }

  // Candidate-prose repair: resolve canonical source paths, attempt bounded
  // targeted LLM regeneration, then quarantine only the unresolved candidates.
  const candidateProjection = buildProjection(synthesis);
  const candidateViolations = normalizeViolations(
    normalizeAndInspectProjection(
      synthesis,
      candidateProjection.quickWins,
      candidateProjection.strategicRevisions,
      false,
    ).filter((v) => isCandidateTextViolationPath(v.path)),
  );
  if (candidateViolations.length > 0) {
    const { resolved: resolvedCandidates, unowned: unownedCandidates } =
      resolveRequiredCanonicalPaths(candidateViolations, candidateProjection.resolver);
    if (unownedCandidates.length > 0) {
      throw new UnownedAuthorFacingFieldError(unownedCandidates);
    }

    const candidateResult = await regenerateCandidateProse(synthesis, resolvedCandidates, {
      openaiApiKey: options.openaiApiKey,
      title: options.title,
      manuscriptText: options.manuscriptText,
      pass3PreflightDraft: options.pass3PreflightDraft,
      pass1Output: options.pass1Output,
      pass2Output: options.pass2Output,
      maxAttempts: maxCandidateAttempts,
    });
    telemetry.candidateAttemptsTelemetry = [candidateResult.telemetry];
    candidateAttempts = (candidateResult.telemetry.attempts as number) ?? 0;
    regeneratedFields = [...new Set([...regeneratedFields, ...candidateResult.regeneratedFields])];

    if (candidateResult.mutationBoundaryViolations.length > 0) {
      // A boundary breach is a regeneration failure, not evidence that the
      // candidate is unrepairable. Fail closed without quarantine.
      mutationBoundaryViolations = candidateResult.mutationBoundaryViolations;
      return {
        ok: false,
        synthesis,
        requiredAttempts,
        candidateAttempts,
        regeneratedFields,
        quarantinedFields,
        mutationBoundaryViolations,
        remainingViolations: resolvedCandidates,
        telemetry: {
          ...telemetry,
          mutationBoundaryViolations: candidateResult.mutationBoundaryViolations,
        },
      };
    }

    if (candidateResult.failedFields.length > 0) {
      const quarantined = quarantineCandidateFields(synthesis, candidateResult.failedFields);
      quarantinedFields = [...new Set([...quarantinedFields, ...quarantined])];
    }
  }

  // Final validation: derive + inspect + parity check.
  let finalViolations: AuthorFacingIntegrityViolation[] = [];
  const { quickWins, strategicRevisions, resolver } = buildProjection(synthesis);
  try {
    finalViolations = normalizeAndInspectProjection(synthesis, quickWins, strategicRevisions, true);
  } catch (err) {
    if (err instanceof ArtifactTextContractError) {
      finalViolations = [contractErrorToViolation(err)];
    } else if (err instanceof AuthorFacingIntegrityError) {
      finalViolations = err.violations;
    } else {
      throw err;
    }
  }

  // Ensure every remaining violation is owned, even if it appears only at the final stage.
  const { unowned } = resolveRequiredCanonicalPaths(finalViolations, resolver);
  if (unowned.length > 0) {
    throw new UnownedAuthorFacingFieldError(unowned);
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
    mutationBoundaryViolations,
    remainingViolations: finalViolations,
    telemetry,
  };
}
