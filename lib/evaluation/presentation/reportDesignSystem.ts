/**
 * Report Presentation Vocabulary
 *
 * Author-facing labels and presentation ordering used by all report renderers.
 * This module does not encode fonts, colors, spacing, or page geometry;
 * those are renderer-specific concerns.
 */

export const OPPORTUNITY_PRESENTATION_LABELS = {
  evidence: 'Evidence',
  observation: 'What We Observed',
  whyItMatters: 'Why It Matters',
  suggestedDirection: 'Suggested Direction',
  preserve: 'Preserve',
  riskIfMishandled: 'Risk if Mishandled',
  expectedReaderExperience: 'Expected Reader Experience',
  alsoAffects: 'Also affects',
} as const;

export const OPPORTUNITY_PRESENTATION_ORDER = [
  'evidence',
  'observation',
  'whyItMatters',
  'suggestedDirection',
  'preserve',
  'riskIfMishandled',
  'expectedReaderExperience',
  'alsoAffects',
] as const;

export const OPPORTUNITY_PRIORITY_LABELS = {
  high: 'Priority Revision',
  medium: 'Recommended Revision',
  low: 'Consider',
  unknown: 'Unspecified',
} as const;

export const CRITERION_PRESENTATION_LABELS = {
  rationale: 'Editorial Rationale',
  strengths: 'What\'s Working Well',
  growthSummary: 'Opportunity for Growth',
  opportunities: 'Revision Opportunities',
} as const;

export const ABSENCE_STATUS_TEXT = 'Not established from the submitted material.' as const;
