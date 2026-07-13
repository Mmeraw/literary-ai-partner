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

function toStrategyCard(item: WorkbenchOpportunity): StrategyCardUiViewModel {
  const scaffold = item.strategyCardViewModel?.scaffold;
  const approaches = [
    normalize(scaffold?.conservativeApproach),
    normalize(scaffold?.moderateApproach),
    normalize(scaffold?.boldApproach),
  ].filter(Boolean);
  const safeguards = [normalize(item.mistakeProofing || item.diagnostic?.mistakeProofing)].filter(Boolean);
  const illustrativeText = normalize(item.strategyCardViewModel?.illustrativeExamples?.[0]?.text);

  return {
    opportunityId: item.id,
    cardType: 'revision_strategy',
    trustedPathStatus: 'unavailable_author_review_required',
    severity: item.severity,
    criterion: item.criterion,
    recommendedStrategy: normalize(scaffold?.moderateApproach || item.fixDirection || item.diagnostic?.fixStrategy || item.issueStatement),
    whyDirectCopyPasteUnsafe: normalize(scaffold?.reasonCopyPasteIsUnsafe || item.executabilityReasons?.join('; ')) || 'This repair requires author review across more context than a bounded replacement can safely change.',
    evidenceAnchor: normalize(scaffold?.evidenceAnchor || sourceTextOf(item)) || 'No exact passage is available.',
    implementationSequence: [
      normalize(scaffold?.conservativeApproach),
      normalize(scaffold?.moderateApproach),
      normalize(scaffold?.boldApproach),
    ].filter(Boolean),
    implementationApproaches: approaches.length > 1 ? approaches : undefined,
    authorDecisionRequired: normalize(scaffold?.authorDecisionRequired) || undefined,
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
