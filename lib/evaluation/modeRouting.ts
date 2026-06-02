export const MICRO_EXCERPT_MIN_WORDS = 200;
export const MICRO_EXCERPT_MAX_WORDS = 999;
export const SHORT_EXCERPT_MAX_WORDS = 3_999;
export const SHORT_FORM_PATTERN_MAX_WORDS = 7_000;
export const FULL_SHORT_FORM_MAX_WORDS = 24_999;
export const LONG_FORM_MIN_WORDS = 25_000;

export type EvaluationMode =
  | 'micro_excerpt_diagnostic'
  | 'short_excerpt_evaluation'
  | 'short_form_pattern_read'
  | 'full_short_form_evaluation'
  | 'long_form_evaluation';

export type CriterionEvidenceStatus =
  | 'evaluable'
  | 'insufficient_evidence'
  | 'not_applicable'
  | 'not_targetable';

export type ModeRoutingDecision = {
  wordCount: number;
  evaluationMode: EvaluationMode;
  isShortForm: boolean;
  isLongForm: boolean;
  requiresUserFacingReviewGate: boolean;
  requiresAcceptedStoryLedger: boolean;
  pass3aBlocking: boolean;
  storyLedgerAuthority: 'disabled' | 'diagnostic_only' | 'advisory_internal' | 'governed';
  reportLabel: string;
  reportTarget: string;
};

export function resolveEvaluationMode(wordCount: number): EvaluationMode {
  if (!Number.isFinite(wordCount) || wordCount < MICRO_EXCERPT_MIN_WORDS) {
    throw new Error('SUBMISSION_TOO_SHORT_FOR_EVALUATION');
  }

  if (wordCount <= MICRO_EXCERPT_MAX_WORDS) return 'micro_excerpt_diagnostic';
  if (wordCount <= SHORT_EXCERPT_MAX_WORDS) return 'short_excerpt_evaluation';
  if (wordCount <= SHORT_FORM_PATTERN_MAX_WORDS) return 'short_form_pattern_read';
  if (wordCount <= FULL_SHORT_FORM_MAX_WORDS) return 'full_short_form_evaluation';
  return 'long_form_evaluation';
}

export function resolveModeRouting(wordCount: number): ModeRoutingDecision {
  const evaluationMode = resolveEvaluationMode(wordCount);
  const isLongForm = evaluationMode === 'long_form_evaluation';

  switch (evaluationMode) {
    case 'micro_excerpt_diagnostic':
      return {
        wordCount,
        evaluationMode,
        isShortForm: true,
        isLongForm: false,
        requiresUserFacingReviewGate: false,
        requiresAcceptedStoryLedger: false,
        pass3aBlocking: false,
        storyLedgerAuthority: 'disabled',
        reportLabel: 'Micro-Diagnostic',
        reportTarget: 'Prose / Voice Diagnostic Report',
      };
    case 'short_excerpt_evaluation':
      return {
        wordCount,
        evaluationMode,
        isShortForm: true,
        isLongForm: false,
        requiresUserFacingReviewGate: false,
        requiresAcceptedStoryLedger: false,
        pass3aBlocking: false,
        storyLedgerAuthority: 'diagnostic_only',
        reportLabel: 'Short Excerpt Evaluation',
        reportTarget: 'Short-form diagnostic with N/A where evidence is unavailable',
      };
    case 'short_form_pattern_read':
      return {
        wordCount,
        evaluationMode,
        isShortForm: true,
        isLongForm: false,
        requiresUserFacingReviewGate: false,
        requiresAcceptedStoryLedger: false,
        pass3aBlocking: false,
        storyLedgerAuthority: 'advisory_internal',
        reportLabel: 'Short-Form Pattern Read',
        reportTarget: '13-criteria short-form report with internal advisory Story Layer',
      };
    case 'full_short_form_evaluation':
      return {
        wordCount,
        evaluationMode,
        isShortForm: true,
        isLongForm: false,
        requiresUserFacingReviewGate: false,
        requiresAcceptedStoryLedger: false,
        pass3aBlocking: false,
        storyLedgerAuthority: 'advisory_internal',
        reportLabel: 'Full Short-Form Evaluation',
        reportTarget: 'Full 13-criteria short-form evaluation; long-form gates disabled',
      };
    case 'long_form_evaluation':
    default:
      return {
        wordCount,
        evaluationMode,
        isShortForm: false,
        isLongForm,
        requiresUserFacingReviewGate: true,
        requiresAcceptedStoryLedger: true,
        pass3aBlocking: true,
        storyLedgerAuthority: 'governed',
        reportLabel: 'Long-Form Evaluation',
        reportTarget: 'Full manuscript governance, Story Ledger, Review Gate, and long-form continuity checks',
      };
  }
}

export function shouldBypassUserFacingReviewGate(wordCount: number): boolean {
  return !resolveModeRouting(wordCount).requiresUserFacingReviewGate;
}

export function sparseEvidenceIsNotFailure(wordCount: number): boolean {
  return resolveModeRouting(wordCount).isShortForm;
}
