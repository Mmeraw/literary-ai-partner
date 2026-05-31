import { createHash, randomUUID } from 'crypto';
import { REVISION_OPERATIONS, type RevisionOperation } from './reviseCardContract';

type LedgerSeverity = 'must' | 'should' | 'could';
type LedgerConfidence = 'low' | 'medium' | 'high';

type RevisionOpportunity = {
  opportunity_id: string;
  criterion: string;
  severity: LedgerSeverity;
  rationale: string;
  evidence_anchor: string;
  manuscript_coordinates: string;
  provenance: string;
  confidence: LedgerConfidence;
  decision_state: 'open';
  revision_operation?: RevisionOperation;
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  symptom?: string;
  cause?: string;
  fix_direction?: string;
  reader_effect?: string;
  mistake_proofing?: string;
};

type WorkbenchLikeOpportunity = {
  id?: unknown;
  criterion?: unknown;
  severity?: unknown;
  fixDirection?: unknown;
  symptom?: unknown;
  title?: unknown;
  quoteHighlight?: unknown;
  quoteRest?: unknown;
  anchor?: unknown;
  meta?: unknown;
  source?: unknown;
  confidence?: unknown;
};

type EnsureLedgerResult = {
  artifactId: string | null;
  opportunities: RevisionOpportunity[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceHashFor(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function normalizeSeverity(raw: unknown, scoreOverride?: unknown): LedgerSeverity {
  if (typeof scoreOverride === 'number' && Number.isFinite(scoreOverride)) {
    if (scoreOverride <= 4) return 'must';
    if (scoreOverride <= 7) return 'should';
    return 'could';
  }
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['must', 'high', 'critical', 'major', 'blocker'].includes(normalized)) return 'must';
  if (['could', 'low', 'minor', 'optional'].includes(normalized)) return 'could';
  return 'should';
}

function normalizeConfidence(raw: unknown): LedgerConfidence {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 0.8) return 'high';
    if (raw >= 0.5) return 'medium';
    return 'low';
  }
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['high', 'strong'].includes(normalized)) return 'high';
  if (['low', 'weak'].includes(normalized)) return 'low';
  return 'medium';
}

function normalizeCriterion(raw: unknown): string {
  const criterion = firstNonEmptyString(raw, 'GENERAL');
  return criterion.replace(/\s+/g, '_').toUpperCase();
}

function normalizeOptionalText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = raw.trim();
  return clean.length > 0 ? clean : undefined;
}

