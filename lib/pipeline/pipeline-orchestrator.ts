/**
 * Pipeline Orchestrator
 *
 * Entry-point for the wave revision pipeline. The `runWaveEngine` function
 * drives a full end-to-end revision pass against a chapter by delegating to
 * orchestrateRevision from lib/revision/revisionOrchestrator.
 *
 * This layer owns:
 *  - Parameter assembly for OrchestratorInput
 *  - Supabase persistence of the orchestration result into revision_sessions.summary
 *  - Surfacing OrchestratorResult (plan, diffReport, appliedEdits, etc.) to callers
 *
 * It does NOT own: wave planning, conflict resolution, diff intelligence, or
 * surgical enforcement — those are handled inside revisionOrchestrator and its
 * dependencies.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import { gatePhase2OnPhase1 } from "@/lib/evaluation/pipeline/gatePhase2OnPhase1";
import {
	orchestrateRevision,
	type OrchestratorInput,
	type OrchestratorResult,
} from "@/lib/revision/revisionOrchestrator";
import type { RevisionMode } from "@/lib/revision/wavePlanner";

// ---------------------------------------------------------------------------
// Supabase client (lazy singleton, matching project pattern)
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
	if (_supabase === undefined) {
		_supabase = getSupabaseAdminClient();
	}
	return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
	get(_target, prop) {
		const client = getSupabase();
		if (!client) {
			throw new Error(
				`[PIPELINE-ORCHESTRATOR] Supabase unavailable - cannot access .${String(prop)}`,
			);
		}
		return client[prop as keyof typeof client];
	},
});

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RunWaveEngineInput = {
	/** The raw chapter text to revise. */
	chapterText: string;
	/** Stable identifier for the chapter (used in logging and DB keys). */
	chapterId: string;
	/** Depth of revision to apply. */
	revisionMode: RevisionMode;
	/** Optional: revision_session_id to persist results against. */
	revisionSessionId?: string;
	/** Optional: findings from pipeline pass 1. */
	pass1Findings?: Record<string, unknown>;
	/** Optional: findings from pipeline pass 2. */
	pass2Findings?: Record<string, unknown>;
	/** Optional: findings from pipeline pass 3. */
	pass3Findings?: Record<string, unknown>;
	/** Optional: explicit wave override list (skips findings-derived selection). */
	targetWaveIds?: number[];
};

export type RunWaveEngineResult = {
	orchestratorResult: OrchestratorResult;
	revisionSessionId: string | null;
	persisted: boolean;
};

// ---------------------------------------------------------------------------
// persistOrchestratorResult
//
// Writes key orchestration metrics into revision_sessions.summary JSONB so the
// UI and admin layer can surface revision coverage, edit counts, and enforcement
// activity without re-running the orchestrator.
// ---------------------------------------------------------------------------

async function persistOrchestratorResult(
	revisionSessionId: string,
	result: OrchestratorResult,
): Promise<void> {
	const orchestrationSummary = {
		orchestration: {
			chapter_id: result.chapterId,
			success: result.success,
			applied_edits_count: result.appliedEdits.length,
			skipped_edits_count: result.skippedEdits.length,
			total_ranked_edits: result.diffReport.rankedEdits.length,
			estimated_risk: result.diffReport.estimatedRisk,
			surgical_enforcement_entries: result.surgicalEnforcementLog.length,
			errors: result.errors,
			orchestrated_at: new Date().toISOString(),
		},
	};

	// Read → merge → write to avoid clobbering other summary keys.
	const { data: existing, error: readError } = await supabase
		.from("revision_sessions")
		.select("summary")
		.eq("id", revisionSessionId)
		.single();

	if (readError) {
		throw new Error(
			`[PIPELINE-ORCHESTRATOR] Failed to read revision_session ${revisionSessionId}: ${readError.message}`,
		);
	}

	const mergedSummary = {
		...(typeof existing?.summary === "object" && existing.summary !== null
			? existing.summary
			: {}),
		...orchestrationSummary,
	};

	const { error: writeError } = await supabase
		.from("revision_sessions")
		.update({
			summary: mergedSummary,
			last_transition_at: new Date().toISOString(),
		})
		.eq("id", revisionSessionId);

	if (writeError) {
		throw new Error(
			`[PIPELINE-ORCHESTRATOR] Failed to persist orchestration result for session ${revisionSessionId}: ${writeError.message}`,
		);
	}
}

// ---------------------------------------------------------------------------
// runWaveEngine
//
// Drives a full wave revision pass end-to-end:
//  1. Assembles OrchestratorInput from the caller's parameters.
//  2. Calls orchestrateRevision (which owns planning, conflict resolution,
//     diff intelligence, surgical enforcement, and text application).
//  3. Optionally persists the result to revision_sessions.summary in Supabase.
//  4. Returns OrchestratorResult plus persistence metadata.
// ---------------------------------------------------------------------------

export async function runWaveEngine(
	input: RunWaveEngineInput,
): Promise<RunWaveEngineResult> {
	const {
		chapterText,
		chapterId,
		revisionMode,
		revisionSessionId,
		pass1Findings,
		pass2Findings,
		pass3Findings,
		targetWaveIds,
	} = input;

	// Assemble the canonical input shape expected by orchestrateRevision.
	const orchestratorInput: OrchestratorInput = {
		chapterText,
		chapterId,
		revisionMode,
		pass1Findings,
		pass2Findings,
		pass3Findings,
		targetWaveIds,
	};

	// -- EG: Verify no Pass 1 gate rejections before orchestrating revisions --
    // Check pass1Findings for any EVALUATION_GATE_REJECTED status
    const hasGateRejection = Array.isArray(pass1Findings) && pass1Findings.some(
      (f: any) => f?.failure_code === 'EVALUATION_GATE_REJECTED' ||
                  f?.status === 'EVALUATION_GATE_REJECTED' ||
                  f?.gateResult?.pass === false
    );
    if (hasGateRejection) {
      return {
        orchestratorResult: {
          status: 'blocked',
          reason: 'Pass 1 evaluation gate rejected one or more chunks - revision blocked',
          gateRejected: true,
        } as any,
        revisionSessionId: revisionSessionId ?? null,
        persisted: false,
      };
    }

    // Run the full orchestration pipeline.
	const orchestratorResult = orchestrateRevision(orchestratorInput);

	// Optionally persist results if a session id is provided.
	let persisted = false;
	if (revisionSessionId) {
		try {
			await persistOrchestratorResult(revisionSessionId, orchestratorResult);
			persisted = true;
		} catch {
			// Persistence failure is non-fatal — the revision result is still returned.
			persisted = false;
		}
	}

	return {
		orchestratorResult,
		revisionSessionId: revisionSessionId ?? null,
		persisted,
	};
}

// ---------------------------------------------------------------------------
// Re-export the canonical orchestrator types for callers that import through
// this pipeline layer rather than directly from revisionOrchestrator.
// ---------------------------------------------------------------------------
export type { OrchestratorInput, OrchestratorResult };
