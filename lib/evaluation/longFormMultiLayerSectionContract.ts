/**
 * Machine-checkable Long-Form Multi-Layer Evaluation Section Contract.
 *
 * Authority: docs/templates/evaluation/long-form-multi-layer-evaluation-template.md (Revision Surface Ownership Contract section)
 *
 * This module defines long-form multi-layer section definitions, revision surface
 * ownership rules, and forbidden sections. All renderers (web, PDF, DOCX, TXT) must
 * import from here for long-form multi-layer mode validation.
 */

// ────────────────────────────────────────────────────────────────────────────
// Forbidden Sections for Long-Form Multi-Layer Evaluation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sections that must NEVER appear as separate top-level author-facing sections
 * in long-form multi-layer evaluation reports.
 *
 * Note: Multi-layer allows Layer-Aware Revision Sequencing, Cross-Layer Synthesis,
 * Long-Form Continuity, Readiness/Releasability Posture, Review Gate Readiness Surface —
 * but forbids standalone Action Items, Strategic Revisions, and others.
 */
const FORBIDDEN_LONG_FORM_MULTI_LAYER_SECTIONS: string[] = [
  'Action Items',
  'Strategic Revisions',
  'Revision Queue',
  'Deep Criterion Analysis',
  'Expanded Criterion Analysis',
  'Additional Recommendations',
  'Suggested Revisions',
  'Strategic Revision Plan',
  'Editorial Action Plan',
];

/**
 * Patterns that indicate a heading is acting as a competing revision inventory
 * in a long-form multi-layer report.
 */
const FORBIDDEN_MULTI_LAYER_INVENTORY_PATTERNS: RegExp[] = [
  /\baction\s+items?\b/i,
  /\bstrategic\s+revision/i,
  /\brevision\s+queue\b/i,
  /\bdeep\s+criterion\s+analysis\b/i,
  /\bexpanded\s+criterion\s+analysis\b/i,
  /\badditional\s+recommend/i,
  /\bsuggested\s+revision/i,
  /\beditorial\s+action/i,
];

// ────────────────────────────────────────────────────────────────────────────
// Required Section Headings for Long-Form Multi-Layer
// ────────────────────────────────────────────────────────────────────────────

const REQUIRED_MULTI_LAYER_HEADING_SEQUENCE: string[] = [
  'Title Block',
  'One-Paragraph Pitch',
  'One-Sentence Pitch',
  'Content Warnings',
  'Revision Opportunity Summary',
  'Executive Summary',
  'Top Strengths',
  'Top Risks',
  'Top Recommendations',
  '13 Criteria Score Grid',
  'Criterion Rationales & Surfaced Opportunities',
  'Cross-Layer Synthesis',
  'Layer-Aware Revision Sequencing',
  'Long-Form Continuity and Coverage Proof',
  'Readiness / Releasability Posture',
  'Confidence Explanation',
];

// ────────────────────────────────────────────────────────────────────────────
// Accessors
// ────────────────────────────────────────────────────────────────────────────

export function getForbiddenLongFormMultiLayerSections(): readonly string[] {
  return FORBIDDEN_LONG_FORM_MULTI_LAYER_SECTIONS;
}

export function getForbiddenMultiLayerInventoryPatterns(): readonly RegExp[] {
  return FORBIDDEN_MULTI_LAYER_INVENTORY_PATTERNS;
}

export function getRequiredMultiLayerHeadingSequence(): readonly string[] {
  return REQUIRED_MULTI_LAYER_HEADING_SEQUENCE;
}

/**
 * Validate that no forbidden multi-layer headings appear in extracted headings.
 */
export function validateNoForbiddenMultiLayerHeadings(
  headings: string[],
  surface: string,
): { failure_code: string; renderer: string; section: string; expected_behavior: string; actual_behavior: string; remediation_hint: string }[] {
  const failures: { failure_code: string; renderer: string; section: string; expected_behavior: string; actual_behavior: string; remediation_hint: string }[] = [];
  const forbiddenSet = new Set(FORBIDDEN_LONG_FORM_MULTI_LAYER_SECTIONS.map(s => s.toUpperCase()));

  for (const heading of headings) {
    if (forbiddenSet.has(heading.toUpperCase())) {
      failures.push({
        failure_code: 'FORBIDDEN_MULTI_LAYER_SECTION',
        renderer: surface,
        section: heading,
        expected_behavior: `"${heading}" must not appear as a top-level section in long-form multi-layer reports`,
        actual_behavior: `"${heading}" found as heading`,
        remediation_hint: `Remove "${heading}" section. Its content belongs in Criterion Rationales, Layer-Aware Revision Sequencing, or Revise Queue.`,
      });
    }

    // Also check inventory patterns
    for (const pattern of FORBIDDEN_MULTI_LAYER_INVENTORY_PATTERNS) {
      if (pattern.test(heading)) {
        if (!forbiddenSet.has(heading.toUpperCase())) {
          failures.push({
            failure_code: 'UNAUTHORIZED_MULTI_LAYER_REVISION_INVENTORY',
            renderer: surface,
            section: heading,
            expected_behavior: `"${heading}" must not appear as a revision inventory section in long-form multi-layer reports`,
            actual_behavior: `"${heading}" matches forbidden inventory pattern`,
            remediation_hint: `Remove "${heading}" section. Fold its content into authorized revision surfaces.`,
          });
        }
        break;
      }
    }
  }

  return failures;
}
