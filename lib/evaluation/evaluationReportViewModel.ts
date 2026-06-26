/**
 * Evaluation Report ViewModel
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THIS IS THE ONE AND ONLY AUTHOR-FACING TEXT SANITIZATION BOUNDARY.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single normalization layer between UnifiedEvaluationDocument and all renderers.
 * Applies all sanitization (mistakeProofText, correctScopeLanguage) and business
 * logic (palette derivation, confidence formatting) once, so renderers only
 * format/display — no business decisions, no re-sanitization.
 *
 * Architecture:
 *   Certified UED → normalizeEvaluationReportViewModel() → ViewModel → renderers
 *
 * Ownership:
 *   Template (Golden Record) → Contract Registry → UED → THIS VM → renderers
 *
 * Renderers (web, PDF, DOCX, TXT) consume this ViewModel and MUST NOT:
 *   - recompute score
 *   - infer genre/audience
 *   - create recommendations
 *   - rename sections
 *   - re-count opportunities from raw criteria
 *   - apply their own sanitization (mistakeProofText, correctScopeLanguage)
 *   - call sanitizeAuthorFacingDisplayValue on VM-owned fields
 *   - render shadow inventories (actionItems, quickWins, strategicRevisions)
 *
 * The Revise Queue is a SEPARATE product surface consuming
 * revision_opportunity_ledger_v1 directly. It does NOT go through this VM.
 * The report page may LINK to Revise but must not render Revise Queue contents.
 *
 * Enforced by: __tests__/lib/evaluation/viewModelBoundaryGate.test.ts
 */

import type { UnifiedEvaluationDocument, CanonicalEvaluationMode } from '@/lib/evaluation/unifiedEvaluationDocument';
import { correctScopeLanguage, mistakeProofText, getRenumberedAuthorFacingRevisionPlan, filterAuthorFacingTextList } from '@/lib/evaluation/reportRenderSafety';
import type { EvaluationContract } from '@/lib/evaluation/contracts/evaluationContractRegistry';
import { getEvaluationContract } from '@/lib/evaluation/contracts/evaluationContractRegistry';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { classifyEvaluationIntegrityBanner } from '@/lib/evaluation/warningClassification';
import type { EvaluationIntegrityBanner } from '@/lib/evaluation/warningClassification';

// ────────────────────────────────────────────────────────────────────────────
// ViewModel Types
// ────────────────────────────────────────────────────────────────────────────

export type ScorePalette = 'strong' | 'watch' | 'risk' | 'muted';
export type ReadinessPalette = 'ready' | 'near' | 'not_ready' | 'unknown';

export type TitleBlockViewModel = {
  displayTitle: string;
  reportType: string;
  templateMode: CanonicalEvaluationMode;
  dateGenerated: string;
  overallScoreLabel: string;
  overallScoreConfidenceLabel: string | null;
  overallScorePalette: ScorePalette;
  marketReadiness: string;
  marketReadinessConfidenceLabel: string | null;
  marketReadinessPalette: ReadinessPalette;
  genre: string;
  genreConfidenceLabel: string | null;
  targetAudience: string;
  audienceConfidenceLabel: string;
  audienceTentative: boolean;
  shelf: string | null;
  shelfConfidenceLabel: string | null;
  submittedWordCount: string;
  estimatedPages: string;
  readingGradeLevel: string;
  dialogueNarrativeRatio: string;
  genreExpectationSummary: string | null;
  genreExpectationProfileLabels: string[];
};

export type RevisionOpportunitySummaryViewModel = {
  total: number;
  recommended: number;
  optional: number;
  consider: number;
};

export type CriterionGridRowViewModel = {
  label: string;
  scoreLabel: string;
  scorePalette: ScorePalette;
  confidenceLabel: string | null;
};

export type CriterionDetailViewModel = {
  key: string;
  label: string;
  scoreLabel: string;
  scorePalette: ScorePalette;
  confidenceLabel: string | null;
  supportLabel: string | null;
  rationaleLabel: string | undefined;
  rationaleText: string;
  recommendations: Array<{
    opportunity_id: string | undefined;
    priority: string | undefined;
    anchor_snippet: string | undefined;
    anchor_type: string | undefined;
    symptom: string | undefined;
    mechanism: string | undefined;
    specific_fix: string | undefined;
    reader_effect: string | undefined;
    mistake_proofing: string | undefined;
    collapsed_from_criteria: string[] | undefined;
  }>;
};

