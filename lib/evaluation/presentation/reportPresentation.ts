/**
 * Report Presentation Helpers
 *
 * The single place where internal canonical opportunity fields are translated
 * into author-facing section labels and ordering. Renderers must import from
 * here and must not independently translate internal field names.
 */

import {
  OPPORTUNITY_PRESENTATION_LABELS,
  OPPORTUNITY_PRESENTATION_ORDER,
  OPPORTUNITY_PRIORITY_LABELS,
} from './reportDesignSystem';

export type PresentedOpportunitySectionKey =
  (typeof OPPORTUNITY_PRESENTATION_ORDER)[number];

export type PresentedOpportunitySectionRole =
  | 'quotation'
  | 'editorial_prose'
  | 'guardrail'
  | 'metadata';

export type PresentedOpportunitySection = {
  key: PresentedOpportunitySectionKey;
  label: string;
  text: string;
  role: PresentedOpportunitySectionRole;
  items?: string[];
};

export type PresentedOpportunityPriority = 'high' | 'medium' | 'low' | 'unknown';

export type PresentedOpportunity = {
  id: string | undefined;
  heading: string;
  priority: PresentedOpportunityPriority;
  priorityLabel: string;
  sections: PresentedOpportunitySection[];
};

type CanonicalOpportunityInput = {
  opportunity_id?: string | undefined;
  priority?: string | undefined;
  anchor_snippet?: string | undefined;
  anchor_type?: 'verbatim_quote' | 'paraphrased_observation' | 'editorial_diagnosis' | string | undefined;
  symptom?: string | undefined;
  mechanism?: string | undefined;
  specific_fix?: string | undefined;
  reader_effect?: string | undefined;
  mistake_proofing?: string | undefined;
  potential_damage?: string | string[] | undefined;
  collapsed_from_criteria?: string[] | undefined;
};

function normalizePriority(value: string | undefined): PresentedOpportunityPriority {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'unknown';
}

function priorityLabel(priority: PresentedOpportunityPriority): string {
  return OPPORTUNITY_PRIORITY_LABELS[priority] ?? OPPORTUNITY_PRIORITY_LABELS.unknown;
}

function renderAlsoAffects(keys: string[] | undefined): string | undefined {
  if (!keys || keys.length === 0) return undefined;
  return keys
    .map((key) => key.replace(/([A-Z])/g, ' $1').trim())
    .join(', ');
}

function renderPreserve(mistakeProofing: string | undefined): string | undefined {
  return mistakeProofing && mistakeProofing.trim().length > 0
    ? mistakeProofing.trim()
    : undefined;
}

function renderRiskIfMishandled(
  potentialDamage: string | string[] | undefined,
): { text: string; items?: string[] } | undefined {
  if (!potentialDamage) return undefined;

  if (Array.isArray(potentialDamage)) {
    const items = potentialDamage
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
    if (items.length === 0) return undefined;
    return { text: items.join(' '), items };
  }

  const text = potentialDamage.trim();
  if (text.length === 0) return undefined;
  return { text };
}

/**
 * Map a canonical recommendation into a renderer-ready presentation shape.
 *
 * The returned `sections` are ordered and labelled according to the shared
 * design system. Renderers only decide medium-specific formatting (quotes
 * for verbatim evidence, bullets for multi-item guardrails, etc.).
 */
export function presentOpportunity(
  input: CanonicalOpportunityInput,
  index: number,
): PresentedOpportunity {
  const priority = normalizePriority(input.priority);
  const heading = `Revision Opportunity ${index + 1}`;

  const evidenceRole: PresentedOpportunitySectionRole =
    input.anchor_type === 'verbatim_quote' ? 'quotation' : 'editorial_prose';

  const risk = renderRiskIfMishandled(input.potential_damage);

  const candidateSections: Array<
    | { key: PresentedOpportunitySectionKey; value: string; role: PresentedOpportunitySectionRole; items?: string[] }
    | undefined
  > = [
    { key: 'evidence', value: input.anchor_snippet ?? '', role: evidenceRole },
    { key: 'observation', value: input.symptom ?? '', role: 'editorial_prose' },
    { key: 'whyItMatters', value: input.mechanism ?? '', role: 'editorial_prose' },
    { key: 'suggestedDirection', value: input.specific_fix ?? '', role: 'editorial_prose' },
    { key: 'preserve', value: renderPreserve(input.mistake_proofing) ?? '', role: 'guardrail' },
    risk
      ? { key: 'riskIfMishandled', value: risk.text, role: 'guardrail', items: risk.items }
      : undefined,
    { key: 'expectedReaderExperience', value: input.reader_effect ?? '', role: 'editorial_prose' },
    {
      key: 'alsoAffects',
      value: renderAlsoAffects(input.collapsed_from_criteria) ?? '',
      role: 'metadata',
    },
  ];

  const sections: PresentedOpportunitySection[] = candidateSections
    .filter((section): section is { key: PresentedOpportunitySectionKey; value: string; role: PresentedOpportunitySectionRole; items?: string[] } =>
      section !== undefined && typeof section.value === 'string' && section.value.trim().length > 0,
    )
    .map((section) => ({
      key: section.key,
      label: OPPORTUNITY_PRESENTATION_LABELS[section.key],
      text: section.value.trim(),
      role: section.role,
      items: section.items,
    }));

  return {
    id: input.opportunity_id,
    heading,
    priority,
    priorityLabel: priorityLabel(priority),
    sections,
  };
}

/**
 * Map a list of canonical recommendations into presentation-ready opportunities.
 */
export function presentOpportunities(inputs: CanonicalOpportunityInput[]): PresentedOpportunity[] {
  return inputs
    .map((input, index) => presentOpportunity(input, index))
    .filter((opp) => opp.sections.length > 0);
}
