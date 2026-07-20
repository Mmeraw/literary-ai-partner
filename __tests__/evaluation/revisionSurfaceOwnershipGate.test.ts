/**
 * Tests for Revision Surface Ownership Gate and Short-Form Section Contract.
 *
 * Authority: docs/templates/evaluation/short-form-evaluation-template.md
 * (Revision Surface Ownership Contract section)
 */

import {
  getShortFormSections,
  getShortFormSectionTitles,
  getShortFormRequiredSectionTitles,
  getForbiddenShortFormSections,
  getForbiddenRevisionInventoryLabels,
  getForbiddenSeverityAliases,
  validateShortFormSectionContract,
  extractHtmlH2Headings,
  extractTxtHeadings,
  extractDocxXmlHeadings,
  validateNoForbiddenHeadings,
  validateShortFormHeadingSequence,
  validateShortFormRenderedOutput,
  validateOpportunityCountParity,
  isCanonicalOpportunitySurface,
  getSectionsRequiringLedgerReference,
  isForbiddenShortFormHeading,
  isForbiddenRevisionInventoryLabel,
  isForbiddenSeverityAlias,
} from '@/lib/evaluation/shortFormSectionContract';

import {
  runRevisionSurfaceOwnershipGate,
  runRenderedOutputOwnershipGate,
  buildRevisionSurfaceOwnershipDiagnosis,
} from '@/lib/evaluation/revisionSurfaceOwnershipGate';

// ────────────────────────────────────────────────────────────────────────────
// Contract Self-Validation
// ────────────────────────────────────────────────────────────────────────────