function normalizeProseSentence(raw: string): string {
  const clean = raw
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/[.!?\u2026]+$/g, '')
    .trim();

  if (!clean) return '';
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function extractQuotedSpan(raw: string): string {
  if (!raw) return '';
  const matches = [...raw.matchAll(/["\u201c\u201d]([^"\u201c\u201d]{4,220})["\u201c\u201d]/g)]
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean);

  if (matches.length === 0) return '';
  return matches.sort((a, b) => b.length - a.length)[0] ?? '';
}

function extractLeadName(raw: string): string {
  if (!raw) return '';

  const tokens = raw.match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
  const banned = new Set(['Chapter', 'Move', 'Small', 'Fry', 'Why', 'There']);
  for (const token of tokens) {
    if (!banned.has(token)) return token;
  }
  return '';
}

function normalizeActionIntent(raw: string): string {
  if (!raw) return '';
  const clean = raw
    .replace(/^\s*(?:In|At)\s+the\s+[^,]+,\s*/i, '')
    .replace(/^\s*where\s+[^,]+,\s*/i, '')
    .replace(/\b(?:replace|repair|fix|clarify|strengthen|insert|weave|expand)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

function buildFallbackProseSeed(args: {
  criterion: string;
  anchor: string;
  rationale: string;
  action?: string;
  expectedImpact?: string;
  fixDirection?: string;
  symptom?: string;
}): string {
  const quotedAnchor = normalizeProseSentence(extractQuotedSpan(args.anchor));
  if (quotedAnchor) return quotedAnchor;

  const actionQuote = normalizeProseSentence(extractQuotedSpan(args.action ?? ''));
  if (actionQuote) return actionQuote;

  const anchor = normalizeProseSentence(args.anchor);
  if (anchor) return anchor;

  const actionIntent = normalizeProseSentence(normalizeActionIntent(args.action ?? ''));
  if (actionIntent) return actionIntent;

  const symptom = normalizeProseSentence(args.symptom ?? '');
  if (symptom) return symptom;

  const rationale = normalizeProseSentence(args.rationale);
  if (rationale) return rationale;

  const fixDirection = normalizeProseSentence(args.fixDirection ?? '');
  if (fixDirection) return fixDirection;

  const criterionLabel = args.criterion.replace(/_/g, ' ').toLowerCase();
  return `The ${criterionLabel} pressure in this moment is visible on the page.`;
}

function buildFallbackCandidateTexts(input: {
  criterion: string;
  anchor: string;
  rationale: string;
  action?: string;
  expectedImpact?: string;
  fixDirection?: string;
  symptom?: string;
}): { a: string; b: string; c: string } {
  const seed = buildFallbackProseSeed(input);
  const leadName = extractLeadName(`${input.action ?? ''} ${input.anchor ?? ''}`) || 'The moment';
  const impactHint = normalizeActionIntent(input.expectedImpact ?? '');

  const endings = {
    a: `${leadName} answers in motion, and the consequence lands without a pause for explanation.`,
    b: `A physical beat carries the turn, so pressure stays visible and the scene keeps forward momentum.`,
    c: impactHint
      ? `${impactHint.charAt(0).toUpperCase()}${impactHint.slice(1)} The next line makes the cost immediate on the page.`
      : 'The next line makes the cost immediate on the page, and no one in the room can pretend otherwise.',
  };

  return {
    a: `${seed} ${endings.a}`.replace(/\s+/g, ' ').trim(),
    b: `${seed} ${endings.b}`.replace(/\s+/g, ' ').trim(),
    c: `${seed} ${endings.c}`.replace(/\s+/g, ' ').trim(),
  };
}

function normalizeRevisionOperation(raw: unknown): RevisionOperation | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = raw.trim();
  return (REVISION_OPERATIONS as readonly string[]).includes(clean)
    ? (clean as RevisionOperation)
    : undefined;
}

function buildOpportunityId(parts: { criterion: string; rationale: string; anchor: string; location: string }): string {
  const digest = createHash('sha256')
    .update(`${parts.criterion}|${parts.rationale}|${parts.anchor}|${parts.location}`)
    .digest('hex')
    .slice(0, 18);
  return `rol:${digest}`;
}

function normalizeConfidenceFromUnknown(raw: unknown): LedgerConfidence {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('low')) return 'low';
    if (normalized.includes('medium')) return 'medium';
  }
  return normalizeConfidence(raw);
}

function isCanonicalRevisionOpportunity(value: unknown): value is RevisionOpportunity {
  if (!isRecord(value)) return false;
  const revisionOperation = value.revision_operation;
  const candidateTextA = value.candidate_text_a;
  const candidateTextB = value.candidate_text_b;
  const candidateTextC = value.candidate_text_c;
  return (
    typeof value.opportunity_id === 'string' && value.opportunity_id.trim().length > 0 &&
    typeof value.criterion === 'string' && value.criterion.trim().length > 0 &&
    typeof value.severity === 'string' && ['must', 'should', 'could'].includes(value.severity) &&
    typeof value.rationale === 'string' && value.rationale.trim().length > 0 &&
    typeof value.evidence_anchor === 'string' && value.evidence_anchor.trim().length > 0 &&
    typeof value.manuscript_coordinates === 'string' && value.manuscript_coordinates.trim().length > 0 &&
    typeof value.provenance === 'string' && value.provenance.trim().length > 0 &&
    typeof value.confidence === 'string' && ['low', 'medium', 'high'].includes(value.confidence) &&
    value.decision_state === 'open' &&
    (revisionOperation === undefined || normalizeRevisionOperation(revisionOperation) !== undefined) &&
    (candidateTextA === undefined || typeof candidateTextA === 'string') &&
    (candidateTextB === undefined || typeof candidateTextB === 'string') &&
    (candidateTextC === undefined || typeof candidateTextC === 'string')
  );
}

