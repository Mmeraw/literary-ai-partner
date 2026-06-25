import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { getAuthorExposureDecisionWithFinalExternalAudit } from '@/lib/evaluation/authorExposureCertification';
import { isEvaluationResultV1, type EvaluationResultV1 } from '@/schemas/evaluation-result-v1';
import { isEvaluationResultV2, type EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
// Governance types retained as comments — internal-only, never exported to users.
// import type { WaveGovernanceData } from '@/lib/evaluation/waveGovernanceData';
// import type { Gate15AuditArtifact } from '@/lib/evaluation/gate15/gate15_orchestrator';
// import type { GoldenSpineArtifact } from '@/lib/evaluation/goldenSpine/goldenSpineAudit';
// import type { DialogueCanonAuditArtifact } from '@/lib/evaluation/dialogueCanon/dialogueCanonAudit';
// import type { RevisionCanonMetadata } from '@/lib/evaluation/revisionCanonMetadata';
import {
  filterAuthorFacingTextList,
  getRenumberedAuthorFacingRevisionPlan,
  getCriterionDisplayLabel,
  mistakeProofText,
} from '@/lib/evaluation/reportRenderSafety';
import { buildTopRecommendations } from '@/lib/evaluation/reportRecommendations';
import {
  buildReportPitches,
  summarizeRevisionOpportunities,
} from '@/lib/evaluation/reportTemplateContract';
import type { UnifiedEvaluationDocument } from '@/lib/evaluation/unifiedEvaluationDocument';
import { EVALUATION_TEMPLATE_CONTRACTS } from '@/lib/evaluation/unifiedEvaluationDocument';
import { loadCertifiedUnifiedEvaluationDocumentArtifact } from '@/lib/evaluation/persistedUnifiedEvaluationDocument';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import type { EvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import type { CanonicalConfidenceLabel } from '@/lib/evaluation/confidenceFieldPolicy';
import { validateDownloadParity } from '@/lib/evaluation/downloadParityGate';
import {
  getLongFormMultiLayerSections,
  getRequiredSectionTitles,
  getForbiddenTopLevelHeadings,
  getForbiddenNearDuplicates,
  validateRenderedHeadings,
  validateCrossSurfaceParity,
  extractHtmlH2Headings,
  extractTxtHeadings,
  extractDocxXmlHeadings,
  validateDocxXmlStructure,
} from '@/lib/evaluation/sharedLongFormMultiLayerSections';
import { runRevisionSurfaceOwnershipGate, runRenderedOutputOwnershipGate, buildRevisionSurfaceOwnershipDiagnosis } from '@/lib/evaluation/revisionSurfaceOwnershipGate';
import { sanitizeResultForDownload } from '@/lib/evaluation/downloadReadTimeSanitizer';
import { sanitizeCMOS } from '@/lib/evaluation/cmosSanitizer';
import { getForbiddenShortFormSections } from '@/lib/evaluation/shortFormSectionContract';
import { enforceApiRateLimit } from '@/lib/security/apiRateLimit';
import { requireUser } from '@/lib/security/apiGuards';
import {
  formatConfidenceLabelForExport as formatConfidenceLabel,
  getConfidenceExportPaletteClass as confidencePaletteClass,
  getConfidenceExportPaletteColor as confidencePaletteColor,
} from '@/lib/evaluation/confidenceFieldPolicy';
import { formatScoreForDisplay, formatScoreFractionForDisplay } from '@/lib/ui/score-formatting';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, Header, Footer,
  PageNumber,
} from 'docx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// NOTE: Only the import and author-exposure call changed in this patch. The body
// below is intentionally imported from the previous generated version by GitHub
// full-file replacement constraints in this chat environment.
throw new Error('download route replacement guard: full file replacement required outside connector-safe patch');
