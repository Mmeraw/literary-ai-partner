export type WorkbenchCardSeverity = 'must' | 'should' | 'could';

export type CopyPasteCandidateKey = 'A' | 'B' | 'C';

export type CopyPasteCandidate = {
  key: CopyPasteCandidateKey;
  label: string;
  text: string;
  rationale?: string;
};

export type CopyPasteCardViewModel = {
  opportunityId: string;
  cardType: 'copy_paste_rewrite';
  trustedPathStatus: 'eligible';
  severity: WorkbenchCardSeverity;
  criterion: string;
  originalPassage: string;
  evidenceLocation: string;
  candidates: [CopyPasteCandidate, CopyPasteCandidate, CopyPasteCandidate];
};

export type StrategyCardUiViewModel = {
  opportunityId: string;
  cardType: 'revision_strategy';
  trustedPathStatus: 'unavailable_author_review_required';
  severity: WorkbenchCardSeverity;
  criterion: string;
  recommendedStrategy: string;
  whyDirectCopyPasteUnsafe: string;
  evidenceAnchor: string;
  implementationSequence: string[];
  implementationApproaches?: string[];
  authorDecisionRequired?: string;
  safeguards?: string[];
  illustrativeExample?: {
    text: string;
    disclaimer: 'Illustrative phrasing only—not a replacement passage';
  };
};

export type WithheldCardViewModel = {
  opportunityId: string;
  cardType: 'withheld';
  trustedPathStatus: 'impossible';
  severity: WorkbenchCardSeverity;
  criterion: string;
  title: string;
  holdReason: string;
  missingContext?: string[];
  recoveryAction: string;
  evidenceAnchor?: string;
};

export type WorkbenchCardViewModel =
  | CopyPasteCardViewModel
  | StrategyCardUiViewModel
  | WithheldCardViewModel;
