#!/usr/bin/env node

/**
 * Read-only U2 live-proof baseline inspector.
 *
 * Purpose:
 * - Inspect recent evaluation_jobs rows for a manuscript.
 * - Inspect one or more existing job artifacts for U2 proof fields.
 * - Never triggers evaluations, writes DB rows, or edits artifacts.
 *
 * Usage:
 *   node scripts/u2-live-proof/inspect-baseline.mjs \
 *     --manuscript-id 5907 \
 *     --job-id fcafb018-54cd-470a-9038-f3fc3836e1a0 \
 *     --limit 5 | tee logs/u2-live-proof/baseline-inspection.txt
 */

const { createClient } = require('@supabase/supabase-js');

function readArgs(argv) {
  const out = {
    manuscriptId: 5907,
    jobIds: [],
    limit: 5,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--manuscript-id' && next) {
      out.manuscriptId = Number(next);
      i += 1;
    } else if (arg === '--job-id' && next) {
      out.jobIds.push(next);
      i += 1;
    } else if (arg === '--limit' && next) {
      out.limit = Number(next);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isInteger(out.manuscriptId) || out.manuscriptId <= 0) {
    throw new Error(`Invalid --manuscript-id: ${out.manuscriptId}`);
  }
  if (!Number.isInteger(out.limit) || out.limit <= 0 || out.limit > 50) {
    throw new Error(`Invalid --limit: ${out.limit}; expected 1..50`);
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node scripts/u2-live-proof/inspect-baseline.mjs \\
    --manuscript-id 5907 \\
    --job-id fcafb018-54cd-470a-9038-f3fc3836e1a0 \\
    --limit 5

Environment:
  SUPABASE_SERVICE_ROLE_KEY required
  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required

This script is read-only. It selects evaluation_jobs and evaluation_artifacts only.`);
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, key };
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function getPath(obj, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function findNodesWithKey(value, key, path = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findNodesWithKey(item, key, `${path}[${index}]`, found));
    return found;
  }

  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      found.push({ path, node: value });
    }
    for (const [childKey, childValue] of Object.entries(value)) {
      findNodesWithKey(childValue, key, `${path}.${childKey}`, found);
    }
  }

  return found;
}

function summarizeReasonCodes(nodes) {
  const counts = new Map();
  for (const item of nodes) {
    const reasonCodes = item.node?.reason_codes;
    if (Array.isArray(reasonCodes)) {
      for (const code of reasonCodes) {
        counts.set(code, (counts.get(code) || 0) + 1);
      }
    }
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function selectArtifactsByColumn(supabase, column, jobId) {
  return supabase
    .from('evaluation_artifacts')
    .select('id, job_id, evaluation_job_id, artifact_schema, created_at, artifact_content')
    .eq(column, jobId)
    .order('created_at', { ascending: false })
    .limit(1);
}

async function getArtifactForJob(supabase, jobId) {
  let result = await selectArtifactsByColumn(supabase, 'job_id', jobId);

  const jobIdColumnMissing = result.error && /column .*job_id.* does not exist|Could not find.*job_id/i.test(result.error.message || '');
  if (jobIdColumnMissing) {
    result = await selectArtifactsByColumn(supabase, 'evaluation_job_id', jobId);
  }

  if (result.error) {
    return { jobId, error: result.error, artifact: null, summary: null };
  }

  const artifact = result.data?.[0] || null;
  if (!artifact) {
    return { jobId, error: null, artifact: null, summary: null };
  }

  const content = artifact.artifact_content || {};
  const governance = getPath(content, ['governance']);
  const confidenceLabel = getPath(content, ['governance', 'confidence_label']);
  const confidenceReasons = getPath(content, ['governance', 'confidence_reasons']);
  const propagationSummary = getPath(content, ['governance', 'propagation_summary']);
  const criteria = getPath(content, ['criteria']);
  const nodesWithReasonCodes = findNodesWithKey(content, 'reason_codes');
  const reasonCodeCounts = summarizeReasonCodes(nodesWithReasonCodes);

  return {
    jobId,
    error: null,
    artifact,
    summary: {
      artifact_id: artifact.id,
      artifact_schema: artifact.artifact_schema,
      created_at: artifact.created_at,
      has_governance: governance != null,
      has_confidence_label: confidenceLabel != null,
      confidence_label: confidenceLabel ?? null,
      has_confidence_reasons: Array.isArray(confidenceReasons) ? confidenceReasons.length > 0 : confidenceReasons != null,
      confidence_reasons: confidenceReasons ?? null,
      has_governance_propagation_summary: propagationSummary != null,
      governance_propagation_summary: propagationSummary ?? null,
      has_criteria: criteria != null,
      nodes_with_reason_codes_count: nodesWithReasonCodes.length,
      reason_code_counts: reasonCodeCounts,
      no_textual_anchor_count: reasonCodeCounts.NO_TEXTUAL_ANCHOR || 0,
      nodes_with_reason_codes: nodesWithReasonCodes,
    },
  };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const { url, key } = getSupabaseEnv();
  const supabase = createClient(url, key);

  const startedAt = new Date().toISOString();

  const { data: latestJobs, error: jobsError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, status, phase, phase_status, created_at, updated_at, completed_at, failed_at, last_error, progress')
    .eq('manuscript_id', args.manuscriptId)
    .order('created_at', { ascending: false })
    .limit(args.limit);

  if (jobsError) {
    throw new Error(`evaluation_jobs query failed: ${jobsError.message}`);
  }

  const latestJobSummaries = (latestJobs || []).map((job) => ({
    id: job.id,
    manuscript_id: job.manuscript_id,
    status: job.status,
    phase: job.phase,
    phase_status: job.phase_status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
    failed_at: job.failed_at,
    last_error: job.last_error,
    has_gate_enforcement: Boolean(job.progress && Object.prototype.hasOwnProperty.call(job.progress, 'gate_enforcement')),
    gate_enforcement: job.progress?.gate_enforcement ?? null,
    has_propagation_summary: Boolean(job.progress && Object.prototype.hasOwnProperty.call(job.progress, 'propagation_summary')),
    propagation_summary: job.progress?.propagation_summary ?? null,
  }));

  const jobIdsToInspect = [...new Set([
    ...args.jobIds,
    ...latestJobSummaries.filter((job) => job.status === 'complete').slice(0, 2).map((job) => job.id),
  ])];

  const artifactInspections = [];
  for (const jobId of jobIdsToInspect) {
    artifactInspections.push(await getArtifactForJob(supabase, jobId));
  }

  const verdict = {
    any_existing_complete_job_has_gate_enforcement: latestJobSummaries.some((job) => job.status === 'complete' && job.has_gate_enforcement),
    any_artifact_exposes_governance_confidence_label: artifactInspections.some((item) => item.summary?.has_confidence_label),
    any_artifact_exposes_governance_confidence_reasons: artifactInspections.some((item) => item.summary?.has_confidence_reasons),
    any_artifact_exposes_criteria_reason_codes: artifactInspections.some((item) => (item.summary?.nodes_with_reason_codes_count || 0) > 0),
    baseline_can_count_as_u2_proof: false,
    missing_for_u2_proof: [],
  };

  if (!verdict.any_existing_complete_job_has_gate_enforcement) {
    verdict.missing_for_u2_proof.push('progress.gate_enforcement on a complete job');
  }
  if (!verdict.any_artifact_exposes_governance_confidence_label) {
    verdict.missing_for_u2_proof.push('artifact_content.governance.confidence_label');
  }
  if (!verdict.any_artifact_exposes_governance_confidence_reasons) {
    verdict.missing_for_u2_proof.push('artifact_content.governance.confidence_reasons');
  }
  if (!verdict.any_artifact_exposes_criteria_reason_codes) {
    verdict.missing_for_u2_proof.push('criteria reason_codes');
  }

  verdict.baseline_can_count_as_u2_proof = verdict.missing_for_u2_proof.length === 0;

  const output = {
    script: 'scripts/u2-live-proof/inspect-baseline.mjs',
    read_only: true,
    started_at: startedAt,
    manuscript_id: args.manuscriptId,
    inspected_job_ids: jobIdsToInspect,
    latest_jobs: latestJobSummaries,
    artifact_inspections: artifactInspections.map((item) => ({
      job_id: item.jobId,
      error: item.error || null,
      summary: item.summary,
    })),
    verdict,
  };

  console.log(safeJson(output));

  if (!verdict.baseline_can_count_as_u2_proof) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(safeJson({
    script: 'scripts/u2-live-proof/inspect-baseline.mjs',
    read_only: true,
    error: error.message,
    stack: error.stack,
  }));
  process.exit(1);
});
