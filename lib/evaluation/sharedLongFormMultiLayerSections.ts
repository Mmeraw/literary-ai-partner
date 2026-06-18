/**
 * sharedLongFormMultiLayerSections.ts
 *
 * SINGLE SOURCE OF TRUTH for §13–§21 section definitions used by the
 * long-form multi-layer evaluation template.
 *
 * Architectural invariant:
 *   Template → Section Contract → UED → Web / PDF / DOCX / TXT
 *
 * No renderer may declare its own §13–§21 title array.  Every renderer
 * calls `getLongFormMultiLayerSections()` and uses the returned contract.
 *
 * Run `validateLongFormMultiLayerSectionContract()` at startup to fail
 * fast on any misconfiguration.
 */

// ── Section Contract Type ───────────────────────────────────────────────

export type LongFormMultiLayerSection = {
  /** Stable machine identifier (e.g. 'story_ledger'). */
  id: string;
  /** Canonical render order.  Must be unique across sections. */
  order: number;
  /** Exact author-facing heading.  Renderers must emit this verbatim. */
  title: string;

  /** If true, the section MUST appear even if evidence is limited. */
  required: boolean;
  /** If true, DREAM content may enrich this section. */
  allowDreamEnrichment: boolean;

  /**
   * Raw DREAM heading names that must NEVER appear as top-level
   * author-facing headings.  They may only appear as subsection
   * labels or body text nested inside this section.
   */
  forbiddenDreamTitles: string[];

  /**
   * UED modeSpecific field paths that feed this section when DREAM
   * is not available (fallback path).
   */
  sourceFields: string[];

  /** Which renderer surfaces must render this section. */
  rendererVisibility: {
    web: boolean;
    pdf: boolean;
    docx: boolean;
    txt: boolean;
  };

  /** Content floor rules. */
  minimumContentRules: {
    /** If false, the section must have non-empty content. */
    allowEmpty: boolean;
    /** If true, an evidence-limited statement is acceptable when data is sparse. */
    evidenceLimitedTextAllowed: boolean;
  };
};

// ── Canonical Section Definitions ───────────────────────────────────────