describe('Short-Form Section Contract', () => {
  test('contract self-validates on import', () => {
    const result = validateShortFormSectionContract();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('defines exactly 14 sections', () => {
    expect(getShortFormSections().length).toBe(14);
  });

  test('section orders are contiguous 1-14', () => {
    const orders = getShortFormSections().map(s => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  test('all sections have unique titles', () => {
    const titles = getShortFormSectionTitles();
    expect(new Set(titles).size).toBe(titles.length);
  });

  test('no forbidden section title collides with authorized titles', () => {
    const authorized = new Set(getShortFormSectionTitles());
    const forbidden = getForbiddenShortFormSections();
    for (const f of forbidden) {
      expect(authorized.has(f)).toBe(false);
    }
  });

  test('required section titles match expected set', () => {
    const required = getShortFormRequiredSectionTitles();
    expect(required).toContain('One-Paragraph Pitch');
    expect(required).toContain('One-Sentence Pitch');
    expect(required).toContain('Content Warnings');
    expect(required).toContain('Revision Opportunity Summary');
    expect(required).toContain('Executive Summary');
    expect(required).toContain('Top Strengths');
    expect(required).toContain('Top Risks');
    expect(required).toContain('Top Recommendations');
    expect(required).toContain('13 Criteria Score Grid');
    expect(required).toContain('Criterion Rationales & Surfaced Opportunities');
    expect(required).toContain('Confidence Explanation');
    expect(required).toContain('Author-Facing Disclaimer');
  });

  test('criterion_rationales is the only canonical opportunity surface', () => {
    expect(isCanonicalOpportunitySurface('criterion_rationales')).toBe(true);
    expect(isCanonicalOpportunitySurface('top_recommendations')).toBe(false);
    expect(isCanonicalOpportunitySurface('executive_summary')).toBe(false);
  });

  test('top_recommendations and criterion_rationales require ledger reference', () => {
    const refs = getSectionsRequiringLedgerReference();
    expect(refs).toContain('top_recommendations');
    expect(refs).toContain('criterion_rationales');
    expect(refs).not.toContain('executive_summary');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Forbidden Sections
// ────────────────────────────────────────────────────────────────────────────

describe('Forbidden Short-Form Sections', () => {
  const forbidden = getForbiddenShortFormSections();

  test('includes all 14 prohibited sections from the contract', () => {
    expect(forbidden).toContain('Action Items');
    expect(forbidden).toContain('Strategic Revisions');
    expect(forbidden).toContain('Revision Queue');
    expect(forbidden).toContain('Revision Priority Plan');
    expect(forbidden).toContain('Deep Criterion Analysis');
    expect(forbidden).toContain('Expanded Criterion Analysis');
    expect(forbidden).toContain('Releasability Assessment');
    expect(forbidden).toContain('Review Gate');
    expect(forbidden).toContain('Additional Recommendations');
    expect(forbidden).toContain('Suggested Revisions');
    expect(forbidden).toContain('Strategic Revision Plan');
    expect(forbidden).toContain('Priority Revision Plan');
    expect(forbidden).toContain('Repair Plan');
    expect(forbidden).toContain('Editorial Action Plan');
  });

  test('isForbiddenShortFormHeading returns true for each', () => {
    for (const f of forbidden) {
      expect(isForbiddenShortFormHeading(f)).toBe(true);
    }
  });

  test('authorized titles are not forbidden', () => {
    const authorized = getShortFormSectionTitles();
    for (const a of authorized) {
      expect(isForbiddenShortFormHeading(a)).toBe(false);
    }
  });
});

describe('Forbidden Revision Inventory Labels', () => {
  test('includes key forbidden labels', () => {
    const labels = getForbiddenRevisionInventoryLabels();
    expect(labels).toContain('Action Items');
    expect(labels).toContain('Strategic Revisions');
    expect(labels).toContain('Revision Queue');
    expect(labels).toContain('Revision Priority Plan');
    expect(labels).toContain('Suggested Revisions');
  });

  test('isForbiddenRevisionInventoryLabel works', () => {
    expect(isForbiddenRevisionInventoryLabel('Action Items')).toBe(true);
    expect(isForbiddenRevisionInventoryLabel('Top Recommendations')).toBe(false);
  });
});

describe('Forbidden Severity Aliases', () => {
  test('includes forbidden aliases', () => {
    const aliases = getForbiddenSeverityAliases();
    expect(aliases).toContain('Critical');
    expect(aliases).toContain('Must Fix');
    expect(aliases).toContain('Priority 1');
  });

  test('canonical severity labels are not forbidden', () => {
    expect(isForbiddenSeverityAlias('Recommended')).toBe(false);
    expect(isForbiddenSeverityAlias('Optional')).toBe(false);
    expect(isForbiddenSeverityAlias('Consider')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Heading Extraction
// ────────────────────────────────────────────────────────────────────────────

describe('Heading Extraction', () => {
  test('extractHtmlH2Headings extracts h2 tags', () => {
    const html = `
      <h2>One-Paragraph Pitch</h2>
      <p>text</p>
      <h2>Top Recommendations</h2>
      <h3>Subsection</h3>
      <h2>Action Items</h2>
    `;
    const headings = extractHtmlH2Headings(html);
    expect(headings).toEqual(['One-Paragraph Pitch', 'Top Recommendations', 'Action Items']);
  });

  test('extractHtmlH2Headings strips inner tags', () => {
    const html = '<h2>Criterion Rationales &amp; <strong>Surfaced</strong> Opportunities</h2>';
    const headings = extractHtmlH2Headings(html);
    expect(headings).toEqual(['Criterion Rationales &amp; Surfaced Opportunities']);
  });

  test('extractTxtHeadings extracts divider-delimited sections', () => {
    const txt = [
      '========================================',
      'TITLE',
      '========================================',
      '',
      'Some content here',
      '',
      '----------------------------------------',
      'ONE-PARAGRAPH PITCH',
      '----------------------------------------',
      '',
      'Some more content here',
      '',
      '----------------------------------------',
      'ACTION ITEMS',
      '----------------------------------------',
    ].join('\n');
    const headings = extractTxtHeadings(txt);
    expect(headings).toEqual(['TITLE', 'ONE-PARAGRAPH PITCH', 'ACTION ITEMS']);
  });

  test('extractDocxXmlHeadings extracts Heading1 and Heading2 paragraphs', () => {
    const xml = `
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Top Recommendations</w:t></w:r></w:p>
      <w:p><w:r><w:t>Body text</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Action Items</w:t></w:r></w:p>
    `;
    const headings = extractDocxXmlHeadings(xml);
    expect(headings).toEqual(['Top Recommendations', 'Action Items']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Rendered-Output Validation
// ────────────────────────────────────────────────────────────────────────────

describe('Rendered-Output Validation', () => {
  describe('validateNoForbiddenHeadings', () => {
    test('passes when no forbidden headings present', () => {
      const headings = ['One-Paragraph Pitch', 'Top Recommendations', 'Confidence Explanation'];
      const failures = validateNoForbiddenHeadings(headings, 'html');
      expect(failures).toEqual([]);
    });

    test('fails when Action Items appears', () => {
      const headings = ['Top Recommendations', 'Action Items', 'Confidence Explanation'];
      const failures = validateNoForbiddenHeadings(headings, 'html');
      expect(failures.length).toBe(1);
      expect(failures[0].failure_code).toBe('FORBIDDEN_TOP_LEVEL_SECTION');
      expect(failures[0].section).toBe('Action Items');
    });

    test('fails for each forbidden heading', () => {
      const headings = ['Action Items', 'Deep Criterion Analysis', 'Review Gate'];
      const failures = validateNoForbiddenHeadings(headings, 'docx');
      expect(failures.length).toBe(3);
      expect(failures.map(f => f.section)).toEqual(['Action Items', 'Deep Criterion Analysis', 'Review Gate']);
    });

    test('fails for Releasability Assessment', () => {
      const failures = validateNoForbiddenHeadings(['Releasability Assessment'], 'pdf');
      expect(failures.length).toBe(1);
      expect(failures[0].failure_code).toBe('FORBIDDEN_TOP_LEVEL_SECTION');
    });

    test('fails for Expanded Criterion Analysis', () => {
      const failures = validateNoForbiddenHeadings(['Expanded Criterion Analysis'], 'txt');
      expect(failures.length).toBe(1);
    });

    test('fails for Revision Priority Plan', () => {
      const failures = validateNoForbiddenHeadings(['Revision Priority Plan'], 'html');
      expect(failures.length).toBe(1);
    });

    test('fails for Strategic Revisions', () => {
      const failures = validateNoForbiddenHeadings(['Strategic Revisions'], 'html');
      expect(failures.length).toBe(1);
    });

    test('fails for Suggested Revisions', () => {
      const failures = validateNoForbiddenHeadings(['Suggested Revisions'], 'docx');
      expect(failures.length).toBe(1);
    });
  });

  describe('validateShortFormHeadingSequence', () => {
    test('passes with correct order', () => {
      const headings = [
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
        'Confidence Explanation',
        'Author-Facing Disclaimer',
      ];
      const failures = validateShortFormHeadingSequence(headings, 'html');
      expect(failures).toEqual([]);
    });

    test('fails when required section is missing', () => {
      const headings = [
        'One-Paragraph Pitch',
        'Top Recommendations',
        'Confidence Explanation',
        'Author-Facing Disclaimer',
      ];
      const failures = validateShortFormHeadingSequence(headings, 'html');
      const missing = failures.filter(f => f.failure_code === 'MISSING_REQUIRED_SECTION');
      expect(missing.length).toBeGreaterThan(0);
      expect(missing.map(f => f.section)).toContain('Executive Summary');
    });

    test('fails when sections are out of order', () => {
      const headings = [
        'Author-Facing Disclaimer',
        'One-Paragraph Pitch',
        'Top Recommendations',
        'Confidence Explanation',
      ];
      const failures = validateShortFormHeadingSequence(headings, 'html');
      const orderViolations = failures.filter(f => f.failure_code === 'SECTION_ORDER_VIOLATION');
      expect(orderViolations.length).toBeGreaterThan(0);
    });
  });

  describe('validateShortFormRenderedOutput', () => {
    const correctHeadings = [
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
      'Confidence Explanation',
      'Author-Facing Disclaimer',
    ];

    test('passes when all surfaces have correct headings', () => {
      const result = validateShortFormRenderedOutput([
        { surface: 'html', headings: [...correctHeadings] },
        { surface: 'txt', headings: [...correctHeadings] },
        { surface: 'docx', headings: [...correctHeadings] },
      ]);
      expect(result.passed).toBe(true);
      expect(result.failures).toEqual([]);
    });

    test('fails when one surface has forbidden heading', () => {
      const result = validateShortFormRenderedOutput([
        { surface: 'html', headings: [...correctHeadings] },
        { surface: 'docx', headings: [...correctHeadings, 'Action Items'] },
      ]);
      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.failure_code === 'FORBIDDEN_TOP_LEVEL_SECTION')).toBe(true);
    });

    test('detects surface parity failure', () => {
      const result = validateShortFormRenderedOutput([
        { surface: 'html', headings: [...correctHeadings] },
        { surface: 'docx', headings: correctHeadings.filter(h => h !== 'Top Strengths') },
      ]);
      expect(result.passed).toBe(false);
      const parityFailures = result.failures.filter(f => f.failure_code === 'SURFACE_PARITY_FAILURE');
      expect(parityFailures.length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Opportunity Count Validation
// ────────────────────────────────────────────────────────────────────────────

describe('Opportunity Count Validation', () => {
  test('passes when counts match', () => {
    const rendered = { total: 10, recommended: 4, optional: 3, consider: 3 };
    const ledger = { total: 10, recommended: 4, optional: 3, consider: 3 };
    const failures = validateOpportunityCountParity(rendered, ledger, 'html');
    expect(failures).toEqual([]);
  });

  test('fails when total mismatches', () => {
    const rendered = { total: 12, recommended: 4, optional: 3, consider: 3 };
    const ledger = { total: 10, recommended: 4, optional: 3, consider: 3 };
    const failures = validateOpportunityCountParity(rendered, ledger, 'html');
    expect(failures.length).toBe(1);
    expect(failures[0].failure_code).toBe('COUNT_MISMATCH');
  });

  test('fails when tier counts mismatch', () => {
    const rendered = { total: 10, recommended: 5, optional: 2, consider: 3 };
    const ledger = { total: 10, recommended: 4, optional: 3, consider: 3 };
    const failures = validateOpportunityCountParity(rendered, ledger, 'html');
    expect(failures.length).toBe(2); // recommended + optional
    expect(failures.every(f => f.failure_code === 'TIER_MISMATCH')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REVISION_SURFACE_OWNERSHIP_GATE
// ────────────────────────────────────────────────────────────────────────────

describe('REVISION_SURFACE_OWNERSHIP_GATE', () => {
  const makeMinimalDoc = () => ({
    templateMode: 'short_form_evaluation',
    criterionDetails: [
      {
        label: 'Plot & Structure',
        rationaleText: 'Clear causal flow with identifiable escalation.',
        scoreLabel: 'Strong',
        recommendations: [
          { action: 'Tighten midpoint transition.', opportunity_id: 'opp-1' },
        ],
      },
      {
        label: 'Character',
        rationaleText: 'Character motivation is coherent.',
        scoreLabel: 'Strong',
        recommendations: [
          { action: 'Sharpen antagonist objective.', opportunity_id: 'opp-2' },
        ],
      },
    ],
    revisionOpportunitySummary: {
      total: 2,
      high: 1,
      medium: 1,
      low: 0,
    },
    canonicalOpportunityLedger: {
      opportunities: [
        { opportunity_id: 'opp-1' },
        { opportunity_id: 'opp-2' },
      ],
      rendered_opportunities: [
        { opportunity_id: 'opp-1' },
        { opportunity_id: 'opp-2' },
      ],
    },
    topRecommendations: [
      'Clarify priority structural risks first, then tune supporting execution.',
    ],
  });

  test('fails when criterionDetails is missing on a completed UED', () => {
    const result = runRevisionSurfaceOwnershipGate({
      templateMode: 'short_form_evaluation',
    } as never);

    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'UED_STRUCTURE_INVALID')).toBe(true);
  });

  test('passes for clean short-form UED', () => {
    const result = runRevisionSurfaceOwnershipGate(makeMinimalDoc() as never);
    expect(result.status).toBe('pass');
    expect(result.failures).toEqual([]);
  });

  test('fails when recommendation is missing opportunity_id', () => {
    const doc = makeMinimalDoc();
    (doc.criterionDetails[0].recommendations[0] as Record<string, unknown>).opportunity_id = '';

    const result = runRevisionSurfaceOwnershipGate(doc as never);
    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'MISSING_OPPORTUNITY_ID')).toBe(true);
  });

  test('fails when summary total mismatches unique opportunity count', () => {
    const doc = makeMinimalDoc();
    doc.revisionOpportunitySummary.total = 99;

    const result = runRevisionSurfaceOwnershipGate(doc as never);
    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'COUNT_MISMATCH')).toBe(true);
  });

  test('fails when tier sum mismatches declared total', () => {
    const doc = makeMinimalDoc();
    doc.revisionOpportunitySummary.total = 2;
    doc.revisionOpportunitySummary.high = 2;
    doc.revisionOpportunitySummary.medium = 2;
    doc.revisionOpportunitySummary.low = 2;

    const result = runRevisionSurfaceOwnershipGate(doc as never);
    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'TIER_MISMATCH')).toBe(true);
  });

  test('fails when top recommendations duplicate criterion recommendation verbatim', () => {
    const doc = makeMinimalDoc();
    doc.topRecommendations = ['Tighten midpoint transition.'];

    const result = runRevisionSurfaceOwnershipGate(doc as never);
    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'TOP_RECOMMENDATION_VERBATIM_DUPLICATE')).toBe(true);
  });

  test('fails when criterion rationale embeds forbidden heading label', () => {
    const doc = makeMinimalDoc();
    doc.criterionDetails[0].rationaleText = '## Action Items\nThis should never appear in rationale.';

    const result = runRevisionSurfaceOwnershipGate(doc as never);
    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'FORBIDDEN_HEADING_IN_UED_CRITERION')).toBe(true);
  });
});

describe('runRenderedOutputOwnershipGate', () => {
  test('passes when rendered outputs have no forbidden headings', () => {
    const result = runRenderedOutputOwnershipGate({
      html: '## One-Paragraph Pitch\n## Top Recommendations',
      txt: '## Confidence Explanation',
    });

    expect(result.status).toBe('pass');
    expect(result.failures).toEqual([]);
  });

  test('fails when rendered output contains forbidden heading', () => {
    const result = runRenderedOutputOwnershipGate({
      html: '## Action Items\n## Top Recommendations',
    });

    expect(result.status).toBe('fail');
    expect(result.failures.some((f) => f.failure_code === 'FORBIDDEN_HEADING_IN_RENDERED_OUTPUT')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Failure Diagnosis Builder
// ────────────────────────────────────────────────────────────────────────────

describe('Failure Diagnosis Builder', () => {
  test('builds valid failure_diagnosis_v1 payload', () => {
    const gateResult = {
      status: 'fail' as const,
      checked_at: new Date().toISOString(),
      failures: [
        {
          failure_code: 'FORBIDDEN_HEADING_IN_RENDERED_OUTPUT',
          renderer: 'html',
          section: 'Action Items',
          expected_behavior: '"Action Items" must not appear',
          actual_behavior: '"Action Items" found as top-level heading',
          remediation_hint: 'Remove Action Items section',
        },
      ],
    };

    const diagnosis = buildRevisionSurfaceOwnershipDiagnosis(gateResult, 'job-123');
    expect(diagnosis.failure_code).toBe('REVISION_SURFACE_OWNERSHIP_GATE_FAILED');
    expect(diagnosis.failure_class).toBe('governance_blocked');
    expect(diagnosis.failure_point.gate).toBe('REVISION_SURFACE_OWNERSHIP_GATE');
    expect(diagnosis.failure_point.stage).toBe('Phase 5');
    expect(diagnosis.failure_point.artifact_type).toBe('unified_evaluation_document_v1');
    expect(Array.isArray(diagnosis.revision_surface_ownership_failures)).toBe(true);
    const f = (diagnosis.revision_surface_ownership_failures as Array<Record<string, unknown>>)[0];
    expect(f.failure_code).toBe('FORBIDDEN_HEADING_IN_RENDERED_OUTPUT');
    expect(f.section).toBe('Action Items');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Grep-Style Invariants
// ────────────────────────────────────────────────────────────────────────────

describe('Grep-Style Invariants', () => {
  test('forbidden sections list has no duplicates', () => {
    const list = [...getForbiddenShortFormSections()];
    expect(new Set(list).size).toBe(list.length);
  });

  test('forbidden inventory labels list has no duplicates', () => {
    const list = [...getForbiddenRevisionInventoryLabels()];
    expect(new Set(list).size).toBe(list.length);
  });

  test('forbidden severity aliases list has no duplicates', () => {
    const list = [...getForbiddenSeverityAliases()];
    expect(new Set(list).size).toBe(list.length);
  });

  test('every forbidden section is also a forbidden inventory label or pure section name', () => {
    const inventoryLabels = new Set(getForbiddenRevisionInventoryLabels());
    const forbidden = getForbiddenShortFormSections();
    // At minimum, the overlap should include the key offenders
    expect(inventoryLabels.has('Action Items')).toBe(true);
    expect(inventoryLabels.has('Strategic Revisions')).toBe(true);
    expect(inventoryLabels.has('Revision Queue')).toBe(true);
    expect(inventoryLabels.has('Revision Priority Plan')).toBe(true);
    // But some forbidden sections (like Releasability Assessment) are section-only, not inventory labels
    expect(forbidden.length).toBeGreaterThanOrEqual(inventoryLabels.size);
  });
});
