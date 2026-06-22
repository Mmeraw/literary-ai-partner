/**
 * Machine-checkable Short-Form Evaluation Section Contract.
 *
 * Authority: docs/templates/evaluation/short-form-evaluation-template.md (Revision Surface Ownership Contract section)
 *
 * This module is the sole source of truth for short-form section definitions,
 * revision surface ownership rules, forbidden sections, and rendered-output
 * validation. All renderers (web, PDF, DOCX, TXT) must import from here.
 * No renderer may independently declare section titles, revision inventories,
 * or forbidden heading lists.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type RevisionSurfaceRole =
  | 'metadata'
  | 'count_summary'
  | 'executive_synthesis'
  | 'canonical_diagnostic'
  | 'diagnostic_explanation'
  | 'legal_boundary'
  | 'pitch'
  | 'content_advisory'
  | 'score_grid';

export type ShortFormSection = {
  id: string;
  order: number;
  title: string;
  required: boolean;
  revisionSurfaceRole: RevisionSurfaceRole;
  mayContainFullOpportunities: boolean;
  mayContainRevisionCounts: boolean;
  mayContainRecommendationText: boolean;
  mustReferenceRevisionOpportunityLedger: boolean;
  rendererVisibility: {
    web: boolean;
    pdf: boolean;
    docx: boolean;
    txt: boolean;
  };
  forbiddenSectionAliases: string[];
};

export type RevisionSurfaceOwnershipResult = {
  passed: boolean;
  failures: RevisionSurfaceFailure[];
};

export type RevisionSurfaceFailure = {
  failure_code: string;
  renderer?: string;
  section?: string;
  field?: string;
  expected_behavior: string;
  actual_behavior: string;
  canonical_opportunity_id?: string;
  remediation_hint: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Canonical Short-Form Section Definitions
// ────────────────────────────────────────────────────────────────────────────

const SHORT_FORM_SECTIONS: ShortFormSection[] = [
  {
    id: 'title_block',
    order: 1,
    title: 'Title Block',
    required: true,
    revisionSurfaceRole: 'metadata',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'one_paragraph_pitch',
    order: 2,
    title: 'One-Paragraph Pitch',
    required: true,
    revisionSurfaceRole: 'pitch',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'one_sentence_pitch',
    order: 3,
    title: 'One-Sentence Pitch',
    required: true,
    revisionSurfaceRole: 'pitch',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'premise',
    order: 4,
    title: 'Premise',
    required: false,
    revisionSurfaceRole: 'pitch',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'content_warnings',
    order: 5,
    title: 'Content Warnings',
    required: true,
    revisionSurfaceRole: 'content_advisory',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'revision_opportunity_summary',
    order: 6,
    title: 'Revision Opportunity Summary',
    required: true,
    revisionSurfaceRole: 'count_summary',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: true,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'executive_summary',
    order: 7,
    title: 'Executive Summary',
    required: true,
    revisionSurfaceRole: 'executive_synthesis',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'top_strengths',
    order: 8,
    title: 'Top Strengths',
    required: true,
    revisionSurfaceRole: 'executive_synthesis',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'top_risks',
    order: 9,
    title: 'Top Risks',
    required: true,
    revisionSurfaceRole: 'executive_synthesis',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'top_recommendations',
    order: 10,
    title: 'Top Recommendations',
    required: true,
    revisionSurfaceRole: 'executive_synthesis',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: true,
    mustReferenceRevisionOpportunityLedger: true,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'criteria_score_grid',
    order: 11,
    title: '13 Criteria Score Grid',
    required: true,
    revisionSurfaceRole: 'score_grid',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'criterion_rationales',
    order: 12,
    title: 'Criterion Rationales & Surfaced Opportunities',
    required: true,
    revisionSurfaceRole: 'canonical_diagnostic',
    mayContainFullOpportunities: true,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: true,
    mustReferenceRevisionOpportunityLedger: true,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'confidence_explanation',
    order: 13,
    title: 'Confidence Explanation',
    required: true,
    revisionSurfaceRole: 'diagnostic_explanation',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
  {
    id: 'author_facing_disclaimer',
    order: 14,
    title: 'Author-Facing Disclaimer',
    required: true,
    revisionSurfaceRole: 'legal_boundary',
    mayContainFullOpportunities: false,
    mayContainRevisionCounts: false,
    mayContainRecommendationText: false,
    mustReferenceRevisionOpportunityLedger: false,
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    forbiddenSectionAliases: [],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Forbidden Short-Form Sections
// ────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_SHORT_FORM_SECTIONS: string[] = [
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
];

const FORBIDDEN_REVISION_INVENTORY_LABELS: string[] = [
  'Actions',
  'Action Items',
  'Strategic Revisions',
  'Revision Tasks',
  'Revision Queue',
  'Revision Priority Plan',
  'Repair Plan',
  'Deep Recommendations',
  'Expanded Recommendations',
  'Suggested Revisions',
];

const FORBIDDEN_SEVERITY_ALIASES: string[] = [
  'Critical',
  'High',
  'Medium',
  'Low',
  'Must Fix',
  'Should Fix',
  'Nice to Have',
  'Priority 1',
  'Priority 2',
  'Priority 3',
];

// ────────────────────────────────────────────────────────────────────────────
// Accessors
// ────────────────────────────────────────────────────────────────────────────

export function getShortFormSections(): readonly ShortFormSection[] {
  return SHORT_FORM_SECTIONS;
}

export function getShortFormSectionTitles(): string[] {
  return SHORT_FORM_SECTIONS.map(s => s.title);
}

export function getShortFormRequiredSectionTitles(): string[] {
  return SHORT_FORM_SECTIONS.filter(s => s.required).map(s => s.title);
}

export function getForbiddenShortFormSections(): readonly string[] {
  return FORBIDDEN_SHORT_FORM_SECTIONS;
}

export function getForbiddenRevisionInventoryLabels(): readonly string[] {
  return FORBIDDEN_REVISION_INVENTORY_LABELS;
}

export function getForbiddenSeverityAliases(): readonly string[] {
  return FORBIDDEN_SEVERITY_ALIASES;
}

// ────────────────────────────────────────────────────────────────────────────
// Startup Validation
// ────────────────────────────────────────────────────────────────────────────

export function validateShortFormSectionContract(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const orders = new Set<number>();
  const titles = new Set<string>();

  for (const s of SHORT_FORM_SECTIONS) {
    if (orders.has(s.order)) errors.push(`Duplicate order: ${s.order}`);
    orders.add(s.order);
    if (titles.has(s.title)) errors.push(`Duplicate title: ${s.title}`);
    titles.add(s.title);
  }

  // Required orders 1-14
  for (let i = 1; i <= 14; i++) {
    if (!orders.has(i)) errors.push(`Missing order: ${i}`);
  }

  // No forbidden section title collides with authorized titles
  const authorizedTitles = new Set(SHORT_FORM_SECTIONS.map(s => s.title));
  for (const forbidden of FORBIDDEN_SHORT_FORM_SECTIONS) {
    if (authorizedTitles.has(forbidden)) {
      errors.push(`Forbidden section collides with authorized: ${forbidden}`);
    }
  }

  // Required sections must be visible on all surfaces
  for (const s of SHORT_FORM_SECTIONS) {
    if (s.required) {
      const rv = s.rendererVisibility;
      if (!rv.web || !rv.pdf || !rv.docx || !rv.txt) {
        errors.push(`Required section ${s.id} not visible on all surfaces`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Heading Extraction (rendered-output inspection)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract top-level headings from rendered HTML (h2 tags).
 * Does NOT normalize — returns exact visible text.
 */
