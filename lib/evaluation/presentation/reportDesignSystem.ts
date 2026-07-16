/**
 * Report Design System
 *
 * Renderer-neutral design tokens and presentation vocabulary for all report
 * surfaces (Web, PDF, DOCX, TXT). No font sizes, colors, or page geometry are
 * encoded in the UED or report VM; this module is the canonical source that
 * medium-specific adapters consult.
 */

export const REPORT_DESIGN_TOKENS = {
  colors: {
    oxblood: '#8B2E2E',
    oxbloodDark: '#6F1D1B',
    goldMid: '#C8A96E',
    goldDark: '#B8922A',
    surface: '#FFFAF2',
    surfaceAlt: '#FAF7F2',
    borderLight: '#E6DED2',
    borderMid: '#D9D0C3',
    textPrimary: '#1C1814',
    textMuted: '#5C5549',
    textFaint: '#9A9087',
    success: '#3A6B2A',
    warning: '#8B5E1A',
    error: '#8B2020',
  },
  fonts: {
    serif: 'Georgia, "Times New Roman", serif',
    sans: 'Helvetica, Arial, sans-serif',
  },
  spacing: {
    sectionGap: '22px 0 24px',
    cardPadding: '14px 18px',
  },
} as const;

export type ReportColorKey = keyof typeof REPORT_DESIGN_TOKENS.colors;

/**
 * Author-facing presentation vocabulary.
 *
 * Internal canonical field names are intentionally NOT used in renderers.
 * The ViewModel maps canonical fields to these labels at the sanitization boundary.
 */
export const OPPORTUNITY_PRESENTATION_LABELS = {
  evidence: 'Evidence',
  observation: 'What We Observed',
  whyItMatters: 'Why It Matters',
  suggestedDirection: 'Suggested Direction',
  preserve: 'Preserve',
  expectedReaderExperience: 'Expected Reader Experience',
  alsoAffects: 'Also affects',
} as const;

export const OPPORTUNITY_PRESENTATION_ORDER = [
  'evidence',
  'observation',
  'whyItMatters',
  'suggestedDirection',
  'preserve',
  'expectedReaderExperience',
  'alsoAffects',
] as const;

export const OPPORTUNITY_PRIORITY_LABELS = {
  high: 'Recommended',
  medium: 'Optional',
  low: 'Consider',
} as const;

export const CRITERION_PRESENTATION_LABELS = {
  rationale: 'Editorial Rationale',
  strengths: 'What\'s Working Well',
  growthSummary: 'Opportunity for Growth',
  opportunities: 'Revision Opportunities',
} as const;
