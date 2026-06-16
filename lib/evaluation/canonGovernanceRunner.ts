/**
 * Canon Governance Runner
 *
 * Post-evaluation layer that runs after WAVE execution and before
 * job completion. Produces governance audit artifacts for:
 *   - Gate 15 (mechanical purity + overcorrection firewall)
 *   - Golden Spine (motif/object continuity ledger)
 *   - Dialogue Canon Audit (speaker differentiation, attribution, exposition)
 *
 * Gate 15 FAIL now feeds into the Finalization Quality Guard in processor.ts,
 * blocking report shipment (status = quality_issue_detected). Golden Spine and
 * Dialogue Canon remain advisory (logged but non-blocking).
 * Long-form only (≥25,000 words). Short-form manuscripts skip all layers.
 *
 * Architecture:
 *   Pass 3 synthesis (evaluation complete)
 *           ↓
 *   WAVE execution (existing)
 *           ↓
 *   Canon Governance Runner ← this module
 *           ↓
 *   gate_15_audit_v1 + golden_spine_v1 + dialogue_canon_audit_v1 + revision_canon_metadata_v1 persisted
 *           ↓
 *   job = complete
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertEvaluationArtifact, sha256Hex } from './artifactPersistence';
import { runGate15Audit, type Gate15AuditArtifact } from './gate15';
import { runGoldenSpineAudit, type GoldenSpineArtifact } from './goldenSpine/goldenSpineAudit';
import { runDialogueCanonAudit, type DialogueCanonAuditArtifact } from './dialogueCanon/dialogueCanonAudit';
import { buildRevisionCanonMetadata, type RevisionCanonMetadata } from './revisionCanonMetadata';

const CANON_GOVERNANCE_TIMEOUT_MS = 30_000;

export interface CanonGovernanceInput {
  manuscriptText: string;
  jobId: string;
  manuscriptId: number;
  userId: string;
  /** Synthesis output for Golden Spine extraction — optional, degrades gracefully */
  synthesisJson?: Record<string, unknown>;
  /** Criteria keys from the evaluation result — for Phase 5 metadata enrichment */
  criteriaKeys?: string[];
  wordCount?: number;
}

export interface CanonGovernanceResult {
  gate15: Gate15AuditArtifact | null;
  goldenSpine: GoldenSpineArtifact | null;
  dialogueCanon: DialogueCanonAuditArtifact | null;
  revisionCanonMetadata: RevisionCanonMetadata | null;
  errors: string[];
}