export function extractHtmlH2Headings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text) headings.push(text);
  }
  return headings;
}

/**
 * Extract top-level headings from rendered TXT (divider-delimited sections).
 * Looks for lines between divider rows (---... or ===...).
 */
export function extractTxtHeadings(txt: string): string[] {
  const headings: string[] = [];
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^[-=]{10,}$/.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (next && !/^[-=]{10,}$/.test(next)) {
        headings.push(next);
        i++;
      }
    }
  }
  return headings;
}

/**
 * Extract top-level headings from DOCX XML (word/document.xml).
 * Looks for paragraphs styled as Heading1 or Heading2.
 */
export function extractDocxXmlHeadings(documentXml: string): string[] {
  const headings: string[] = [];
  const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(documentXml)) !== null) {
    const paraContent = paraMatch[1];
    if (/w:val="Heading[12]"/.test(paraContent)) {
      const texts: string[] = [];
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch: RegExpExecArray | null;
      while ((textMatch = textRegex.exec(paraContent)) !== null) {
        texts.push(textMatch[1]);
      }
      const full = texts.join('').trim();
      if (full) headings.push(full);
    }
  }
  return headings;
}

// ────────────────────────────────────────────────────────────────────────────
// Rendered-Output Validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate that no forbidden short-form section headings appear as
 * top-level headings in the rendered output. Uses exact match.
 */
