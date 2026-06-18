/**
 * REVISION_SURFACE_OWNERSHIP_GATE
 *
 * Authority:
 *   - docs/templates/evaluation/short-form-evaluation-template.md
 *   - docs/templates/evaluation/long-form-evaluation-template.md
 *   - docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
 *
 * Runs before Phase 5 Author Exposure. Validates that the rendered report
 * conforms to revision surface ownership rules for the active template mode:
 *
 * 1. No forbidden top-level sections appear.
 * 2. No duplicate recommendations across sections.
 * 3. No unauthorized revision inventories.
 * 4. Opportunity counts match canonical ledger.
 * 5. Severity tiers are not renamed.
 * 6. Rendered heading sequence matches template contract.
 * 7. Cross-surface parity holds.
 *
 * If validation fails, the report MUST NOT be exposed to the author.
 * This is a release-blocking defect.
 */

import {
  type RevisionSurfaceFailure,
  type RevisionSurfaceOwnershipResult,
  type OpportunityCountSummary,
  getForbiddenShortFormSections,
  getForbiddenRevisionInventoryLabels,
  extractHtmlH2Headings,
  extractTxtHeadings,
  extractDocxXmlHeadings,
  validateNoForbiddenHeadings,
  validateShortFormHeadingSequence,
  validateOpportunityCountParity,
} from '@/lib/evaluation/shortFormSectionContract';
import { validateNoForbiddenLongFormHeadings } from '@/lib/evaluation/longFormSectionContract';
import { validateNoForbiddenMultiLayerHeadings } from '@/lib/evaluation/longFormMultiLayerSectionContract';

export type RenderedSurfaceInput = {
  surface: 'html' | 'txt' | 'docx';
  content: string;
  /** For DOCX: the extracted word/document.xml content */
  documentXml?: string;
};

export type RevisionSurfaceGateInput = {
  templateMode: string;
  surfaces: RenderedSurfaceInput[];
  ledgerCounts?: OpportunityCountSummary;
  renderedCounts?: Record<string, OpportunityCountSummary>;
};

/**
 * Run the REVISION_SURFACE_OWNERSHIP_GATE for all template modes.
 *
 * Returns a structured result with pass/fail and detailed failure diagnostics.
 * The gate applies mode-specific rules:
 *  - short_form_evaluation: strict forbidden sections, no revision inventories allowed
 *  - long_form_evaluation: allows Revision Priority Plan, Manuscript-Scale Continuity but forbids Action Items etc.
 *  - long_form_multi_layer_evaluation: allows Layer-Aware Sequencing, Cross-Layer Synthesis, etc.
 */