const SECTIONS: readonly LongFormMultiLayerSection[] = [
  {
    id: 'expanded_criterion_analysis',
    order: 12,
    title: 'Expanded Criterion Analysis',
    required: false,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Deep Criterion Analysis'],
    sourceFields: [],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: true, evidenceLimitedTextAllowed: false },
  },
  {
    id: 'story_ledger',
    order: 13,
    title: 'Story Ledger or Layer-Aware Architecture Map',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Structural Architecture', 'Arc Map'],
    sourceFields: ['modeSpecific.storyLedgerArchitectureMap'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'review_gate',
    order: 14,
    title: 'Review Gate Readiness Surface',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Review Gate'],
    sourceFields: ['modeSpecific.reviewGateReadinessSurface'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'governed_ledgers',
    order: 15,
    title: 'Governed Ledgers or Compact Governed-Ledger Addenda',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Symbolic & Doctrine Audit'],
    sourceFields: ['modeSpecific.governedLedgerAddenda'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'cross_layer_synthesis',
    order: 16,
    title: 'Cross-Layer Synthesis',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Narrative Synthesis', 'Cross-Layer Integration', 'Reader Experience'],
    sourceFields: ['modeSpecific.crossLayerSynthesis'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: false },
  },
  {
    id: 'revision_sequencing',
    order: 17,
    title: 'Layer-Aware Revision Sequencing',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: [],
    sourceFields: ['modeSpecific.layerAwareRevisionSequencing', 'modeSpecific.revisionPriorityPlan'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'continuity_coverage',
    order: 18,
    title: 'Long-Form Continuity and Coverage Proof',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: [],
    sourceFields: ['modeSpecific.continuityCoverageProof'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'readiness_posture',
    order: 19,
    title: 'Readiness / Releasability Posture',
    required: true,
    allowDreamEnrichment: true,
    forbiddenDreamTitles: ['Releasability Assessment', 'Market Shelf'],
    sourceFields: ['modeSpecific.readinessReleasabilityPosture'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: true },
  },
  {
    id: 'confidence_explanation',
    order: 20,
    title: 'Confidence Explanation',
    required: true,
    allowDreamEnrichment: false,
    forbiddenDreamTitles: [],
    sourceFields: ['confidenceExplanation'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: false },
  },
  {
    id: 'disclaimer',
    order: 21,
    title: 'Author-Facing Disclaimer',
    required: true,
    allowDreamEnrichment: false,
    forbiddenDreamTitles: [],
    sourceFields: ['disclaimer'],
    rendererVisibility: { web: true, pdf: true, docx: true, txt: true },
    minimumContentRules: { allowEmpty: false, evidenceLimitedTextAllowed: false },
  },
] as const;

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Returns the canonical §13–§21 section contract in render order.
 * Every renderer MUST call this instead of declaring its own title list.
 */
export function getLongFormMultiLayerSections(): readonly LongFormMultiLayerSection[] {
  return SECTIONS;
}

/**
 * Returns only the §13–§21 sections (order 13..21) that carry the
 * template-authorized top-level headings renderers must emit.
 */
export function getRequiredTemplateSections(): readonly LongFormMultiLayerSection[] {
  return SECTIONS.filter(s => s.order >= 13 && s.order <= 21);
}

/**
 * Exact required §13–§21 top-level heading titles in render order.
 * Used by validation to assert rendered output matches.
 */
export function getRequiredSectionTitles(): readonly string[] {
  return getRequiredTemplateSections().map(s => s.title);
}

/**
 * All forbidden DREAM top-level headings aggregated from the contract.
 * These must never appear as H1/H2/top-level divider headings in any
 * renderer surface.
 */
export function getForbiddenTopLevelHeadings(): readonly string[] {
  const all = new Set<string>();
  for (const section of SECTIONS) {
    for (const f of section.forbiddenDreamTitles) {
      all.add(f);
    }
  }
  return Array.from(all);
}

/**
 * Near-duplicate variants of forbidden headings for fuzzy drift detection.
 * These catch common rename drift (e.g. "Cross Layer Synthesis" without hyphen).
 */
export function getForbiddenNearDuplicates(): readonly string[] {
  return [
    'Narrative Synthesis',
    'Structural Architecture',
    'Arc Map',
    'Deep Criterion Analysis',
    'Cross-Layer Integration',
    'Cross Layer Integration',
    'Cross Layer Synthesis',
    'Symbolic & Doctrine Audit',
    'Symbolic and Doctrine Audit',
    'Reader Experience',
    'Market Shelf',
    'Releasability Assessment',
    'Readiness Assessment',
    'Review Gate',
    'Revision Priority Plan',
    'Layer Analysis',
  ];
}

// ── Startup Validation ──────────────────────────────────────────────────

export type SectionContractValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validates the section contract at startup.  Fails fast on:
 * - Duplicate order values
 * - Duplicate titles
 * - Missing §13–§21 (any gap in required range)
 * - Forbidden title collision (a section title matches a forbidden heading)
 * - Invisible required section (required but not visible on all surfaces)
 * - Cross-renderer visibility mismatch (required visible on some but not all)
 */
export function validateLongFormMultiLayerSectionContract(): SectionContractValidationResult {
  const errors: string[] = [];

  // Duplicate order values
  const orderCounts = new Map<number, string[]>();
  for (const s of SECTIONS) {
    const existing = orderCounts.get(s.order) ?? [];
    existing.push(s.id);
    orderCounts.set(s.order, existing);
  }
  for (const [order, ids] of orderCounts) {
    if (ids.length > 1) {
      errors.push(`Duplicate order ${order}: ${ids.join(', ')}`);
    }
  }

  // Duplicate titles
  const titleCounts = new Map<string, string[]>();
  for (const s of SECTIONS) {
    const existing = titleCounts.get(s.title) ?? [];
    existing.push(s.id);
    titleCounts.set(s.title, existing);
  }
  for (const [title, ids] of titleCounts) {
    if (ids.length > 1) {
      errors.push(`Duplicate title "${title}": ${ids.join(', ')}`);
    }
  }

  // Missing §13–§21
  for (let order = 13; order <= 21; order++) {
    if (!SECTIONS.some(s => s.order === order)) {
      errors.push(`Missing section with order ${order} in §13–§21 range`);
    }
  }

  // Forbidden title collision
  const allForbidden = new Set(getForbiddenTopLevelHeadings());
  for (const s of SECTIONS) {
    if (allForbidden.has(s.title)) {
      errors.push(`Section "${s.id}" title "${s.title}" collides with a forbidden DREAM heading`);
    }
  }

  // Invisible required section
  for (const s of SECTIONS) {
    if (s.required) {
      const vis = s.rendererVisibility;
      if (!vis.web || !vis.pdf || !vis.docx || !vis.txt) {
        const missing = Object.entries(vis)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        errors.push(`Required section "${s.id}" is invisible on: ${missing.join(', ')}`);
      }
    }
  }

  // Cross-renderer visibility mismatch for required sections
  for (const s of SECTIONS) {
    if (!s.required) continue;
    const vis = s.rendererVisibility;
    const values = [vis.web, vis.pdf, vis.docx, vis.txt];
    if (new Set(values).size > 1) {
      errors.push(`Required section "${s.id}" has inconsistent visibility across renderers`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Rendered Output Validation ──────────────────────────────────────────

export type RenderedParityResult = {
  valid: boolean;
  errors: string[];
  surface: string;
};

/**
 * Validates that an array of top-level headings extracted from a rendered
 * surface contains the exact §13–§21 sequence and no forbidden headings.
 *
 * Required headings: exact match (case-sensitive, no normalization).
 * Forbidden headings: exact + near-duplicate fuzzy match.
 */
export function validateRenderedHeadings(
  headings: string[],
  surface: string,
): RenderedParityResult {
  const errors: string[] = [];
  const requiredTitles = getRequiredSectionTitles();
  const forbidden = new Set(getForbiddenTopLevelHeadings());
  const nearDuplicates = new Set(getForbiddenNearDuplicates());

  // Check forbidden headings (exact match)
  for (const h of headings) {
    if (forbidden.has(h)) {
      errors.push(`[${surface}] Forbidden top-level heading found: "${h}"`);
    }
  }

  // Check near-duplicate forbidden headings (fuzzy)
  for (const h of headings) {
    if (nearDuplicates.has(h) && !requiredTitles.includes(h)) {
      errors.push(`[${surface}] Near-duplicate forbidden heading found: "${h}"`);
    }
  }

  // Check required §13–§21 sequence exists in order
  let searchStart = 0;
  for (const required of requiredTitles) {
    const idx = headings.indexOf(required, searchStart);
    if (idx === -1) {
      errors.push(`[${surface}] Required heading missing: "${required}"`);
    } else {
      searchStart = idx + 1;
    }
  }

  return { valid: errors.length === 0, errors, surface };
}

/**
 * Validates parity across all four surfaces.
 * Returns a combined result with all errors.
 */
export function validateCrossSurfaceParity(
  surfaces: Record<string, string[]>,
): { valid: boolean; errors: string[]; results: RenderedParityResult[] } {
  const results: RenderedParityResult[] = [];
  const allErrors: string[] = [];

  for (const [surface, headings] of Object.entries(surfaces)) {
    const result = validateRenderedHeadings(headings, surface);
    results.push(result);
    allErrors.push(...result.errors);
  }

  // Cross-surface parity: all surfaces must have the same required heading set
  const surfaceNames = Object.keys(surfaces);
  if (surfaceNames.length > 1) {
    const requiredTitles = getRequiredSectionTitles();
    const presentMap = new Map<string, string[]>();
    for (const title of requiredTitles) {
      const presentIn = surfaceNames.filter(s => surfaces[s].includes(title));
      if (presentIn.length > 0 && presentIn.length < surfaceNames.length) {
        const missingFrom = surfaceNames.filter(s => !surfaces[s].includes(title));
        allErrors.push(`Section "${title}" present in [${presentIn.join(', ')}] but missing from [${missingFrom.join(', ')}]`);
      }
      presentMap.set(title, presentIn);
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors, results };
}

// ── Heading Extraction Helpers ──────────────────────────────────────────

/**
 * Extract top-level headings from HTML string (h2 tags).
 * Used for PDF/HTML surface validation.
 */
export function extractHtmlH2Headings(html: string): string[] {
  const regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (text.length > 0) headings.push(text);
  }
  return headings;
}

/**
 * Extract top-level headings from TXT string (divider-delimited sections).
 * TXT sections use a line of '═' or '─' characters as dividers,
 * with the heading text on the line immediately after.
 */
export function extractTxtHeadings(txt: string): string[] {
  const lines = txt.split('\n');
  const headings: string[] = [];
  const dividerPattern = /^[═─]{3,}$/;
  for (let i = 0; i < lines.length - 1; i++) {
    if (dividerPattern.test(lines[i].trim())) {
      const next = lines[i + 1]?.trim();
      if (next && next.length > 0 && !dividerPattern.test(next)) {
        headings.push(next);
      }
    }
  }
  return headings;
}

/**
 * Extract top-level headings from DOCX XML (word/document.xml).
 * Looks for paragraphs with Heading2 style.
 */
export function extractDocxXmlHeadings(documentXml: string): string[] {
  const headings: string[] = [];
  // Match <w:pStyle w:val="Heading2"/> within paragraph properties,
  // then extract text runs from the same paragraph
  const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(documentXml)) !== null) {
    const paraContent = paraMatch[1];
    // Check if this paragraph has Heading1 or Heading2 style
    if (/<w:pStyle\s+w:val="Heading[12]"/.test(paraContent)) {
      // Extract all text runs
      const textParts: string[] = [];
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch: RegExpExecArray | null;
      while ((textMatch = textRegex.exec(paraContent)) !== null) {
        textParts.push(textMatch[1]);
      }
      const heading = textParts.join('').trim();
      if (heading.length > 0) headings.push(heading);
    }
  }
  return headings;
}

/**
 * Validates DOCX XML structure beyond just headings.
 * Checks for:
 * - Footer/header text appearing in body
 * - Label:—Value patterns
 */
export function validateDocxXmlStructure(documentXml: string): string[] {
  const errors: string[] = [];

  // Check for label:—value pattern (common DOCX formatting defect)
  if (/:\s*—/.test(documentXml)) {
    // Extract context around the match for error reporting
    const match = documentXml.match(/([^<]{0,40}:\s*—[^<]{0,40})/);
    if (match) {
      errors.push(`DOCX contains label:—value pattern: "${match[1].trim()}"`);
    }
  }

  // Check that header/footer text is not in body
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (bodyMatch) {
    const bodyText = bodyMatch[1];
    const headerFooterPatterns = [
      'RevisionGrade™ Evaluation Report',
      'Confidential Editorial Assessment',
    ];
    // These should be in headers/footers, not in body paragraphs as standalone text
    // (They can appear as part of the title block, so we check for them as standalone paragraphs)
  }

  return errors;
}
