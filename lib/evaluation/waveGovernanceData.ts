/**
 * WAVE Governance Data Layer
 *
 * Reads persisted artifacts for the Canon Governance section:
 *   - wave_revision_plan_v1 + wave_runs (WAVE execution)
 *   - gate_15_audit_v1 (Gate 15 mechanical purity + overcorrection firewall)
 *   - golden_spine_v1 (motif/object continuity ledger)
 *   - dialogue_canon_audit_v1 (dialogue quality assessment)
 *
 * Read-only: never mutates pipeline state.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { WaveRunRow } from '@/lib/db/waveRuns';
import type { Gate15AuditArtifact } from './gate15/gate15_orchestrator';
import type { GoldenSpineArtifact } from './goldenSpine/goldenSpineAudit';
import type { DialogueCanonAuditArtifact } from './dialogueCanon/dialogueCanonAudit';
import type { RevisionCanonMetadata } from './revisionCanonMetadata';

// ── Types ────────────────────────────────────────────────────────────────

export type WaveGovernanceStatus = 'executed' | 'skipped' | 'failed' | 'pending';

export interface WaveModuleSummary {
  waveNumber: number;
  waveName: string;
  category: string;
  status: WaveRunRow['status'];
  changesCount: number;
  durationMs: number;
  errorMessage: string | null;
}

export interface WaveGovernanceData {
  /** Whether WAVE data exists for this job */
  available: boolean;

  /** Plan-level status: complete | skipped | failed | timeout */
  planStatus: string;

  /** Reason for skip/fail (e.g., STRUCTURAL_FLOOR_NOT_MET) */
  planReason: string | null;

  /** Reason codes from gate check */
  reasonCodes: string[];

  /** Lowest criteria that failed the gate */
  lowestCriteria: Array<{ key: string; score: number }>;

  /** Number of modules that ran */
  modulesRun: number;

  /** Number of modules that produced findings */
  modulesWithFindings: number;

  /** Revision session ID if created */
  revisionSessionId: string | null;

  /** Wave plan summary (derived wave IDs, validation) */
  wavePlanSummary: {
    derivedWaveIds: number[];
    planValid: boolean;
    violations: string[];
  } | null;

  /** Individual wave module run records */
  waveRuns: WaveModuleSummary[];

  /** Artifact generation timestamp */
  generatedAt: string | null;
}

// ── Fetch ────────────────────────────────────────────────────────────────

/**
 * Fetch WAVE governance data for a given job.
 * Returns null if no WAVE artifact exists (e.g., short-form or pre-WAVE jobs).
 */
export async function getWaveGovernanceData(jobId: string): Promise<WaveGovernanceData | null> {
  const admin = createAdminClient();

  // 1. Read the wave_revision_plan_v1 artifact
  const { data: artifactRow, error: artifactErr } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'wave_revision_plan_v1')
    .maybeSingle();

  if (artifactErr || !artifactRow?.content) {
    return null;
  }

  const plan = artifactRow.content as Record<string, unknown>;
  const planStatus = typeof plan.status === 'string' ? plan.status : 'unknown';
  const planReason = typeof plan.reason === 'string' ? plan.reason : null;
  const reasonCodes = Array.isArray(plan.reason_codes)
    ? (plan.reason_codes as string[])
    : [];
  const lowestCriteria = Array.isArray(plan.lowest_criteria)
    ? (plan.lowest_criteria as Array<{ key: string; score: number }>)
    : [];
  const modulesRun = typeof plan.modules_run === 'number' ? plan.modules_run : 0;
  const modulesWithFindings = typeof plan.modules_with_findings === 'number'
    ? plan.modules_with_findings
    : 0;
  const revisionSessionId = typeof plan.revision_session_id === 'string'
    ? plan.revision_session_id
    : null;
  const generatedAt = typeof plan.generated_at === 'string' ? plan.generated_at : null;

  // Parse wave_plan_summary
  let wavePlanSummary: WaveGovernanceData['wavePlanSummary'] = null;
  const rawSummary = plan.wave_plan_summary;
  if (rawSummary && typeof rawSummary === 'object') {
    const s = rawSummary as Record<string, unknown>;
    wavePlanSummary = {
      derivedWaveIds: Array.isArray(s.derived_wave_ids)
        ? (s.derived_wave_ids as number[])
        : [],
      planValid: typeof s.plan_valid === 'boolean' ? s.plan_valid : false,
      violations: Array.isArray(s.violations) ? (s.violations as string[]) : [],
    };
  }

  // 2. Fetch wave_runs records if we have a revision session
  let waveRuns: WaveModuleSummary[] = [];
  if (revisionSessionId) {
    const { data: runRows, error: runErr } = await admin
      .from('wave_runs')
      .select('wave_number, wave_name, category, status, changes_count, duration_ms, error_message')
      .eq('revision_session_id', revisionSessionId)
      .order('wave_number', { ascending: true });

    if (!runErr && runRows) {
      waveRuns = (runRows as Array<Record<string, unknown>>).map((r) => ({
        waveNumber: r.wave_number as number,
        waveName: r.wave_name as string,
        category: r.category as string,
        status: r.status as WaveRunRow['status'],
        changesCount: (r.changes_count as number) ?? 0,
        durationMs: (r.duration_ms as number) ?? 0,
        errorMessage: (r.error_message as string) ?? null,
      }));
    }
  }

  return {
    available: true,
    planStatus,
    planReason,
    reasonCodes,
    lowestCriteria,
    modulesRun,
    modulesWithFindings,
    revisionSessionId,
    wavePlanSummary,
    waveRuns,
    generatedAt,
  };
}

// ── Canon Governance Artifact Fetchers ────────────────────────────────────

export async function getGate15AuditData(jobId: string): Promise<Gate15AuditArtifact | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'gate_15_audit_v1')
    .maybeSingle();

  if (error || !data?.content) return null;
  return data.content as Gate15AuditArtifact;
}

export async function getGoldenSpineData(jobId: string): Promise<GoldenSpineArtifact | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'golden_spine_v1')
    .maybeSingle();

  if (error || !data?.content) return null;
  return data.content as GoldenSpineArtifact;
}

export async function getDialogueCanonData(jobId: string): Promise<DialogueCanonAuditArtifact | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'dialogue_canon_audit_v1')
    .maybeSingle();

  if (error || !data?.content) return null;
  return data.content as DialogueCanonAuditArtifact;
}

export async function getRevisionCanonMetadata(jobId: string): Promise<RevisionCanonMetadata | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'revision_canon_metadata_v1')
    .maybeSingle();

  if (error || !data?.content) return null;
  return data.content as RevisionCanonMetadata;
}

/** Convenience: fetch all canon governance artifacts in parallel */
export async function getAllCanonGovernanceData(jobId: string) {
  const [waveGov, gate15, goldenSpine, dialogueCanon, revisionCanonMeta] = await Promise.all([
    getWaveGovernanceData(jobId),
    getGate15AuditData(jobId),
    getGoldenSpineData(jobId),
    getDialogueCanonData(jobId),
    getRevisionCanonMetadata(jobId),
  ]);

  return { waveGov, gate15, goldenSpine, dialogueCanon, revisionCanonMeta };
}