export function runRevisionSurfaceOwnershipGate(
  input: RevisionSurfaceGateInput,
): RevisionSurfaceOwnershipResult {
  const mode = input.templateMode;

  // Gate applies to all known evaluation modes
  if (
    mode !== 'short_form_evaluation' &&
    mode !== 'long_form_evaluation' &&
    mode !== 'long_form_multi_layer_evaluation'
  ) {
    return { passed: true, failures: [] };
  }

  const failures: RevisionSurfaceFailure[] = [];

  // ── 1. Extract headings from each surface ─────────────────────────
  const surfaceHeadings: { surface: string; headings: string[] }[] = [];

  for (const s of input.surfaces) {
    let headings: string[];
    switch (s.surface) {
      case 'html':
        headings = extractHtmlH2Headings(s.content);
        break;
      case 'txt':
        headings = extractTxtHeadings(s.content);
        break;
      case 'docx':
        headings = s.documentXml
          ? extractDocxXmlHeadings(s.documentXml)
          : [];
        break;
      default:
        headings = [];
    }
    surfaceHeadings.push({ surface: s.surface, headings });
  }

  // ── 2. Validate no forbidden top-level sections (mode-specific) ───
  for (const { surface, headings } of surfaceHeadings) {
    if (mode === 'short_form_evaluation') {
      failures.push(...validateNoForbiddenHeadings(headings, surface));
    } else if (mode === 'long_form_evaluation') {
      failures.push(...validateNoForbiddenLongFormHeadings(headings, surface));
    } else if (mode === 'long_form_multi_layer_evaluation') {
      failures.push(...validateNoForbiddenMultiLayerHeadings(headings, surface));
    }
  }

  // ── 3. Validate heading sequence (short-form only; long-form is more flexible)
  if (mode === 'short_form_evaluation') {
    for (const { surface, headings } of surfaceHeadings) {
      failures.push(...validateShortFormHeadingSequence(headings, surface));
    }
  }

  // ── 4. Check for unauthorized revision inventory labels in headings
  if (mode === 'short_form_evaluation') {
    const forbiddenLabels = new Set(getForbiddenRevisionInventoryLabels());
    for (const { surface, headings } of surfaceHeadings) {
      for (const heading of headings) {
        if (forbiddenLabels.has(heading)) {
          failures.push({
            failure_code: 'UNAUTHORIZED_REVISION_INVENTORY',
            renderer: surface,
            section: heading,
            expected_behavior: `"${heading}" must not appear as a section label in short-form reports`,
            actual_behavior: `"${heading}" found as heading`,
            remediation_hint: `Remove "${heading}" section. Its content belongs in Criterion Rationales or Revise Queue.`,
          });
        }
      }
    }
  }

  // ── 5. Validate opportunity count parity (all modes) ──────────────
  if (input.ledgerCounts && input.renderedCounts) {
    for (const [surface, rendered] of Object.entries(input.renderedCounts)) {
      failures.push(
        ...validateOpportunityCountParity(rendered, input.ledgerCounts, surface),
      );
    }
  }

  // ── 6. Cross-surface parity (all modes) ───────────────────────────
  if (surfaceHeadings.length > 1) {
    const forbiddenSet = new Set(
      mode === 'short_form_evaluation'
        ? getForbiddenShortFormSections()
        : [],
    );
    const reference = surfaceHeadings[0];
    for (let i = 1; i < surfaceHeadings.length; i++) {
      const compare = surfaceHeadings[i];
      const refSet = new Set(reference.headings.filter(h => !forbiddenSet.has(h)));
      const cmpSet = new Set(compare.headings.filter(h => !forbiddenSet.has(h)));

      for (const heading of refSet) {
        if (!cmpSet.has(heading)) {
          failures.push({
            failure_code: 'SURFACE_PARITY_FAILURE',
            renderer: compare.surface,
            section: heading,
            expected_behavior: `"${heading}" present on ${reference.surface} should also appear on ${compare.surface}`,
            actual_behavior: `"${heading}" missing from ${compare.surface}`,
            remediation_hint: 'Ensure all surfaces render the same authorized sections.',
          });
        }
      }
    }
  }

  // ── 7. Multiple revision inventory detection (mode-specific) ──────
  if (mode === 'short_form_evaluation') {
    // Short-form: no revision inventory sections allowed at all
    const revisionInventoryPatterns = [
      /\baction\s+items?\b/i,
      /\bstrategic\s+revision/i,
      /\brevision\s+(queue|plan|priority)/i,
      /\brepair\s+plan\b/i,
      /\beditorial\s+action/i,
      /\bdeep\s+criterion\s+analysis\b/i,
      /\bexpanded\s+criterion\s+analysis\b/i,
      /\breleasability\s+assessment\b/i,
      /\breview\s+gate\b/i,
      /\badditional\s+recommend/i,
      /\bsuggested\s+revision/i,
    ];

    for (const { surface, headings } of surfaceHeadings) {
      const inventoryHeadings = headings.filter(h =>
        revisionInventoryPatterns.some(p => p.test(h)),
      );
      for (const h of inventoryHeadings) {
        failures.push({
          failure_code: 'MULTIPLE_REVISION_INVENTORIES',
          renderer: surface,
          section: h,
          expected_behavior: 'Short-form reports must have zero additional revision inventory sections beyond Criterion Rationales & Top Recommendations',
          actual_behavior: `"${h}" appears as a revision inventory heading`,
          remediation_hint: `Remove "${h}" as a top-level section. Fold its content into Criterion Rationales or Revise Queue.`,
        });
      }
    }
  } else {
    // Long-form / multi-layer: narrower patterns (allow Revision Priority Plan, Layer-Aware Sequencing, etc.)
    const longFormForbiddenPatterns = [
      /\baction\s+items?\b/i,
      /\bstrategic\s+revision/i,
      /\brevision\s+queue\b/i,
      /\bdeep\s+criterion\s+analysis\b/i,
      /\bexpanded\s+criterion\s+analysis\b/i,
      /\badditional\s+recommend/i,
      /\bsuggested\s+revision/i,
      /\beditorial\s+action/i,
    ];

    for (const { surface, headings } of surfaceHeadings) {
      const inventoryHeadings = headings.filter(h =>
        longFormForbiddenPatterns.some(p => p.test(h)),
      );
      for (const h of inventoryHeadings) {
        failures.push({
          failure_code: 'MULTIPLE_REVISION_INVENTORIES',
          renderer: surface,
          section: h,
          expected_behavior: `${mode} reports must not contain unauthorized revision inventory sections`,
          actual_behavior: `"${h}" appears as a revision inventory heading`,
          remediation_hint: `Remove "${h}" as a top-level section. Fold its content into authorized revision surfaces.`,
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Build a failure_diagnosis_v1 payload from gate failures.
 * Persisted to evaluation_artifacts when the gate fails.
 */
export function buildRevisionSurfaceFailureDiagnosis(
  jobId: string,
  failures: RevisionSurfaceFailure[],
): Record<string, unknown> {
  return {
    artifact_type: 'failure_diagnosis_v1',
    job_id: jobId,
    gate: 'REVISION_SURFACE_OWNERSHIP_GATE',
    generated_at: new Date().toISOString(),
    failure_count: failures.length,
    failures: failures.map(f => ({
      failure_code: f.failure_code,
      renderer: f.renderer ?? null,
      section: f.section ?? null,
      field: f.field ?? null,
      expected_behavior: f.expected_behavior,
      actual_behavior: f.actual_behavior,
      canonical_opportunity_id: f.canonical_opportunity_id ?? null,
      remediation_hint: f.remediation_hint,
    })),
  };
}