function normalizeLegacyWorkbenchOpportunity(value: unknown): RevisionOpportunity | null {
  if (!isRecord(value)) return null;
  const workbench = value as WorkbenchLikeOpportunity;

  const criterion = normalizeCriterion(workbench.criterion);
  const rationale = firstNonEmptyString(workbench.fixDirection, workbench.symptom, workbench.title);
  const quoteHighlight = firstNonEmptyString(workbench.quoteHighlight);
  const quoteRest = firstNonEmptyString(workbench.quoteRest);
  const evidenceAnchor = firstNonEmptyString(
    `${quoteHighlight}${quoteRest}`.trim(),
    quoteHighlight,
    workbench.symptom,
    workbench.title,
  );
  const manuscriptCoordinates = firstNonEmptyString(workbench.anchor, workbench.meta, `${criterion}:recommendation`);
  const provenance = firstNonEmptyString(workbench.source, 'workbench_queue_synthesis');

  if (!rationale || !evidenceAnchor || !manuscriptCoordinates) {
    return null;
  }

  const opportunityId = firstNonEmptyString(
    workbench.id,
    buildOpportunityId({ criterion, rationale, anchor: evidenceAnchor, location: manuscriptCoordinates }),
  );

  return {
    opportunity_id: opportunityId,
    criterion,
    severity: normalizeSeverity(workbench.severity),
    rationale,
    evidence_anchor: evidenceAnchor,
    manuscript_coordinates: manuscriptCoordinates,
    provenance,
    confidence: normalizeConfidenceFromUnknown(workbench.confidence),
    decision_state: 'open',
  };
}

function normalizeExistingLedgerOpportunities(raw: unknown): RevisionOpportunity[] | null {
  if (!Array.isArray(raw)) return null;

  const canonical: RevisionOpportunity[] = [];
  for (const row of raw) {
    if (isCanonicalRevisionOpportunity(row)) {
      canonical.push(row);
      continue;
    }
    const normalized = normalizeLegacyWorkbenchOpportunity(row);
    if (!normalized) {
      return null;
    }
    canonical.push(normalized);
  }

  return canonical;
}

function extractCriteriaRecommendations(payload: Record<string, unknown>): RevisionOpportunity[] {
  const opportunities: RevisionOpportunity[] = [];
  const criteria = Array.isArray(payload.criteria) ? payload.criteria : [];

  for (const criterionRow of criteria) {
    if (!isRecord(criterionRow)) continue;

    const criterion = normalizeCriterion(criterionRow.key ?? criterionRow.criterion_key);
    const criterionScore = criterionRow.score_0_10;
    const criterionEvidenceRaw = Array.isArray(criterionRow.evidence) ? criterionRow.evidence[0] : null;
    const criterionEvidenceSnippet = isRecord(criterionEvidenceRaw)
      ? firstNonEmptyString(
          criterionEvidenceRaw.snippet,
          criterionEvidenceRaw.text,
        )
      : '';

    const recommendations = Array.isArray(criterionRow.recommendations)
      ? criterionRow.recommendations
      : [];

    for (const recommendationRow of recommendations) {
      if (!isRecord(recommendationRow)) continue;

      const evidenceAnchor = firstNonEmptyString(
        recommendationRow.evidence_anchor,
        recommendationRow.anchor_snippet,
        recommendationRow.evidence_snippet,
        recommendationRow.snippet,
        recommendationRow.quote,
        criterionEvidenceSnippet,
      );

      if (!evidenceAnchor) {
        continue;
      }

      const rationale = firstNonEmptyString(
        recommendationRow.rationale,
        recommendationRow.diagnosis,
        recommendationRow.why,
        recommendationRow.justification,
        recommendationRow.recommendation,
        recommendationRow.action,
        criterionRow.rationale,
      );

      if (!rationale) {
        continue;
      }

      const manuscriptCoordinates = firstNonEmptyString(
        recommendationRow.manuscript_coordinates,
        recommendationRow.location_ref,
        recommendationRow.locationRef,
        `${criterion}:recommendation`,
      );

      const fallbackCandidates = buildFallbackCandidateTexts({
        criterion,
        anchor: evidenceAnchor,
        rationale,
        action: normalizeOptionalText(recommendationRow.action),
        expectedImpact: normalizeOptionalText(recommendationRow.expected_impact),
        fixDirection: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
        symptom: normalizeOptionalText(recommendationRow.symptom) ?? normalizeOptionalText(recommendationRow.diagnosis),
      });

      opportunities.push({
        opportunity_id: buildOpportunityId({
          criterion,
          rationale,
          anchor: evidenceAnchor,
          location: manuscriptCoordinates,
        }),
        criterion,
        severity: normalizeSeverity(recommendationRow.severity ?? recommendationRow.priority, criterionScore),
        rationale,
        evidence_anchor: evidenceAnchor,
        manuscript_coordinates: manuscriptCoordinates,
        provenance: 'evaluation_result.criteria.recommendations',
        confidence: normalizeConfidence(recommendationRow.confidence),
        decision_state: 'open',
        revision_operation: normalizeRevisionOperation(recommendationRow.revision_operation),
        candidate_text_a: normalizeOptionalText(recommendationRow.candidate_text_a) ?? fallbackCandidates.a,
        candidate_text_b: normalizeOptionalText(recommendationRow.candidate_text_b) ?? fallbackCandidates.b,
        candidate_text_c: normalizeOptionalText(recommendationRow.candidate_text_c) ?? fallbackCandidates.c,
        symptom: normalizeOptionalText(recommendationRow.symptom),
        cause: normalizeOptionalText(recommendationRow.cause),
        fix_direction: normalizeOptionalText(recommendationRow.fix_direction),
        reader_effect: normalizeOptionalText(recommendationRow.reader_effect),
        mistake_proofing: normalizeOptionalText(recommendationRow.mistake_proofing),
      });
    }
  }

  return opportunities;
}