export function validateNoForbiddenHeadings(
  headings: string[],
  surface: string,
): RevisionSurfaceFailure[] {
  const failures: RevisionSurfaceFailure[] = [];
  const forbiddenSet = new Set(FORBIDDEN_SHORT_FORM_SECTIONS);

  for (const heading of headings) {
    if (forbiddenSet.has(heading)) {
      failures.push({
        failure_code: 'FORBIDDEN_TOP_LEVEL_SECTION',
        renderer: surface,
        section: heading,
        expected_behavior: `"${heading}" must not appear as a top-level section in short-form reports`,
        actual_behavior: `"${heading}" found as top-level heading`,
        remediation_hint: `Remove "${heading}" as a top-level section. Its content should be folded into authorized sections or moved to Revise Queue.`,
      });
    }
  }

  return failures;
}

/**
 * Validate that the rendered heading sequence matches the required
 * short-form section order. Skips optional/Title Block comparisons
 * (focuses on content sections that should appear).
 *
 * headings: actual rendered top-level headings
 * Returns failures if required headings are missing or out of order.
 */
export function validateShortFormHeadingSequence(
  headings: string[],
  surface: string,
): RevisionSurfaceFailure[] {
  const failures: RevisionSurfaceFailure[] = [];

  // Required section titles in order (skip Title Block — rendered differently)
  const required = SHORT_FORM_SECTIONS
    .filter(s => s.required && s.id !== 'title_block')
    .sort((a, b) => a.order - b.order)
    .map(s => s.title);

  // Check each required heading is present
  for (const title of required) {
    if (!headings.includes(title)) {
      failures.push({
        failure_code: 'MISSING_REQUIRED_SECTION',
        renderer: surface,
        section: title,
        expected_behavior: `Required section "${title}" must appear in rendered output`,
        actual_behavior: `"${title}" not found in rendered headings`,
        remediation_hint: `Add "${title}" section to the ${surface} renderer output.`,
      });
    }
  }

  // Check order of present required headings
  const presentRequired = required.filter(t => headings.includes(t));
  const headingIndices = presentRequired.map(t => headings.indexOf(t));
  for (let i = 1; i < headingIndices.length; i++) {
    if (headingIndices[i] < headingIndices[i - 1]) {
      failures.push({
        failure_code: 'SECTION_ORDER_VIOLATION',
        renderer: surface,
        section: presentRequired[i],
        expected_behavior: `"${presentRequired[i]}" must appear after "${presentRequired[i - 1]}"`,
        actual_behavior: `"${presentRequired[i]}" appears before "${presentRequired[i - 1]}" in rendered output`,
        remediation_hint: `Reorder sections in ${surface} renderer to match template contract.`,
      });
    }
  }

  return failures;
}

/**
 * Validate rendered output from all surfaces for a short-form report.
 * Returns aggregated failures across all checks.
 */