// ────────────────────────────────────────────────────────────────────────────
// Long-Form Multi-Layer Evaluation ViewModel
// ────────────────────────────────────────────────────────────────────────────
// Proper renderer contract — renderers never see LongformDreamDocument.
// All fields are camelCase, pre-sanitized, and author-facing.

export type LongFormMultiLayerScoresViewModel = {
  quality: number | null;
  readiness: number | null;
  commercial: number | null;
  literary: number | null;
};

export type LongFormMultiLayerMarketShelfViewModel = {
  bestShelf: string | null;
  shelfNeighbors: string[];
  comparisonSpace: string[];
  marketableHook: string | null;
  marketDanger: string | null;
};

export type LongFormMultiLayerStructuralLayerViewModel = {
  layerName: string;
  function: string;
  status: string;
  revisionNote: string;
};

export type LongFormMultiLayerArcEntryViewModel = {
  actName: string;
  chapterRange: string;
  primaryFunction: string;
  revisionPriority: string;
};

export type LongFormMultiLayerCriterionAnalysisViewModel = {
  key: string;
  score: number;
  confidence: string;
  fitEvidence: string[];
  gapEvidence: string[];
  revisionQueue: string[];
};

export type LongFormMultiLayerLayerAnalysisViewModel = {
  layerName: string;
  status: string;
  neededRevision: string;
};

export type LongFormMultiLayerCrossLayerEntryViewModel = {
  motif: string;
  description: string;
  integrationQuality: string;
  revisionNote: string;
};

export type LongFormMultiLayerSymbolicAuditViewModel = {
  preservedSymbols: Array<{
    symbol: string;
    currentFunction: string;
    revisionInstruction: string;
  }>;
  doctrineStrengths: string[];
  doctrineRisks: string[];
  auditConclusion: string;
};

export type LongFormMultiLayerReaderExperienceActViewModel = {
  readerQuestion: string;
  emotionalState: string;
  risk: string;
};

export type LongFormMultiLayerReaderExperienceViewModel = {
  firstAct: LongFormMultiLayerReaderExperienceActViewModel | null;
  middle: LongFormMultiLayerReaderExperienceActViewModel | null;
  finalAct: LongFormMultiLayerReaderExperienceActViewModel | null;
  aftertaste: string;
};

export type LongFormMultiLayerRevisionPlanItemViewModel = {
  displayPriority: number;
  title: string;
  goal: string;
  actions: string[];
  acceptanceCheck: string;
};

export type LongFormMultiLayerReleasabilityViewModel = {
  dimension: string;
  currentStatus: string;
  verdict: string;
};

export type LongFormMultiLayerAcceptanceChecksViewModel = {
  requiredDetection: string[];
  failureConditions: string[];
};

export type LongFormMultiLayerRepoSummaryViewModel = {
  benchmarkName: string;
  source: string;
  evaluationType: string;
  overallScore: number;
  readinessScore: number;
  primaryStrengths: string[];
  primaryBlockers: string[];
  goldStandardRequirement: string;
};

export type LongFormMultiLayerIntegrityIssueViewModel = {
  kind: string;
  description: string;
  severity: string;
};

export type LongFormMultiLayerEvaluationViewModel = {
  executiveVerdict: string;
  scores: LongFormMultiLayerScoresViewModel;
  marketShelf: LongFormMultiLayerMarketShelfViewModel;
  whatNotToBecome: string[];
  structuralStack: LongFormMultiLayerStructuralLayerViewModel[];
  arcMap: LongFormMultiLayerArcEntryViewModel[];
  criterionAnalyses: LongFormMultiLayerCriterionAnalysisViewModel[];
  layerAnalyses: LongFormMultiLayerLayerAnalysisViewModel[];
  crossLayerIntegration: LongFormMultiLayerCrossLayerEntryViewModel[];
  symbolicAudit: LongFormMultiLayerSymbolicAuditViewModel | null;
  readerExperience: LongFormMultiLayerReaderExperienceViewModel | null;
  revisionPlan: LongFormMultiLayerRevisionPlanItemViewModel[];
  releasability: LongFormMultiLayerReleasabilityViewModel[];
  acceptanceChecks: LongFormMultiLayerAcceptanceChecksViewModel | null;
  calibrationNotes: string[];
  repoSummary: LongFormMultiLayerRepoSummaryViewModel | null;
  manuscriptIntegrityIssues: LongFormMultiLayerIntegrityIssueViewModel[];
};

