import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  ChangeProposal,
  CreateRevisionSessionInput,
  ProposalDecision,
  RevisionSession,
} from "./types";

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
        `[REVISION-SESSIONS] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

function mapRevisionSession(row: any): RevisionSession {
  return {
    id: row.id,
    evaluation_run_id: row.evaluation_run_id,
    source_version_id: row.source_version_id,
    result_version_id: row.result_version_id,
    status: row.status,
    summary: row.summary ?? {},
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

function mapChangeProposal(row: any): ChangeProposal {
  return {
    id: row.id,
    revision_session_id: row.revision_session_id,
    location_ref: row.location_ref,
    rule: row.rule,
    action: row.action,
    original_text: row.original_text,
    proposed_text: row.proposed_text,
    justification: row.justification,
    severity: row.severity,
    decision: row.decision,
    modified_text: row.modified_text,
    anchor_start: row.anchor_start ?? null,
    anchor_end: row.anchor_end ?? null,
    anchor_context: row.anchor_context ?? null,
    created_at: row.created_at,
  };
}

export async function createRevisionSession(
  input: CreateRevisionSessionInput,
): Promise<RevisionSession> {
  const { data, error } = await supabase
    .from("revision_sessions")
    .insert({
      evaluation_run_id: input.evaluation_run_id,
      source_version_id: input.source_version_id,
      status: "open",
      summary: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(`createRevisionSession failed: ${error.message}`);
  return mapRevisionSession(data);
}

export async function getRevisionSessionById(
  revisionSessionId: string,
): Promise<RevisionSession | null> {
  const { data, error } = await supabase
    .from("revision_sessions")
    .select("*")
    .eq("id", revisionSessionId)
    .maybeSingle();

  if (error) throw new Error(`getRevisionSessionById failed: ${error.message}`);
  return data ? mapRevisionSession(data) : null;
}

export async function listProposalsForSession(
  revisionSessionId: string,
): Promise<ChangeProposal[]> {
  const { data, error } = await supabase
    .from("change_proposals")
    .select("*")
    .eq("revision_session_id", revisionSessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`listProposalsForSession failed: ${error.message}`);
  return (data ?? []).map(mapChangeProposal);
}

export async function decideProposal(
  proposalId: string,
  decision: ProposalDecision,
  modifiedText?: string | null,
): Promise<ChangeProposal> {
  const updatePayload: Record<string, unknown> = {
    decision,
  };

  if (decision === "modified") {
    updatePayload.modified_text = modifiedText ?? "";
  }

  const { data, error } = await supabase
    .from("change_proposals")
    .update(updatePayload)
    .eq("id", proposalId)
    .select("*")
    .single();

  if (error) throw new Error(`decideProposal failed: ${error.message}`);
  return mapChangeProposal(data);
}

export async function markRevisionSessionApplied(
  revisionSessionId: string,
  resultVersionId: string,
  summary: Record<string, unknown>,
): Promise<RevisionSession> {
  const { data, error } = await supabase
    .from("revision_sessions")
    .update({
      status: "applied",
      result_version_id: resultVersionId,
      summary,
      completed_at: new Date().toISOString(),
    })
    .eq("id", revisionSessionId)
    .select("*")
    .single();

  if (error) throw new Error(`markRevisionSessionApplied failed: ${error.message}`);
  return mapRevisionSession(data);
}

export async function discardRevisionSession(
  revisionSessionId: string,
): Promise<RevisionSession> {
  const { data, error } = await supabase
    .from("revision_sessions")
    .update({
      status: "discarded",
      completed_at: new Date().toISOString(),
    })
    .eq("id", revisionSessionId)
    .select("*")
    .single();

  if (error) throw new Error(`discardRevisionSession failed: ${error.message}`);
  return mapRevisionSession(data);
}
