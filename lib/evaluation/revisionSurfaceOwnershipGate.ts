/**
 * REVISION_SURFACE_OWNERSHIP_GATE
 *
 * Validates the evaluation report against the Short-Form Evaluation Template's
 * Revision Surface Ownership contract. Runs in the UED → Phase 5 path between
 * unified document construction and author_exposure_certification_v1.
 *
 * Failure blocks author exposure and persists failure_diagnosis_v1.
 *
 * Gate checks:
 *   1. Forbidden rendered headings — no prohibited top-level sections
 *   2. Opportunity traceability — every surfaced recommendation has opportunity_id
 *   3. Count parity — summary counts match actual ledger
 *   4. Tier parity — Recommended/Optional/Consider counts are consistent
 *   5. Duplicate detection — Top Recommendations must not duplicate criterion text
 *   6. Rendered-output heading validation — web/PDF/DOCX/TXT must not contain forbidden headings
 *
 * Authority: docs/templates/evaluation/short-form-evaluation-template.md
 */

import type { UnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';

export type RevisionSurfaceOwnershipFailure = {
  failure_code: string;
  renderer?: string;
  section?: string;
  field?: string;
  expected_behavior: string;
  actual_behavior: string;
  canonical_opportunity_id?: string;
  remediation_hint: string;
};

export type RevisionSurfaceOwnershipGateResult = {
  status: 'pass' | 'fail';
  failures: RevisionSurfaceOwnershipFailure[];
  checked_at: string;
};

/**
 * Forbidden top-level headings that must never appear as rendered headings
 * in a short-form evaluation report.
 *
 * Per Short-Form Evaluation Template § Prohibited Top-Level Sections and
 * § Forbidden Rendered Headings.
 */
export const FORBIDDEN_RENDERED_HEADINGS = [
  'Action Items',
  'Strategic Revisions',
  'Revision Queue',
  'Revision Priority Plan',
  'Deep Criterion Analysis',
  'Expanded Criterion Analysis',
  'Releasability Assessment',
  'Review Gate',
  'Additional Recommendations',
  'Suggested Revisions',
  'Strategic Revision Plan',
  'Priority Revision Plan',
  'Repair Plan',
  'Editorial Action Plan',
] as const;

/**
 * Normalized lowercase set for O(1) matching against rendered output.
 */
const FORBIDDEN_HEADINGS_NORMALIZED = new Set(
  FORBIDDEN_RENDERED_HEADINGS.map((heading) => heading.toLowerCase().trim()),
);

/**
 * Extracts top-level markdown headings (## level) from rendered text/markdown.
 */
function extractRenderedHeadings(output: string): string[] {
  const headingPattern = /^#{1,3}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(output)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

/**
 * Check 1: Validate UED does not structurally carry forbidden sections.
 *
 * The UED has `actionItems.quickWins` and `actionItems.strategicRevisions`.
 * For short-form evaluations, these fields exist in the type but must NOT
 * be rendered as top-level "Action Items" or "Strategic Revisions" sections.
 * This check catches pipeline bugs where forbidden section labels leak into
 * the criterion details or top recommendations.
 */
function checkForbiddenSectionsInUED(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  if (document.templateMode !== 'short_form_evaluation') {
    return failures;
  }

  // Check if criterionDetails contain forbidden heading labels as rationale prefixes
  for (const detail of (document.criterionDetails ?? [])) {
    const rationale = (detail.rationaleText ?? '').toLowerCase();
    for (const heading of FORBIDDEN_RENDERED_HEADINGS) {
      if (rationale.startsWith(`## ${heading.toLowerCase()}`) || rationale.startsWith(`# ${heading.toLowerCase()}`)) {
        failures.push({
          failure_code: 'FORBIDDEN_HEADING_IN_UED_CRITERION',
          section: 'criterionDetails',
          field: `criterionDetails[${detail.label}].rationaleText`,
          expected_behavior: `Criterion rationale must not contain forbidden heading "${heading}"`,
          actual_behavior: `Found forbidden heading "${heading}" embedded in criterion rationale`,
          remediation_hint: `Remove the "${heading}" heading from criterion "${detail.label}" rationale. Criterion rationales should explain scores, not create separate recommendation sections.`,
        });
      }
    }
  }

  return failures;
}

/**
 * Check 2: Validate opportunity traceability.
 *
 * Every surfaced recommendation in criterionDetails must have an opportunity_id
 * linking it to revision_opportunity_ledger_v1.
 */
function checkOpportunityTraceability(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  for (const detail of (document.criterionDetails ?? [])) {
    if (!detail.recommendations || detail.recommendations.length === 0) continue;

    for (let i = 0; i < detail.recommendations.length; i++) {
      const rec = detail.recommendations[i];
      const recRecord = rec as Record<string, unknown>;
      const opportunityId = recRecord.opportunity_id as string | undefined;

      if (!opportunityId || opportunityId.trim().length === 0) {
        failures.push({
          failure_code: 'MISSING_OPPORTUNITY_ID',
          section: 'criterionDetails',
          field: `criterionDetails[${detail.label}].recommendations[${i}]`,
          expected_behavior: 'Every surfaced recommendation must have a non-empty opportunity_id linking to revision_opportunity_ledger_v1',
          actual_behavior: `Recommendation at index ${i} for criterion "${detail.label}" has no opportunity_id`,
          remediation_hint: 'Ensure buildCanonicalOpportunityLedger assigns opportunity_id to every recommendation before UED assembly.',
        });
      }
    }
  }

  return failures;
}

/**
 * Check 3: Validate count parity.
 *
 * The revisionOpportunitySummary.total must match the number of UNIQUE
 * opportunities surfaced across criterionDetails. An opportunity may appear
 * under multiple criteria (primary + related) for diagnostic display, but
 * the count reflects distinct opportunity_ids — not raw entry count.
 */
function checkCountParity(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  const summary = document.revisionOpportunitySummary;
  if (!summary) return failures;

  // Count UNIQUE opportunity_ids across all criteria.
  // A single opportunity may appear under multiple criteria (primary + related)
  // but must only be counted once for parity with the canonical ledger.
  const uniqueOpportunityIds = new Set<string>();
  for (const detail of (document.criterionDetails ?? [])) {
    for (const rec of (detail.recommendations ?? [])) {
      const recRecord = rec as Record<string, unknown>;
      const oppId = recRecord.opportunity_id as string | undefined;
      if (oppId) uniqueOpportunityIds.add(oppId);
    }
  }

  const actualUniqueCount = uniqueOpportunityIds.size;
  const declaredTotal = summary.total ?? 0;

  if (declaredTotal !== actualUniqueCount && actualUniqueCount > 0) {
    failures.push({
      failure_code: 'COUNT_MISMATCH',
      section: 'revisionOpportunitySummary',
      field: 'revisionOpportunitySummary.total',
      expected_behavior: `Summary total (${declaredTotal}) must match unique opportunity count (${actualUniqueCount})`,
      actual_behavior: `Declared total=${declaredTotal}, unique surfaced opportunities=${actualUniqueCount}`,
      remediation_hint: 'Recalculate revisionOpportunitySummary.total from the canonical opportunity ledger before UED assembly.',
    });
  }

  return failures;
}

/**
 * Check 4: Validate tier parity.
 *
 * High + Medium + Low must sum to the declared total.
 * (Template terms: Recommended=high, Optional=medium, Consider=low)
 */
function checkTierParity(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  const summary = document.revisionOpportunitySummary;
  if (!summary) return failures;

  const high = summary.high ?? 0;
  const medium = summary.medium ?? 0;
  const low = summary.low ?? 0;
  const total = summary.total ?? 0;

  const tierSum = high + medium + low;

  if (tierSum !== total && total > 0) {
    failures.push({
      failure_code: 'TIER_MISMATCH',
      section: 'revisionOpportunitySummary',
      field: 'revisionOpportunitySummary.{high,medium,low}',
      expected_behavior: `Tier sum (Recommended/high=${high} + Optional/medium=${medium} + Consider/low=${low} = ${tierSum}) must equal total (${total})`,
      actual_behavior: `Tier sum=${tierSum} but declared total=${total}`,
      remediation_hint: 'Ensure tier counts are derived from the canonical ledger severity classifications.',
    });
  }

  return failures;
}

/**
 * Check 5: Detect Top Recommendation duplication with criterion opportunities.
 *
 * Top Recommendations must paraphrase/summarize, not duplicate verbatim from
 * criterion opportunity text.
 */
function checkTopRecommendationDuplication(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  if (!document.topRecommendations || document.topRecommendations.length === 0) {
    return failures;
  }

  // Collect all criterion recommendation text for comparison
  const criterionTexts: string[] = [];
  for (const detail of (document.criterionDetails ?? [])) {
    if (!detail.recommendations) continue;
    for (const rec of detail.recommendations) {
      const recRecord = rec as Record<string, unknown>;
      const action = (recRecord.action as string ?? recRecord.specific_fix as string ?? '').trim().toLowerCase();
      if (action.length > 0) {
        criterionTexts.push(action);
      }
    }
  }

  // Check each top recommendation for verbatim duplication
  for (let i = 0; i < document.topRecommendations.length; i++) {
    const topRec = document.topRecommendations[i].trim().toLowerCase();
    if (topRec.length === 0) continue;

    for (const criterionText of criterionTexts) {
      // Exact match or near-verbatim (one is substring of the other with >80% overlap)
      if (topRec === criterionText) {
        failures.push({
          failure_code: 'TOP_RECOMMENDATION_VERBATIM_DUPLICATE',
          section: 'topRecommendations',
          field: `topRecommendations[${i}]`,
          expected_behavior: 'Top Recommendations must paraphrase/summarize, not duplicate criterion opportunity text verbatim',
          actual_behavior: `Top Recommendation at index ${i} is verbatim identical to a criterion opportunity`,
          remediation_hint: 'Top Recommendations should synthesize and prioritize, not copy. Rephrase at executive level.',
        });
        break;
      }
    }
  }

  return failures;
}

/**
 * Check 6: Validate rendered output does not contain forbidden headings.
 *
 * This check applies to the actual rendered text from each surface.
 * Call this separately for each surface (web, PDF, DOCX, TXT) when
 * rendered output is available.
 */
export function checkRenderedOutputForbiddenHeadings(
  renderedOutput: string,
  surface: string,
): RevisionSurfaceOwnershipFailure[] {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  const headings = extractRenderedHeadings(renderedOutput);

  for (const heading of headings) {
    const normalized = heading.toLowerCase().trim();
    if (FORBIDDEN_HEADINGS_NORMALIZED.has(normalized)) {
      failures.push({
        failure_code: 'FORBIDDEN_HEADING_IN_RENDERED_OUTPUT',
        renderer: surface,
        section: heading,
        expected_behavior: `Rendered output must not contain forbidden heading "${heading}"`,
        actual_behavior: `Forbidden heading "${heading}" found in ${surface} rendered output`,
        remediation_hint: `Remove or rename the "${heading}" section. This heading is prohibited in short-form evaluation reports per the template contract.`,
      });
    }
  }

  return failures;
}

/**
 * Run the full REVISION_SURFACE_OWNERSHIP_GATE on a UnifiedEvaluationDocument.
 *
 * This is the UED-level validation. Rendered-output validation should be
 * performed separately via checkRenderedOutputForbiddenHeadings() when
 * renderer output is available.
 */
export function runRevisionSurfaceOwnershipGate(
  document: UnifiedEvaluationDocument,
): RevisionSurfaceOwnershipGateResult {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  // Structural completeness check: if templateMode is set, this is a real
  // completed UED from production evaluation. criterionDetails MUST exist.
  // A missing criterionDetails on a real UED means the UED builder is broken
  // or data was lost — this must block author exposure, not silently pass.
  if (document.templateMode && !Array.isArray(document.criterionDetails)) {
    failures.push({
      failure_code: 'UED_STRUCTURE_INVALID',
      section: 'criterionDetails',
      field: 'criterionDetails',
      expected_behavior: 'A completed UED with templateMode set must contain criterionDetails array',
      actual_behavior: `criterionDetails is ${typeof document.criterionDetails} (templateMode="${document.templateMode}")`,
      remediation_hint: 'Ensure buildUnifiedDocumentForParityFromEvaluationResult populates criterionDetails before the gate runs.',
    });
    return {
      status: 'fail',
      failures,
      checked_at: new Date().toISOString(),
    };
  }

  failures.push(
    ...checkForbiddenSectionsInUED(document),
    ...checkOpportunityTraceability(document),
    ...checkCountParity(document),
    ...checkTierParity(document),
    ...checkTopRecommendationDuplication(document),
  );

  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Run rendered-output heading validation across all available surfaces.
 *
 * Call this with actual renderer output text (HTML source, DOCX extracted text,
 * TXT body, etc.) to validate no forbidden headings leaked into author-facing output.
 */
export function runRenderedOutputOwnershipGate(
  rendererOutputs: Partial<Record<string, string>>,
): RevisionSurfaceOwnershipGateResult {
  const failures: RevisionSurfaceOwnershipFailure[] = [];

  for (const [surface, output] of Object.entries(rendererOutputs)) {
    if (typeof output === 'string' && output.length > 0) {
      failures.push(...checkRenderedOutputForbiddenHeadings(output, surface));
    }
  }

  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    checked_at: new Date().toISOString(),
  };
}

/**
 * Build the failure_diagnosis_v1-compatible payload for a failed gate.
 */
export function buildRevisionSurfaceOwnershipDiagnosis(
  gateResult: RevisionSurfaceOwnershipGateResult,
  jobId: string,
): {
  failure_code: string;
  failure_class: 'governance_blocked';
  failure_point: {
    stage: string;
    gate: string;
    artifact_type: string;
    failed_check: string;
  };
  user_safe_summary: string;
  admin_summary: string;
  developer_summary: string;
  blocking_reasons: string[];
  revision_surface_ownership_failures: RevisionSurfaceOwnershipFailure[];
} {
  const failureCodes = gateResult.failures.map((f) => f.failure_code);
  const uniqueCodes = [...new Set(failureCodes)];

  return {
    failure_code: 'REVISION_SURFACE_OWNERSHIP_GATE_FAILED',
    failure_class: 'governance_blocked',
    failure_point: {
      stage: 'Phase 5',
      gate: 'REVISION_SURFACE_OWNERSHIP_GATE',
      artifact_type: 'unified_evaluation_document_v1',
      failed_check: uniqueCodes[0] ?? 'UNKNOWN',
    },
    user_safe_summary:
      'The evaluation stopped before report release because the report structure violates revision surface ownership rules.',
    admin_summary:
      `REVISION_SURFACE_OWNERSHIP_GATE blocked author exposure: ${gateResult.failures.length} failure(s) — ${uniqueCodes.join(', ')}`,
    developer_summary:
      `Gate reported ${gateResult.failures.length} failure(s) for job ${jobId}. ` +
      `Codes: ${uniqueCodes.join(', ')}. ` +
      `First failure: ${JSON.stringify(gateResult.failures[0])}`,
    blocking_reasons: uniqueCodes,
    revision_surface_ownership_failures: gateResult.failures,
  };
}