export function validateShortFormRenderedOutput(surfaces: {
  surface: string;
  headings: string[];
}[]): RevisionSurfaceOwnershipResult {
  const failures: RevisionSurfaceFailure[] = [];

  for (const { surface, headings } of surfaces) {
    failures.push(...validateNoForbiddenHeadings(headings, surface));
    failures.push(...validateShortFormHeadingSequence(headings, surface));
  }

  // Cross-surface parity: required sections must be present on all surfaces
  if (surfaces.length > 1) {
    const surfaceHeadingSets = surfaces.map(s => ({
      name: s.surface,
      headingSet: new Set(s.headings),
    }));
    const reference = surfaceHeadingSets[0];
    for (let i = 1; i < surfaceHeadingSets.length; i++) {
      const compare = surfaceHeadingSets[i];
      // Check for sections in reference but not in compare
      for (const heading of reference.headingSet) {
        if (!compare.headingSet.has(heading) && !FORBIDDEN_SHORT_FORM_SECTIONS.includes(heading)) {
          failures.push({
            failure_code: 'SURFACE_PARITY_FAILURE',
            renderer: compare.name,
            section: heading,
            expected_behavior: `"${heading}" present on ${reference.name} should also appear on ${compare.name}`,
            actual_behavior: `"${heading}" missing from ${compare.name}`,
            remediation_hint: `Ensure all surfaces render the same sections.`,
          });
        }
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Opportunity Count Validation
// ────────────────────────────────────────────────────────────────────────────

export type OpportunityCountSummary = {
  total: number;
  recommended: number;
  optional: number;
  consider: number;
};

/**
 * Validate that opportunity counts match between the rendered summary
 * and the canonical ledger.
 */
export function validateOpportunityCountParity(
  renderedSummary: OpportunityCountSummary,
  ledgerCounts: OpportunityCountSummary,
  surface: string,
): RevisionSurfaceFailure[] {
  const failures: RevisionSurfaceFailure[] = [];

  if (renderedSummary.total !== ledgerCounts.total) {
    failures.push({
      failure_code: 'COUNT_MISMATCH',
      renderer: surface,
      section: 'Revision Opportunity Summary',
      field: 'total',
      expected_behavior: `Total: ${ledgerCounts.total}`,
      actual_behavior: `Total: ${renderedSummary.total}`,
      remediation_hint: 'Rendered total must match revision_opportunity_ledger_v1 count.',
    });
  }

  if (renderedSummary.recommended !== ledgerCounts.recommended) {
    failures.push({
      failure_code: 'TIER_MISMATCH',
      renderer: surface,
      section: 'Revision Opportunity Summary',
      field: 'recommended',
      expected_behavior: `Recommended: ${ledgerCounts.recommended}`,
      actual_behavior: `Recommended: ${renderedSummary.recommended}`,
      remediation_hint: 'Rendered Recommended count must match ledger.',
    });
  }

  if (renderedSummary.optional !== ledgerCounts.optional) {
    failures.push({
      failure_code: 'TIER_MISMATCH',
      renderer: surface,
      section: 'Revision Opportunity Summary',
      field: 'optional',
      expected_behavior: `Optional: ${ledgerCounts.optional}`,
      actual_behavior: `Optional: ${renderedSummary.optional}`,
      remediation_hint: 'Rendered Optional count must match ledger.',
    });
  }

  if (renderedSummary.consider !== ledgerCounts.consider) {
    failures.push({
      failure_code: 'TIER_MISMATCH',
      renderer: surface,
      section: 'Revision Opportunity Summary',
      field: 'consider',
      expected_behavior: `Consider: ${ledgerCounts.consider}`,
      actual_behavior: `Consider: ${renderedSummary.consider}`,
      remediation_hint: 'Rendered Consider count must match ledger.',
    });
  }

  return failures;
}

// ────────────────────────────────────────────────────────────────────────────
// Section Role Query Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given section ID is the canonical diagnostic
 * opportunity surface (the ONLY section allowed to contain full opportunities).
 */
export function isCanonicalOpportunitySurface(sectionId: string): boolean {
  const section = SHORT_FORM_SECTIONS.find(s => s.id === sectionId);
  return section?.mayContainFullOpportunities === true;
}

/**
 * Returns the section IDs that must reference revision_opportunity_ledger_v1.
 */
export function getSectionsRequiringLedgerReference(): string[] {
  return SHORT_FORM_SECTIONS
    .filter(s => s.mustReferenceRevisionOpportunityLedger)
    .map(s => s.id);
}

/**
 * Returns true if a heading is forbidden as a top-level short-form section.
 */
export function isForbiddenShortFormHeading(heading: string): boolean {
  return FORBIDDEN_SHORT_FORM_SECTIONS.includes(heading);
}

/**
 * Returns true if a label is a forbidden revision inventory label.
 */
export function isForbiddenRevisionInventoryLabel(label: string): boolean {
  return FORBIDDEN_REVISION_INVENTORY_LABELS.includes(label);
}

/**
 * Returns true if a severity label is a forbidden alias
 * (should use Recommended/Optional/Consider instead).
 */
export function isForbiddenSeverityAlias(label: string): boolean {
  return FORBIDDEN_SEVERITY_ALIASES.includes(label);
}

// Run startup validation immediately on import
const _startupValidation = validateShortFormSectionContract();
if (!_startupValidation.valid) {
  throw new Error(
    `Short-form section contract validation failed:\n${_startupValidation.errors.join('\n')}`,
  );
}