function extractTopLevelRecommendations(payload: Record<string, unknown>): RevisionOpportunity[] {
  const recRoot = payload.recommendations;
  const recommendations = Array.isArray(recRoot)
    ? recRoot
    : isRecord(recRoot)
      ? [
          ...(Array.isArray(recRoot.quick_wins) ? recRoot.quick_wins : []),
          ...(Array.isArray(recRoot.strategic_revisions) ? recRoot.strategic_revisions : []),
          ...(Array.isArray(recRoot.items) ? recRoot.items : []),
        ]
      : [];

  const opportunities: RevisionOpportunity[] = [];

  for (const recommendationRow of recommendations) {
    if (!isRecord(recommendationRow)) continue;

    const evidenceAnchor = firstNonEmptyString(
      recommendationRow.evidence_anchor,
      recommendationRow.anchor_snippet,
      recommendationRow.evidence_snippet,
      recommendationRow.snippet,
      recommendationRow.quote,
    );

    if (!evidenceAnchor) {
      continue;
    }

    const criterion = normalizeCriterion(recommendationRow.criterion ?? recommendationRow.rule);
    const rationale = firstNonEmptyString(
      recommendationRow.rationale,
      recommendationRow.diagnosis,
      recommendationRow.why,
      recommendationRow.justification,
      recommendationRow.recommendation,
      recommendationRow.action,
    );

    if (!rationale) {
      continue;
    }

    const manuscriptCoordinates = firstNonEmptyString(
      recommendationRow.manuscript_coordinates,
      recommendationRow.location_ref,
      recommendationRow.locationRef,
      `${criterion}:recommendation`,
    );

    const fallbackCandidates = buildFallbackCandidateTexts({
      criterion,
      anchor: evidenceAnchor,
      rationale,
      action: normalizeOptionalText(recommendationRow.action),
      expectedImpact: normalizeOptionalText(recommendationRow.expected_impact),
      fixDirection: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
      symptom: normalizeOptionalText(recommendationRow.symptom) ?? normalizeOptionalText(recommendationRow.diagnosis),
    });

    opportunities.push({
      opportunity_id: buildOpportunityId({
        criterion,
        rationale,
        anchor: evidenceAnchor,
        location: manuscriptCoordinates,
      }),
      criterion,
      severity: normalizeSeverity(recommendationRow.severity ?? recommendationRow.priority),
      rationale,
      evidence_anchor: evidenceAnchor,
      manuscript_coordinates: manuscriptCoordinates,
      provenance: 'evaluation_result.recommendations',
      confidence: normalizeConfidence(recommendationRow.confidence),
      decision_state: 'open',
      revision_operation: normalizeRevisionOperation(recommendationRow.revision_operation),
      candidate_text_a: normalizeOptionalText(recommendationRow.candidate_text_a) ?? fallbackCandidates.a,
      candidate_text_b: normalizeOptionalText(recommendationRow.candidate_text_b) ?? fallbackCandidates.b,
      candidate_text_c: normalizeOptionalText(recommendationRow.candidate_text_c) ?? fallbackCandidates.c,
      symptom: normalizeOptionalText(recommendationRow.symptom),
      cause: normalizeOptionalText(recommendationRow.cause),
      fix_direction: normalizeOptionalText(recommendationRow.fix_direction),
      reader_effect: normalizeOptionalText(recommendationRow.reader_effect),
      mistake_proofing: normalizeOptionalText(recommendationRow.mistake_proofing),
    });
  }

  return opportunities;
}

