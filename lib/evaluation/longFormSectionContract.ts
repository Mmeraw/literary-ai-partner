/**
 * Machine-checkable Long-Form Evaluation Section Contract.
 *
 * Authority: docs/templates/evaluation/long-form-evaluation-template.md (Revision Surface Ownership Contract section)
 *
 * This module defines long-form section definitions, revision surface ownership
 * rules, and forbidden sections. All renderers (web, PDF, DOCX, TXT) must import
 * from here for long-form mode validation.
 */

// ────────────────────────────────────────────────────────────────────────────
// Forbidden Sections for Long-Form Evaluation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sections that must NEVER appear as separate top-level author-facing sections
 * in long-form evaluation reports.
 *
 * Note: Long-form allows Revision Priority Plan, Manuscript-Scale Continuity Findings,
 * etc. — but forbids standalone Action Items, Strategic Revisions, and others.
 */
const FORBIDDEN_LONG_FORM_SECTIONS: string[] = [
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
 * in a long-form report. These are narrower than short-form because long-form
 * explicitly allows Revision Priority Plan and Manuscript-Scale Continuity Findings.
 */
const FORBIDDEN_LONG_FORM_INVENTORY_PATTERNS: RegExp[] = [
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
// Required Section Headings for Long-Form
// ────────────────────────────────────────────────────────────────────────────

const REQUIRED_LONG_FORM_HEADING_SEQUENCE: string[] = [
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
  'Manuscript-Scale Continuity Findings',
  'Revision Priority Plan',
  'Confidence Explanation',
];

// ────────────────────────────────────────────────────────────────────────────
// Accessors
// ────────────────────────────────────────────────────────────────────────────

export function getForbiddenLongFormSections(): readonly string[] {
  return FORBIDDEN_LONG_FORM_SECTIONS;
}

export function getForbiddenLongFormInventoryPatterns(): readonly RegExp[] {
  return FORBIDDEN_LONG_FORM_INVENTORY_PATTERNS;
}

export function getRequiredLongFormHeadingSequence(): readonly string[] {
  return REQUIRED_LONG_FORM_HEADING_SEQUENCE;
}

/**
 * Validate that no forbidden long-form headings appear in extracted headings.
 */
export function validateNoForbiddenLongFormHeadings(
  headings: string[],
  surface: string,
): { failure_code: string; renderer: string; section: string; expected_behavior: string; actual_behavior: string; remediation_hint: string }[] {
  const failures: { failure_code: string; renderer: string; section: string; expected_behavior: string; actual_behavior: string; remediation_hint: string }[] = [];
  const forbiddenSet = new Set(FORBIDDEN_LONG_FORM_SECTIONS.map(s => s.toUpperCase()));

  for (const heading of headings) {
    if (forbiddenSet.has(heading.toUpperCase())) {
      failures.push({
        failure_code: 'FORBIDDEN_LONG_FORM_SECTION',
        renderer: surface,
        section: heading,
        expected_behavior: `"${heading}" must not appear as a top-level section in long-form reports`,
        actual_behavior: `"${heading}" found as heading`,
        remediation_hint: `Remove "${heading}" section. Its content belongs in Criterion Rationales, Revision Priority Plan, or Revise Queue.`,
      });
    }

    // Also check inventory patterns
    for (const pattern of FORBIDDEN_LONG_FORM_INVENTORY_PATTERNS) {
      if (pattern.test(heading)) {
        // Avoid double-reporting if already caught by exact match
        if (!forbiddenSet.has(heading.toUpperCase())) {
          failures.push({
            failure_code: 'UNAUTHORIZED_LONG_FORM_REVISION_INVENTORY',
            renderer: surface,
            section: heading,
            expected_behavior: `"${heading}" must not appear as a revision inventory section in long-form reports`,
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