export async function runCanonGovernance(
  input: CanonGovernanceInput,
  supabase: SupabaseClient,
): Promise<CanonGovernanceResult> {
  const result: CanonGovernanceResult = {
    gate15: null,
    goldenSpine: null,
    dialogueCanon: null,
    revisionCanonMetadata: null,
    errors: [],
  };

  const { manuscriptText, jobId, manuscriptId, userId } = input;

  // Run all three layers in parallel (they're independent, deterministic, CPU-only)
  const [gate15Result, goldenSpineResult, dialogueResult] = await Promise.allSettled([
    runWithTimeout(() => runGate15Audit(manuscriptText, jobId, String(manuscriptId)), 'Gate15'),
    runWithTimeout(() => runGoldenSpineAudit(manuscriptText, jobId, String(manuscriptId), input.synthesisJson), 'GoldenSpine'),
    runWithTimeout(() => runDialogueCanonAudit(manuscriptText, jobId, String(manuscriptId)), 'DialogueCanon'),
  ]);

  // Process Gate 15 result
  if (gate15Result.status === 'fulfilled' && gate15Result.value) {
    result.gate15 = gate15Result.value;
    try {
      const hash = sha256Hex(JSON.stringify({ jobId, manuscriptId, layer: 'gate_15_audit_v1', ts: result.gate15.timestamp }));
      await upsertEvaluationArtifact({
        supabase,
        jobId,
        manuscriptId,
        artifactType: 'gate_15_audit_v1',
        artifactVersion: 'gate_15_audit_v1',
        sourceHash: hash,
        content: result.gate15,
      });
      console.log(`[CanonGovernance] ${jobId}: gate_15_audit_v1 persisted — status=${result.gate15.overallStatus}`);
    } catch (err) {
      const msg = `Gate 15 artifact persist failed: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[CanonGovernance] ${jobId}: ${msg}`);
    }
  } else if (gate15Result.status === 'rejected') {
    const msg = `Gate 15 execution failed: ${gate15Result.reason}`;
    result.errors.push(msg);
    console.error(`[CanonGovernance] ${jobId}: ${msg}`);
  }

  // Process Golden Spine result
  if (goldenSpineResult.status === 'fulfilled' && goldenSpineResult.value) {
    result.goldenSpine = goldenSpineResult.value;
    try {
      const hash = sha256Hex(JSON.stringify({ jobId, manuscriptId, layer: 'golden_spine_v1', ts: result.goldenSpine.timestamp }));
      await upsertEvaluationArtifact({
        supabase,
        jobId,
        manuscriptId,
        artifactType: 'golden_spine_v1',
        artifactVersion: 'golden_spine_v1',
        sourceHash: hash,
        content: result.goldenSpine,
      });
      console.log(`[CanonGovernance] ${jobId}: golden_spine_v1 persisted — status=${result.goldenSpine.overallStatus}`);
    } catch (err) {
      const msg = `Golden Spine artifact persist failed: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[CanonGovernance] ${jobId}: ${msg}`);
    }
  } else if (goldenSpineResult.status === 'rejected') {
    const msg = `Golden Spine execution failed: ${goldenSpineResult.reason}`;
    result.errors.push(msg);
    console.error(`[CanonGovernance] ${jobId}: ${msg}`);
  }

  // Process Dialogue Canon result
  if (dialogueResult.status === 'fulfilled' && dialogueResult.value) {
    result.dialogueCanon = dialogueResult.value;
    try {
      const hash = sha256Hex(JSON.stringify({ jobId, manuscriptId, layer: 'dialogue_canon_audit_v1', ts: result.dialogueCanon.timestamp }));
      await upsertEvaluationArtifact({
        supabase,
        jobId,
        manuscriptId,
        artifactType: 'dialogue_canon_audit_v1',
        artifactVersion: 'dialogue_canon_audit_v1',
        sourceHash: hash,
        content: result.dialogueCanon,
      });
      console.log(`[CanonGovernance] ${jobId}: dialogue_canon_audit_v1 persisted — status=${result.dialogueCanon.overallStatus}`);
    } catch (err) {
      const msg = `Dialogue Canon artifact persist failed: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[CanonGovernance] ${jobId}: ${msg}`);
    }
  } else if (dialogueResult.status === 'rejected') {
    const msg = `Dialogue Canon execution failed: ${dialogueResult.reason}`;
    result.errors.push(msg);
    console.error(`[CanonGovernance] ${jobId}: ${msg}`);
  }

  // Phase 5: Revision Canon Metadata — runs after phases 2-4 since it cross-references their results
  if (input.criteriaKeys && input.criteriaKeys.length > 0 && input.wordCount) {
    try {
      const revMeta = buildRevisionCanonMetadata(
        input.criteriaKeys,
        input.wordCount,
        jobId,
        result.gate15,
        result.goldenSpine,
        result.dialogueCanon,
      );
      result.revisionCanonMetadata = revMeta;
      const hash = sha256Hex(JSON.stringify({ jobId, manuscriptId, layer: 'revision_canon_metadata_v1', ts: revMeta.timestamp }));
      await upsertEvaluationArtifact({
        supabase,
        jobId,
        manuscriptId,
        artifactType: 'revision_canon_metadata_v1',
        artifactVersion: 'revision_canon_metadata_v1',
        sourceHash: hash,
        content: revMeta,
      });
      console.log(`[CanonGovernance] ${jobId}: revision_canon_metadata_v1 persisted — status=${revMeta.overallStatus}`);
    } catch (err) {
      const msg = `Revision Canon Metadata failed: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[CanonGovernance] ${jobId}: ${msg}`);
    }
  }

  return result;
}

async function runWithTimeout<T>(fn: () => T, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), CANON_GOVERNANCE_TIMEOUT_MS)
    ),
  ]);
}