export type GovernanceWarningInput = {
  governance?: {
    confidence_label?: 'high' | 'medium' | 'low' | 'withheld';
    warnings?: string[];
    transparency?: {
      artifact_validation_result?: 'PASS' | 'HOLD' | 'FAIL';
      propagation_summary?: {
        upstream_integrity?: 'strong' | 'mixed' | 'weak';
        authority_level?: 'normal' | 'constrained' | 'blocked';
      };
      [key: string]: unknown;
    };
  };
};

export type EvaluationReportViewModel = {
  // Identity
  templateMode: CanonicalEvaluationMode;
  contractStatus: EvaluationContract['implementationStatus'];

  // Title Block
  titleBlock: TitleBlockViewModel;

  // Pitches + Premise + Warnings
  oneParagraphPitch: string;
  oneSentencePitch: string;
  premise: string | null;
  contentWarnings: string[];

  // Revision Opportunity Summary
  revisionOpportunitySummary: RevisionOpportunitySummaryViewModel;

  // Executive Synthesis
  executiveSummary: string;
  topStrengths: string[];
  topRisks: string[];
  topRecommendations: string[];

  // Criteria
  criteriaScoreGrid: CriterionGridRowViewModel[];
  criterionDetails: CriterionDetailViewModel[];

  // Confidence explanation
  confidenceExplanation: string;

  // Mode-specific (long-form / multi-layer)
  modeSpecific: {
    manuscriptScaleContinuityFindings: string[];
    storyLedgerArchitectureMap: string[];
    reviewGateReadinessSurface: string[];
    governedLedgerAddenda: string[];
    revisionPriorityPlan: Array<{
      priority: number;
      title: string;
      location: string;
      operation: string;
      recommendation: string;
      rationale: string;
    }>;
    crossLayerSynthesis: string[];
    layerAwareRevisionSequencing: string[];
    continuityCoverageProof: string[];
    readinessReleasabilityPosture: string;
  };

  // Long-Form Multi-Layer Evaluation (DREAM projection — renderer contract)
  longFormMultiLayerEvaluation: LongFormMultiLayerEvaluationViewModel | null;

  // Integrity banner (governance projection)
  integrityBanner: EvaluationIntegrityBanner | null;

  // Disclaimer
  disclaimer: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────────────

const DISCLAIMER =
  'Generated by RevisionGrade\u2122. Author retains ownership of manuscript content. This report is an editorial diagnostic and does not guarantee publication, representation, or commercial outcome.';

function deriveScorePalette(scoreLabel: string): ScorePalette {
  const match = scoreLabel.match(/(\d+(?:\.\d+)?)\s*\/\s*(100|10)/);
  if (!match) return 'muted';
  const score = Number(match[1]);
  const denom = Number(match[2]);
  if (denom === 100) {
    if (score >= 90) return 'strong';
    if (score >= 80) return 'watch';
    return 'risk';
  }
  if (score >= 8) return 'strong';
  if (score >= 6) return 'watch';
  return 'risk';
}

function deriveReadinessPalette(readiness: string): ReadinessPalette {
  const lower = readiness.trim().toLowerCase();
  if (lower.startsWith('market ready')) return 'ready';
  if (lower.startsWith('near market ready')) return 'near';
  if (lower.startsWith('not market ready')) return 'not_ready';
  return 'unknown';
}

function sanitizeText(text: string, isLongForm: boolean): string {
  return correctScopeLanguage(mistakeProofText(text), isLongForm);
}

function sanitizeList(items: string[], isLongForm: boolean): string[] {
  return items.map(item => sanitizeText(item, isLongForm));
}

/**
 * Normalize a UnifiedEvaluationDocument into a renderer-ready ViewModel.
 *
 * All business logic is applied here. Renderers receive pre-computed values
 * and must not reinterpret, recalculate, or independently derive content.
 *
 * The webpage and download route should both call this once, then render
 * vm.* fields directly with no additional correction layers.
 */
export function normalizeEvaluationReportViewModel({
  ued,
  dreamDoc,
  governance,
}: {
  ued: UnifiedEvaluationDocument;
  dreamDoc?: LongformDreamDocument | null;
  governance?: GovernanceWarningInput;
}): EvaluationReportViewModel {
  const mode = ued.templateMode;
  const contract = getEvaluationContract(mode);
  const isLongForm = mode !== 'short_form_evaluation';

  const titleBlock: TitleBlockViewModel = {
    displayTitle: ued.title,
    reportType: ued.titleBlock.reportType,
    templateMode: mode,
    dateGenerated: ued.titleBlock.dateGenerated,
    overallScoreLabel: ued.titleBlock.overallScoreLabel,
    overallScoreConfidenceLabel: ued.titleBlock.overallScoreConfidenceLabel ?? null,
    overallScorePalette: deriveScorePalette(ued.titleBlock.overallScoreLabel),
    marketReadiness: ued.titleBlock.marketReadiness,
    marketReadinessConfidenceLabel: ued.titleBlock.marketReadinessConfidenceLabel ?? null,
    marketReadinessPalette: deriveReadinessPalette(ued.titleBlock.marketReadiness),
    genre: ued.titleBlock.genre,
    genreConfidenceLabel: ued.titleBlock.genreConfidenceLabel ?? null,
    targetAudience: ued.titleBlock.targetAudience,
    audienceConfidenceLabel: ued.titleBlock.audienceConfidenceLabel,
    audienceTentative: ued.titleBlock.audienceTentative,
    shelf: ued.titleBlock.shelf ?? null,
    shelfConfidenceLabel: ued.titleBlock.shelfConfidenceLabel ?? null,
    submittedWordCount: ued.titleBlock.submittedWordCount,
    estimatedPages: ued.titleBlock.estimatedPages,
    readingGradeLevel: ued.titleBlock.readingGradeLevel,
    dialogueNarrativeRatio: ued.titleBlock.dialogueNarrativeRatio,
    genreExpectationSummary: ued.titleBlock.genreExpectationContract?.contractSummary ?? null,
    genreExpectationProfileLabels: ued.titleBlock.genreExpectationContract?.expectationProfileLabels ?? [],
  };

  const revisionOpportunitySummary: RevisionOpportunitySummaryViewModel = {
    total: ued.revisionOpportunitySummary.total,
    recommended: ued.revisionOpportunitySummary.high,
    optional: ued.revisionOpportunitySummary.medium,
    consider: ued.revisionOpportunitySummary.low,
  };

  const criteriaScoreGrid: CriterionGridRowViewModel[] = ued.criteriaScoreGrid.map(row => ({
    label: row.label,
    scoreLabel: row.scoreLabel,
    scorePalette: deriveScorePalette(row.scoreLabel),
    confidenceLabel: row.confidenceLabel ?? null,
  }));

  const criterionDetails: CriterionDetailViewModel[] = ued.criterionDetails.map(detail => ({
    key: detail.key,
    label: detail.label,
    scoreLabel: detail.scoreLabel,
    scorePalette: deriveScorePalette(detail.scoreLabel),
    confidenceLabel: detail.confidenceLabel ?? null,
    supportLabel: detail.supportLabel ? sanitizeText(detail.supportLabel, isLongForm) : null,
    rationaleLabel: detail.rationaleLabel,
    rationaleText: sanitizeText(detail.rationaleText, isLongForm),
    recommendations: (detail.recommendations ?? []).map(rec => ({
      opportunity_id: rec.opportunity_id,
      priority: rec.priority,
      anchor_snippet: rec.anchor_snippet ? sanitizeText(rec.anchor_snippet, isLongForm) : undefined,
      anchor_type: rec.anchor_type,
      symptom: rec.symptom ? sanitizeText(rec.symptom, isLongForm) : undefined,
      mechanism: rec.mechanism ? sanitizeText(rec.mechanism, isLongForm) : undefined,
      specific_fix: rec.specific_fix ? sanitizeText(rec.specific_fix, isLongForm) : undefined,
      reader_effect: rec.reader_effect ? sanitizeText(rec.reader_effect, isLongForm) : undefined,
      mistake_proofing: rec.mistake_proofing ? sanitizeText(rec.mistake_proofing, isLongForm) : undefined,
      collapsed_from_criteria: rec.collapsed_from_criteria,
    })),
  }));

  const confidenceExplanation = sanitizeText(
    ued.confidenceExplanation,
    isLongForm,
  );

  return {
    templateMode: mode,
    contractStatus: contract.implementationStatus,

    titleBlock,

    oneParagraphPitch: sanitizeText(ued.oneParagraphPitch, isLongForm),
    oneSentencePitch: sanitizeText(ued.oneSentencePitch, isLongForm),
    premise: ued.premise ? sanitizeText(ued.premise, isLongForm) : null,
    contentWarnings: sanitizeList(ued.contentWarnings, isLongForm),

    revisionOpportunitySummary,

    executiveSummary: sanitizeText(ued.executiveSummary, isLongForm),
    topStrengths: sanitizeList(ued.topStrengths, isLongForm),
    topRisks: sanitizeList(ued.topRisks, isLongForm),
    topRecommendations: sanitizeList(ued.topRecommendations, isLongForm),

    criteriaScoreGrid,
    criterionDetails,

    confidenceExplanation,

    modeSpecific: ued.modeSpecific ? {
      manuscriptScaleContinuityFindings: sanitizeList(ued.modeSpecific.manuscriptScaleContinuityFindings, isLongForm),
      storyLedgerArchitectureMap: sanitizeList(ued.modeSpecific.storyLedgerArchitectureMap, isLongForm),
      reviewGateReadinessSurface: sanitizeList(ued.modeSpecific.reviewGateReadinessSurface, isLongForm),
      governedLedgerAddenda: sanitizeList(ued.modeSpecific.governedLedgerAddenda, isLongForm),
      revisionPriorityPlan: ued.modeSpecific.revisionPriorityPlan,
      crossLayerSynthesis: sanitizeList(ued.modeSpecific.crossLayerSynthesis, isLongForm),
      layerAwareRevisionSequencing: sanitizeList(ued.modeSpecific.layerAwareRevisionSequencing, isLongForm),
      continuityCoverageProof: sanitizeList(ued.modeSpecific.continuityCoverageProof, isLongForm),
      readinessReleasabilityPosture: sanitizeText(ued.modeSpecific.readinessReleasabilityPosture, isLongForm),
    } : undefined,

    longFormMultiLayerEvaluation: normalizeLongFormMultiLayer(dreamDoc ?? null, isLongForm),
    integrityBanner: governance ? classifyEvaluationIntegrityBanner(governance) : null,

    disclaimer: DISCLAIMER,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Long-Form Multi-Layer Evaluation normalization
// ────────────────────────────────────────────────────────────────────────────
// Transforms internal LongformDreamDocument into renderer-facing
// LongFormMultiLayerEvaluationViewModel. All sanitization applied here;
// renderers receive pre-computed values only.

function normalizeLongFormMultiLayer(
  doc: LongformDreamDocument | null,
  isLongForm: boolean,
): LongFormMultiLayerEvaluationViewModel | null {
  if (!doc) return null;

  const s = (text: string) => sanitizeText(text, isLongForm);
  const sl = (items: string[]) => sanitizeList(items, isLongForm);

  const scores: LongFormMultiLayerScoresViewModel = {
    quality: doc.dream_scores?.quality ?? null,
    readiness: doc.dream_scores?.readiness ?? null,
    commercial: doc.dream_scores?.commercial ?? null,
    literary: doc.dream_scores?.literary ?? null,
  };

  const marketShelf: LongFormMultiLayerMarketShelfViewModel = {
    bestShelf: doc.market_shelf?.best_shelf ? s(doc.market_shelf.best_shelf) : null,
    shelfNeighbors: sl(doc.market_shelf?.shelf_neighbors ?? []),
    comparisonSpace: sl(doc.market_shelf?.comparison_space ?? []),
    marketableHook: doc.market_shelf?.marketable_hook ? s(doc.market_shelf.marketable_hook) : null,
    marketDanger: doc.market_shelf?.market_danger ? s(doc.market_shelf.market_danger) : null,
  };

  const structuralStack: LongFormMultiLayerStructuralLayerViewModel[] = (doc.structural_stack ?? []).map(layer => ({
    layerName: s(layer.layer_name),
    function: s(layer.function),
    status: layer.status,
    revisionNote: s(layer.revision_note),
  }));

  const arcMap: LongFormMultiLayerArcEntryViewModel[] = (doc.arc_map ?? []).map(act => ({
    actName: s(act.act_name),
    chapterRange: s(act.chapter_range),
    primaryFunction: s(act.primary_function),
    revisionPriority: s(act.revision_priority),
  }));

  const criterionAnalyses: LongFormMultiLayerCriterionAnalysisViewModel[] = (doc.criterion_analyses ?? []).map(c => ({
    key: c.key,
    score: c.score,
    confidence: c.confidence,
    fitEvidence: sl(c.fit_evidence ?? []),
    gapEvidence: sl(c.gap_evidence ?? []),
    revisionQueue: sl(c.revision_queue ?? []),
  }));

  const layerAnalyses: LongFormMultiLayerLayerAnalysisViewModel[] = (doc.layer_analyses ?? []).map(l => ({
    layerName: s(l.layer_name),
    status: l.status,
    neededRevision: s(l.needed_revision),
  }));

  const crossLayerIntegration: LongFormMultiLayerCrossLayerEntryViewModel[] = (doc.cross_layer_integration ?? []).map(c => ({
    motif: s(c.motif),
    description: s(c.description),
    integrationQuality: c.integration_quality,
    revisionNote: s(c.revision_note),
  }));

  const symbolicAudit: LongFormMultiLayerSymbolicAuditViewModel | null = doc.symbolic_audit ? {
    preservedSymbols: (doc.symbolic_audit.preserved_symbols ?? []).map(ps => ({
      symbol: s(ps.symbol),
      currentFunction: s(ps.current_function),
      revisionInstruction: s(ps.revision_instruction),
    })),
    doctrineStrengths: sl(doc.symbolic_audit.doctrine_strengths ?? []),
    doctrineRisks: sl(doc.symbolic_audit.doctrine_risks ?? []),
    auditConclusion: s(doc.symbolic_audit.audit_conclusion ?? ''),
  } : null;

  const readerExperience: LongFormMultiLayerReaderExperienceViewModel | null = doc.reader_experience ? {
    firstAct: doc.reader_experience.first_act ? {
      readerQuestion: s(doc.reader_experience.first_act.reader_question ?? ''),
      emotionalState: s(doc.reader_experience.first_act.emotional_state ?? ''),
      risk: s(doc.reader_experience.first_act.risk ?? ''),
    } : null,
    middle: doc.reader_experience.middle ? {
      readerQuestion: s(doc.reader_experience.middle.reader_question ?? ''),
      emotionalState: s(doc.reader_experience.middle.emotional_state ?? ''),
      risk: s(doc.reader_experience.middle.risk ?? ''),
    } : null,
    finalAct: doc.reader_experience.final_act ? {
      readerQuestion: s(doc.reader_experience.final_act.reader_question ?? ''),
      emotionalState: s(doc.reader_experience.final_act.emotional_state ?? ''),
      risk: s(doc.reader_experience.final_act.risk ?? ''),
    } : null,
    aftertaste: s(doc.reader_experience.aftertaste ?? ''),
  } : null;

  const revisionPlan: LongFormMultiLayerRevisionPlanItemViewModel[] =
    getRenumberedAuthorFacingRevisionPlan(doc.revision_plan).map(item => ({
      displayPriority: item.displayPriority,
      title: s(item.title),
      goal: s(item.goal),
      actions: sl(item.actions),
      acceptanceCheck: s(item.acceptance_check),
    }));

  const releasability: LongFormMultiLayerReleasabilityViewModel[] = (doc.releasability ?? []).map(dim => ({
    dimension: s(dim.dimension),
    currentStatus: s(dim.current_status),
    verdict: dim.verdict,
  }));

  const acceptanceChecks: LongFormMultiLayerAcceptanceChecksViewModel | null = doc.acceptance_checks ? {
    requiredDetection: filterAuthorFacingTextList(doc.acceptance_checks.required_detection ?? []),
    failureConditions: filterAuthorFacingTextList(doc.acceptance_checks.failure_conditions ?? []),
  } : null;

  const repoSummary: LongFormMultiLayerRepoSummaryViewModel | null = doc.repo_summary ? {
    benchmarkName: s(doc.repo_summary.benchmark_name ?? ''),
    source: s(doc.repo_summary.source ?? ''),
    evaluationType: s(doc.repo_summary.evaluation_type ?? ''),
    overallScore: doc.repo_summary.overall_score ?? 0,
    readinessScore: doc.repo_summary.readiness_score ?? 0,
    primaryStrengths: sl(doc.repo_summary.primary_strengths ?? []),
    primaryBlockers: sl(doc.repo_summary.primary_blockers ?? []),
    goldStandardRequirement: s(doc.repo_summary.gold_standard_requirement ?? ''),
  } : null;

  const manuscriptIntegrityIssues: LongFormMultiLayerIntegrityIssueViewModel[] = (doc.manuscript_integrity_issues ?? []).map(issue => ({
    kind: issue.kind,
    description: s(issue.description),
    severity: issue.severity,
  }));

  return {
    executiveVerdict: s(doc.executive_verdict ?? ''),
    scores,
    marketShelf,
    whatNotToBecome: sl(doc.what_not_to_become ?? []),
    structuralStack,
    arcMap,
    criterionAnalyses,
    layerAnalyses,
    crossLayerIntegration,
    symbolicAudit,
    readerExperience,
    revisionPlan,
    releasability,
    acceptanceChecks,
    calibrationNotes: sl(doc.calibration_notes ?? []),
    repoSummary,
    manuscriptIntegrityIssues,
  };
}
