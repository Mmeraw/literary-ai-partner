import { createClient } from '@supabase/supabase-js';
import { canonicalJsonSha256 } from '../lib/evaluation/canonicalJsonHash';
import {
  reconstructRevisionLedgerWithCurrentCode,
  resolveReviseContextQuality,
} from '../lib/revision/opportunityLedger';
import { resolveRevisionModeContract } from '../lib/revision/modeContract';

type AnyRecord = Record<string, unknown>;

type ArtifactRow = {
  artifact_type: string;
  content: AnyRecord | null;
  created_at?: string | null;
};

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = env(key);
    if (value) return value;
  }
  throw new Error(`Missing required env var. Tried: ${keys.join(', ')}`);
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function latestArtifactsByType(rows: ArtifactRow[]): Map<string, ArtifactRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );
  const out = new Map<string, ArtifactRow>();
  for (const row of sorted) {
    if (!out.has(row.artifact_type)) out.set(row.artifact_type, row);
  }
  return out;
}

function wordCountFromEvaluationPayload(payload: unknown): number | null {
  const record = asRecord(payload);
  const overview = asRecord(record.overview);
  if (typeof overview.word_count === 'number' && Number.isFinite(overview.word_count)) {
    return overview.word_count;
  }
  if (typeof record.word_count === 'number' && Number.isFinite(record.word_count)) {
    return record.word_count;
  }
  return null;
}

async function main() {
  const jobId = requireEnv('PROOF_JOB_ID', 'JOB_ID');
  const supabaseUrl = requireEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: jobRow, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id,status,manuscript_id,manuscript_version_id,created_at,evaluation_result,policy_family,voice_preservation_level,english_variant')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) throw new Error(`evaluation_jobs lookup failed: ${jobError.message}`);
  if (!jobRow) throw new Error(`Job not found: ${jobId}`);

  const { data: artifactRows, error: artifactError } = await supabase
    .from('evaluation_artifacts')
    .select('artifact_type,content,created_at')
    .eq('job_id', jobId)
    .in('artifact_type', [
      'unified_evaluation_document_v1',
      'evaluation_result_v2',
      'evaluation_result_v1',
      'ledger_quality_report_v1',
    ]);
  if (artifactError) throw new Error(`evaluation_artifacts lookup failed: ${artifactError.message}`);

  const artifacts = latestArtifactsByType((artifactRows ?? []) as ArtifactRow[]);
  const ued = asRecord(artifacts.get('unified_evaluation_document_v1')?.content);
  if (Object.keys(ued).length === 0) throw new Error('Missing unified_evaluation_document_v1');

  const evaluationPayload =
    artifacts.get('evaluation_result_v2')?.content ??
    artifacts.get('evaluation_result_v1')?.content ??
    jobRow.evaluation_result;
  const ledgerQualityContent = artifacts.get('ledger_quality_report_v1')?.content ?? null;
  const modeContract = resolveRevisionModeContract({ evaluationPayload, job: jobRow });
  const contextQualityDecision = resolveReviseContextQuality(
    ledgerQualityContent,
    modeContract.evaluation_mode,
  );

  const manuscriptId = Number(jobRow.manuscript_id);
  const { data: chunkRows, error: chunkError } = await supabase
    .from('manuscript_chunks')
    .select('content')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true });
  if (chunkError) throw new Error(`manuscript_chunks lookup failed: ${chunkError.message}`);
  const manuscriptChunksByContent = (chunkRows ?? [])
    .map((row: { content?: unknown }) => ({
      content: typeof row.content === 'string' ? row.content : '',
    }))
    .filter((row) => row.content.trim().length > 0);

  const sourceUedHash = canonicalJsonSha256(ued);
  const reconstruction = reconstructRevisionLedgerWithCurrentCode({
    unifiedDocument: ued,
    sourceUedHash,
    wordCount: wordCountFromEvaluationPayload(evaluationPayload),
    contextQuality: contextQualityDecision.status,
    evaluationMode: modeContract.evaluation_mode,
    manuscriptChunksByContent,
  });

  const trace = reconstruction.opportunities.map((opportunity) => {
    const diagnostic = reconstruction.preflightDiagnostics[opportunity.opportunity_id] ?? null;
    const reasons = opportunity.preflight_reasons ?? [];
    const nonContextReasons = reasons.filter(
      (reason) => reason !== 'limited_context_due_to_degraded_canon',
    );
    return {
      opportunity_id: opportunity.opportunity_id,
      source_opportunity_id: opportunity.source_opportunity_id ?? null,
      criterion: opportunity.criterion,
      severity: opportunity.severity,
      preflight_status: opportunity.preflight_status ?? null,
      grounding_status: opportunity.grounding_status ?? null,
      preflight_reasons: reasons,
      anchor_reason_code: diagnostic?.reason_code ?? null,
      anchor_diagnostic: diagnostic,
      individual_gate_would_pass:
        opportunity.preflight_status === 'limited_context' &&
        diagnostic?.decision === 'passed' &&
        nonContextReasons.length === 0,
      hydration_lookup: reconstruction.hydrationAnchorLookupDiagnostics[opportunity.opportunity_id] ?? null,
    };
  });

  const blocked = trace.filter((item) => item.preflight_status === 'blocked');
  const limited = trace.filter((item) => item.preflight_status === 'limited_context');
  const passed = trace.filter((item) => item.preflight_status === 'passed');
  const reasonCodeCounts = blocked.reduce<Record<string, number>>((counts, item) => {
    const key = item.anchor_reason_code ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  const report = {
    schema_version: 'revision_opportunity_trace_v1',
    generated_at: new Date().toISOString(),
    job: {
      id: jobRow.id,
      status: jobRow.status,
      manuscript_id: manuscriptId,
      manuscript_version_id: jobRow.manuscript_version_id,
      created_at: jobRow.created_at,
    },
    source: {
      current_code_reconstruction: true,
      production_writes_performed: false,
      calls_openai: false,
      source_ued_hash: sourceUedHash,
      evaluation_mode: modeContract.evaluation_mode,
    },
    ledger_quality: {
      artifact_present: Boolean(artifacts.get('ledger_quality_report_v1')),
      context_quality_decision: contextQualityDecision,
      gate_ready_status: contextQualityDecision.gate_ready_status,
      blocking_reasons: contextQualityDecision.blocking_reasons,
      degraded_layers: contextQualityDecision.degraded_layers,
      raw_quality_report: asRecord(asRecord(ledgerQualityContent).quality_report),
    },
    summary: {
      total: trace.length,
      blocked: blocked.length,
      limited_context: limited.length,
      passed: passed.length,
      ready_for_revise: reconstruction.readyForRevise,
      blocked_anchor_reason_codes: reasonCodeCounts,
      limited_individual_gate_would_pass: limited.filter(
        (item) => item.individual_gate_would_pass,
      ).length,
      hydration_no_match: reconstruction.hydrationAnchorLookupSummary.no_match,
    },
    opportunities: trace,
    assertions: {
      opportunity_count_matches_reconstruction: trace.length === reconstruction.opportunities.length,
      summary_total_reconciles: blocked.length + limited.length + passed.length === trace.length,
      all_limited_flags_serialized: limited.every(
        (item) => typeof item.individual_gate_would_pass === 'boolean',
      ),
      all_blocked_reason_codes_serialized: blocked.every(
        (item) => typeof item.anchor_reason_code === 'string' && item.anchor_reason_code.length > 0,
      ),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
