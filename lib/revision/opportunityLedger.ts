import { createHash, randomUUID } from 'crypto';

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

function buildOpportunityId(parts: { criterion: string; rationale: string; anchor: string; location: string }): string {
  const digest = createHash('sha256')
    .update(`${parts.criterion}|${parts.rationale}|${parts.anchor}|${parts.location}`)
    .digest('hex')
    .slice(0, 18);
  return `rol:${digest}`;
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

  const existingOpportunities = Array.isArray(existingLedgerRow?.content?.opportunities)
    ? (existingLedgerRow.content.opportunities as RevisionOpportunity[])
    : null;

  if (existingOpportunities) {
    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: existingOpportunities,
    };
  }

  const { data: jobRow, error: jobReadError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, evaluation_project_id')
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

  if (evaluationResultError || !evaluationResultRow?.content) {
    throw new Error(
      `Failed to build revision opportunity ledger: evaluation result artifact missing (${evaluationResultError?.message ?? 'no evaluation result'})`,
    );
  }

  const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(evaluationResultRow.content);
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
