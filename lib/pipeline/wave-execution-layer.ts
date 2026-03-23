/**
 * Wave Execution Layer
 *
 * Coordinates wave target selection, plan construction, and Supabase persistence
 * for the wave revision pipeline. Planning logic is fully delegated to
 * lib/revision/wavePlanner — this layer owns DB persistence only.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import {
	getWave,
	getWavesByPass,
	WAVE_REGISTRY,
} from "@/lib/revision/waveRegistry";
import {
	planWaves,
	deriveWaveTargetsFromFindings,
	validatePlan,
	type RevisionMode,
	type WavePlan,
} from "@/lib/revision/wavePlanner";

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
				`[WAVE-EXECUTION-LAYER] Supabase unavailable - cannot access .${String(prop)}`,
			);
		}
		return client[prop as keyof typeof client];
	},
});

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WaveExecutionLayerInput = {
	revision_session_id: string;
	revision_mode: RevisionMode;
	pass1_findings?: Record<string, unknown>;
	pass2_findings?: Record<string, unknown>;
	pass3_findings?: Record<string, unknown>;
	explicit_wave_ids?: number[];
};

export type WaveExecutionLayerResult = {
	revision_session_id: string;
	plan: WavePlan;
	derived_wave_ids: number[];
	validation: { valid: boolean; violations: string[] };
	persisted: boolean;
};

// ---------------------------------------------------------------------------
// deriveRevisionTargetsFromPass3
//
// Delegates entirely to wavePlanner.deriveWaveTargetsFromFindings.
// Pass 3 findings typically carry the richest criterion+wave signal, so this
// helper provides a named seam for callers that only have pass-3 data.
// ---------------------------------------------------------------------------

export function deriveRevisionTargetsFromPass3(
	pass3Findings: Record<string, unknown>,
): number[] {
	return deriveWaveTargetsFromFindings(pass3Findings);
}

// ---------------------------------------------------------------------------
// deriveAllPassTargets
//
// Merges targets from all three passes, deduplicates, and validates each id
// against WAVE_REGISTRY.
// ---------------------------------------------------------------------------

function deriveAllPassTargets(
	pass1?: Record<string, unknown>,
	pass2?: Record<string, unknown>,
	pass3?: Record<string, unknown>,
): number[] {
	const validIds = new Set(WAVE_REGISTRY.map((w) => w.id));
	const merged = [
		...deriveWaveTargetsFromFindings(pass1 ?? {}),
		...deriveWaveTargetsFromFindings(pass2 ?? {}),
		...deriveWaveTargetsFromFindings(pass3 ?? {}),
	];

	const seen = new Set<number>();
	const deduped: number[] = [];
	for (const id of merged) {
		if (!seen.has(id) && validIds.has(id)) {
			seen.add(id);
			deduped.push(id);
		}
	}
	return deduped;
}

// ---------------------------------------------------------------------------
// persistWavePlanSummary
//
// Writes the wave plan summary into the revision_sessions.summary JSONB column
// so downstream workers can read it without recomputing the plan.
// ---------------------------------------------------------------------------

async function persistWavePlanSummary(
	revisionSessionId: string,
	plan: WavePlan,
	derivedWaveIds: number[],
	valid: boolean,
): Promise<void> {
	const waveSummary = {
		wave_plan: {
			ordered_wave_ids: plan.orderedWaveIds,
			estimated_edit_count: plan.estimatedEditCount,
			pass_breakdown: plan.passBreakdown,
			surgical_constraints: plan.surgicalConstraints,
			violations_found: !valid,
			derived_wave_ids: derivedWaveIds,
			persisted_at: new Date().toISOString(),
		},
	};

	// Merge into existing summary JSONB — read → merge → write to avoid clobbering
	// other keys that may have been set by the revision engine.
	const { data: existing, error: readError } = await supabase
		.from("revision_sessions")
		.select("summary")
		.eq("id", revisionSessionId)
		.single();

	if (readError) {
		throw new Error(
			`[WAVE-EXECUTION-LAYER] Failed to read revision_session ${revisionSessionId}: ${readError.message}`,
		);
	}

	const mergedSummary = {
		...(typeof existing?.summary === "object" && existing.summary !== null
			? existing.summary
			: {}),
		...waveSummary,
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
			`[WAVE-EXECUTION-LAYER] Failed to persist wave plan for session ${revisionSessionId}: ${writeError.message}`,
		);
	}
}

// ---------------------------------------------------------------------------
// executeWaveLayer
//
// Main entry-point:
//  1. Derive wave targets from all pass findings + any explicit override.
//  2. Build and validate the wave plan via wavePlanner.
//  3. Persist the plan summary to Supabase.
//  4. Return the plan + metadata for downstream pipeline steps.
// ---------------------------------------------------------------------------

export async function executeWaveLayer(
	input: WaveExecutionLayerInput,
): Promise<WaveExecutionLayerResult> {
	const {
		revision_session_id,
		revision_mode,
		pass1_findings,
		pass2_findings,
		pass3_findings,
		explicit_wave_ids,
	} = input;

	// Step 1: Derive targets from findings (all passes merged).
	const derivedFromFindings = deriveAllPassTargets(pass1_findings, pass2_findings, pass3_findings);

	// Step 2: Resolve final target list — explicit overrides take precedence.
	const targetWaveIds =
		explicit_wave_ids && explicit_wave_ids.length > 0
			? explicit_wave_ids
			: derivedFromFindings;

	// Step 3: Build the authoritative wave plan.
	const passFindings: Record<string, Record<string, unknown> | undefined> = {
		pass1: pass1_findings,
		pass2: pass2_findings,
		pass3: pass3_findings,
	};
	const plan = planWaves(targetWaveIds, revision_mode, passFindings);

	// Step 4: Validate.
	const validation = validatePlan(plan);

	// Step 5: Persist plan summary to revision_sessions.summary JSONB.
	let persisted = false;
	try {
		await persistWavePlanSummary(revision_session_id, plan, derivedFromFindings, validation.valid);
		persisted = true;
	} catch {
		// Persistence failure is non-fatal — upstream can retry or degrade gracefully.
		persisted = false;
	}

	return {
		revision_session_id,
		plan,
		derived_wave_ids: derivedFromFindings,
		validation,
		persisted,
	};
}

// ---------------------------------------------------------------------------
// getWavesForPass
//
// Convenience wrapper exposing getWavesByPass for callers that need to query
// waves by pass number without importing waveRegistry directly.
// ---------------------------------------------------------------------------

export { getWavesByPass } from "@/lib/revision/waveRegistry";
