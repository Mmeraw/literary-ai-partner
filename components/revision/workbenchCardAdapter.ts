import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';
import type {
  CopyPasteCandidate,
  CopyPasteCardViewModel,
  StrategyCardUiViewModel,
  WithheldCardViewModel,
  WorkbenchCardViewModel,
} from './workbenchCardModels';

const ILLUSTRATIVE_DISCLAIMER = 'Illustrative phrasing only—not a replacement passage' as const;

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function sourceTextOf(item: WorkbenchOpportunity): string {
  const text = `${item.quoteHighlight ?? ''}${item.quoteRest ?? ''}`.trim();
  return /no excerpt available/i.test(text) ? '' : text;
}

function optionText(item: WorkbenchOpportunity, key: 'A' | 'B' | 'C'): string {
  const option = item.options.find((candidate) => candidate.key === key);
  return normalize(option?.candidateText ?? option?.text);
}

function copyPasteCandidate(item: WorkbenchOpportunity, key: 'A' | 'B' | 'C'): CopyPasteCandidate {
  const option = item.options.find((candidate) => candidate.key === key);
  const defaultLabel = key === 'A' ? 'Recommended repair' : key === 'B' ? 'Rhythm variant' : 'Bolder rendering shift';
  return {
    key,
    label: normalize(option?.mechanism) || defaultLabel,
    text: optionText(item, key),
    rationale: normalize(option?.rationale) || undefined,
  };
}

function toCopyPasteCard(item: WorkbenchOpportunity): CopyPasteCardViewModel {
  return {
    opportunityId: item.id,
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    severity: item.severity,
    criterion: item.criterion,
    originalPassage: sourceTextOf(item),
    evidenceLocation: normalize(item.anchor || item.meta) || 'Location pending',
    candidates: [copyPasteCandidate(item, 'A'), copyPasteCandidate(item, 'B'), copyPasteCandidate(item, 'C')],
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function toStrategyCard(item: WorkbenchOpportunity): StrategyCardUiViewModel {
  const scaffold = item.strategyCardViewModel?.scaffold;
  const recommendedStrategy = normalize(
    item.fixDirection || item.diagnostic?.fixStrategy || scaffold?.moderateApproach || item.issueStatement,
  );
  const evidenceScope = normalize(item.evidenceLocationScope || item.scope).toLowerCase() || 'passage';
  const repairScope = normalize(item.repairScope || item.scope).toLowerCase() || evidenceScope;
  const implementationSequence = unique([
    recommendedStrategy ? `Apply the recommended strategy at the ${repairScope} level.` : undefined,
    repairScope !== evidenceScope ? `Check adjacent ${repairScope} material for the same structural symptom.` : undefined,
    'Re-read the affected material for continuity, voice, and unintended downstream changes.',
  ]);
  const safeguards = unique([
    item.mistakeProofing || item.diagnostic?.mistakeProofing,
    'Preserve established facts, point of view, and voice unless the recommendation explicitly requires a controlled change.',
  ]);
  const illustrativeText = normalize(item.strategyCardViewModel?.illustrativeExamples?.[0]?.text);

  return {
    opportunityId: item.id,
    cardType: 'revision_strategy',
    trustedPathStatus: 'unavailable_author_review_required',
    severity: item.severity,
    criterion: item.criterion,
    recommendedStrategy:
      recommendedStrategy || 'Review the evidence and complete the repair at the smallest defensible narrative scope.',
    whyDirectCopyPasteUnsafe:
      normalize(scaffold?.reasonCopyPasteIsUnsafe || item.executabilityReasons?.join('; ')) ||
      'This repair requires author review across more context than a bounded replacement can safely change.',
    evidenceAnchor: normalize(scaffold?.evidenceAnchor || sourceTextOf(item)) || 'No exact passage is available.',
    implementationSequence,
    authorDecisionRequired:
      normalize(scaffold?.authorDecisionRequired) ||
      `Decide whether the repair should remain at the ${evidenceScope} level or extend to the ${repairScope} level.`,
    safeguards: safeguards.length ? safeguards : undefined,
    illustrativeExample: illustrativeText
      ? { text: illustrativeText, disclaimer: ILLUSTRATIVE_DISCLAIMER }
      : undefined,
  };
}

function toWithheldCard(item: WorkbenchOpportunity): WithheldCardViewModel {
  const reasons = [
    ...(item.executabilityReasons ?? []),
    ...(item.preflightReasons ?? []),
    ...(item.resBlockerReasons ?? []),
  ].map(normalize).filter(Boolean);

  return {
    opportunityId: item.id,
    cardType: 'withheld',
    trustedPathStatus: 'impossible',
    severity: item.severity,
    criterion: item.criterion,
    title: item.title,
    holdReason: reasons.join('; ') || 'RevisionGrade could not verify a safe revision path for this opportunity.',
    missingContext: reasons.length ? reasons : undefined,
    recoveryAction: 'Request re-analysis after the missing grounding or context is available.',
    evidenceAnchor: sourceTextOf(item) || undefined,
  };
}

export function adaptWorkbenchOpportunityToCard(item: WorkbenchOpportunity): WorkbenchCardViewModel {
  switch (item.cardType) {
    case 'copy_paste_rewrite':
      return toCopyPasteCard(item);
    case 'revision_strategy':
      return toStrategyCard(item);
    case 'withheld':
    default:
      return toWithheldCard(item);
  }
}