export function buildRevisionOpportunitiesFromEvaluationPayload(payload: unknown): RevisionOpportunity[] {
  if (!isRecord(payload)) {
    return [];
  }

  const merged = [
    ...extractCriteriaRecommendations(payload),
    ...extractTopLevelRecommendations(payload),
  ];

  const deduped = new Map<string, RevisionOpportunity>();
  for (const opportunity of merged) {
    if (!deduped.has(opportunity.opportunity_id)) {
      deduped.set(opportunity.opportunity_id, opportunity);
    }
  }

  return [...deduped.values()];
}

export async function ensureRevisionOpportunityLedgerArtifact(supabase: any, jobId: string): Promise<EnsureLedgerResult> {
  const { data: existingLedgerRow, error: existingLedgerError } = await supabase
    .from('evaluation_artifacts')
    .select('id, content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'revision_opportunity_ledger_v1')
    .maybeSingle();

  if (existingLedgerError) {
    throw new Error(`Failed to read revision_opportunity_ledger_v1: ${existingLedgerError.message}`);
  }

  const existingOpportunities = normalizeExistingLedgerOpportunities(
    existingLedgerRow?.content?.opportunities,
  );

  if (existingOpportunities && existingOpportunities.length > 0) {
    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: existingOpportunities,
    };
  }

  const { data: jobRow, error: jobReadError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, evaluation_project_id, evaluation_result')
    .eq('id', jobId)
    .maybeSingle();

  if (jobReadError || !jobRow) {
    throw new Error(`Failed to resolve evaluation job for revision opportunity ledger: ${jobReadError?.message ?? 'job not found'}`);
  }

  const { data: evaluationResultRow, error: evaluationResultError } = await supabase
    .from('evaluation_artifacts')
    .select('content, source_hash')
    .eq('job_id', jobId)
    .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const evaluationPayload =
    evaluationResultRow?.content ??
    (isRecord(jobRow.evaluation_result) ? jobRow.evaluation_result : null);

  if (evaluationResultError || !evaluationPayload) {
    throw new Error(
      `Failed to build revision opportunity ledger: evaluation result artifact missing (${evaluationResultError?.message ?? 'no evaluation result'})`,
    );
  }

  const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(evaluationPayload);

  // Self-heal stale empty ledgers: if an existing canonical ledger exists but
  // still resolves to zero opportunities after rebuild, avoid a no-op rewrite
  // and return the current artifact as-is.
  if (existingOpportunities && existingOpportunities.length === 0 && opportunities.length === 0) {
    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: existingOpportunities,
    };
  }

  const now = new Date().toISOString();
  const artifactId = `revision_opportunity_ledger_v1:${randomUUID().slice(0, 16)}`;
  const sourceHash = sourceHashFor({
    job_id: jobId,
    evaluation_source_hash: evaluationResultRow.source_hash ?? null,
    opportunities,
  });

  const payload = {
    job_id: jobId,
    evaluation_project_id: jobRow.evaluation_project_id ?? null,
    manuscript_id: Number(jobRow.manuscript_id),
    manuscript_version_hash: `manuscript_${String(jobRow.manuscript_id)}_${jobId}`,
    artifact_id: artifactId,
    artifact_type: 'revision_opportunity_ledger_v1',
    artifact_version: 'v1',
    source_hash: sourceHash,
    generated_at: now,
    opportunities,
  };

  const { data: upsertRows, error: upsertError } = await supabase
    .from('evaluation_artifacts')
    .upsert(
      {
        job_id: jobId,
        manuscript_id: Number(jobRow.manuscript_id),
        evaluation_project_id: jobRow.evaluation_project_id ?? null,
        artifact_type: 'revision_opportunity_ledger_v1',
        artifact_version: 'v1',
        source_hash: sourceHash,
        content: payload,
        created_at: now,
      },
      { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
    )
    .select('id')
    .limit(1);

  if (upsertError) {
    throw new Error(`Failed to persist revision_opportunity_ledger_v1: ${upsertError.message}`);
  }

  const persistedArtifactId =
    (Array.isArray(upsertRows) && typeof upsertRows[0]?.id === 'string')
      ? upsertRows[0].id
      : null;

  return {
    artifactId: persistedArtifactId,
    opportunities,
  };
}
