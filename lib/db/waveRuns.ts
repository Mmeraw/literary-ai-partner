import { getSupabaseAdminClient } from "@/lib/supabase";

export type WaveRunStatus = "pending" | "running" | "completed" | "failed";

export type WaveRunRow = {
	id: string;
	revision_session_id: string;
	wave_number: number;
	wave_name: string;
	category: string;
	status: WaveRunStatus;
	proposed_text_hash: string;
	changes_count: number;
	modifications: unknown;
	duration_ms: number;
	error_message: string | null;
	created_at: string;
	completed_at: string | null;
};

export type InsertWaveRunInput = {
	revision_session_id: string;
	wave_number: number;
	wave_name: string;
	category: string;
	status: WaveRunStatus;
	proposed_text_hash: string;
	changes_count?: number;
	modifications?: unknown;
	duration_ms?: number;
	error_message?: string | null;
	completed_at?: string | null;
};

export type UpdateWaveRunStatusInput = {
	status: WaveRunStatus;
	proposed_text_hash?: string;
	changes_count?: number;
	modifications?: unknown;
	duration_ms?: number;
	error_message?: string | null;
	completed_at?: string | null;
};

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
				`[WAVE-RUNS-DB] Supabase unavailable - cannot access .${String(prop)}`,
			);
		}
		return client[prop as keyof typeof client];
	},
});

export async function insertWaveRun(input: InsertWaveRunInput): Promise<WaveRunRow> {
	const payload = {
		revision_session_id: input.revision_session_id,
		wave_number: input.wave_number,
		wave_name: input.wave_name,
		category: input.category,
		status: input.status,
		proposed_text_hash: input.proposed_text_hash,
		changes_count: input.changes_count ?? 0,
		modifications: input.modifications ?? [],
		duration_ms: input.duration_ms ?? 0,
		error_message: input.error_message ?? null,
		completed_at: input.completed_at ?? null,
	};

	const { data, error } = await supabase
		.from("wave_runs")
		.insert(payload)
		.select("*")
		.single();

	if (error) {
		throw new Error(`insertWaveRun failed: ${error.message}`);
	}

	return data as WaveRunRow;
}

export async function updateWaveRunStatus(
	waveRunId: string,
	input: UpdateWaveRunStatusInput,
): Promise<WaveRunRow> {
	const payload: Record<string, unknown> = {
		status: input.status,
	};

	if (input.proposed_text_hash !== undefined) payload.proposed_text_hash = input.proposed_text_hash;
	if (input.changes_count !== undefined) payload.changes_count = input.changes_count;
	if (input.modifications !== undefined) payload.modifications = input.modifications;
	if (input.duration_ms !== undefined) payload.duration_ms = input.duration_ms;
	if (input.error_message !== undefined) payload.error_message = input.error_message;
	if (input.completed_at !== undefined) payload.completed_at = input.completed_at;

	const { data, error } = await supabase
		.from("wave_runs")
		.update(payload)
		.eq("id", waveRunId)
		.select("*")
		.single();

	if (error) {
		throw new Error(`updateWaveRunStatus failed: ${error.message}`);
	}

	return data as WaveRunRow;
}

export async function getWaveRunsBySession(
	revisionSessionId: string,
): Promise<WaveRunRow[]> {
	const { data, error } = await supabase
		.from("wave_runs")
		.select("*")
		.eq("revision_session_id", revisionSessionId)
		.order("wave_number", { ascending: true })
		.order("created_at", { ascending: true });

	if (error) {
		throw new Error(`getWaveRunsBySession failed: ${error.message}`);
	}

	return (data as WaveRunRow[]) ?? [];
}
