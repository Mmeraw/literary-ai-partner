import { getSupabaseAdminClient } from "@/lib/supabase";
import { logRevisionEvent } from "./logRevisionEvent";
import { getRevisionSessionById } from "./sessions";
import type { RevisionSession, RevisionSessionStatus } from "./types";

export const REVISION_SESSION_ALLOWED_TRANSITIONS: Record<
  RevisionSessionStatus,
  readonly RevisionSessionStatus[]
> = {
  open: ["findings_ready", "failed"],
  findings_ready: ["synthesis_started"],
  synthesis_started: ["proposals_ready", "failed"],
  proposals_ready: ["applied", "failed"],
  applied: [],
  failed: [],
};

export type TransitionRevisionSessionStateInput = {
  nextStatus: RevisionSessionStatus;
  findings_count?: number;
  actionable_findings_count?: number;
  proposal_ready_actionable_findings_count?: number;
  proposals_created_count?: number;
  result_version_id?: string | null;
  summary?: Record<string, unknown>;
  failure_code?: string | null;
  failure_message?: string | null;
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
        `[REVISION-TRANSITIONS] Supabase unavailable - cannot access .${String(prop)}`,
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
    findings_count: row.findings_count ?? 0,
    actionable_findings_count: row.actionable_findings_count ?? 0,
    proposal_ready_actionable_findings_count:
      row.proposal_ready_actionable_findings_count ?? 0,
    proposals_created_count: row.proposals_created_count ?? 0,
    created_at: row.created_at,
    completed_at: row.completed_at,
    last_transition_at: row.last_transition_at,
    failure_code: row.failure_code ?? null,
    failure_message: row.failure_message ?? null,
  };
}

function transitionEventCode(nextStatus: RevisionSessionStatus):
  | "REVISION_SESSION_FINDINGS_READY"
  | "REVISION_SESSION_SYNTHESIS_STARTED"
  | "REVISION_SESSION_PROPOSALS_READY"
  | "REVISION_SESSION_APPLIED"
  | "REVISION_SESSION_FAILED" {
  switch (nextStatus) {
    case "findings_ready":
      return "REVISION_SESSION_FINDINGS_READY";
    case "synthesis_started":
      return "REVISION_SESSION_SYNTHESIS_STARTED";
    case "proposals_ready":
      return "REVISION_SESSION_PROPOSALS_READY";
    case "applied":
      return "REVISION_SESSION_APPLIED";
    case "failed":
      return "REVISION_SESSION_FAILED";
    default:
      throw new Error(`No transition event code defined for status: ${nextStatus}`);
  }
}

function requireTrimmedString(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function toNonNegativeInteger(name: string, value: unknown): number {
  if (value === undefined) {
    throw new Error(`${name} is undefined.`);
  }

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value as number;
}

export function assertValidRevisionSessionTransition(
  currentStatus: RevisionSessionStatus,
  nextStatus: RevisionSessionStatus,
): void {
  if (currentStatus === nextStatus) {
    throw new Error(
      `Illegal revision session transition ${currentStatus} -> ${nextStatus}: no-op transitions are forbidden.`,
    );
  }

  const allowed = REVISION_SESSION_ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Illegal revision session transition ${currentStatus} -> ${nextStatus}. Allowed transitions: ${allowed.join(", ") || "(none)"}.`,
    );
  }
}

export function buildRevisionSessionTransitionUpdate(
  currentSession: RevisionSession,
  input: TransitionRevisionSessionStateInput,
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  assertValidRevisionSessionTransition(currentSession.status, input.nextStatus);

  const update: Record<string, unknown> = {
    status: input.nextStatus,
    last_transition_at: nowIso,
    completed_at:
      input.nextStatus === "applied" || input.nextStatus === "failed" ? nowIso : null,
    failure_code: null,
    failure_message: null,
  };

  if (input.summary !== undefined) {
    update.summary = input.summary;
  }

  if (input.result_version_id !== undefined) {
    update.result_version_id = input.result_version_id;
  }

  if (input.findings_count !== undefined) {
    update.findings_count = toNonNegativeInteger("findings_count", input.findings_count);
  }

  if (input.actionable_findings_count !== undefined) {
    update.actionable_findings_count = toNonNegativeInteger(
      "actionable_findings_count",
      input.actionable_findings_count,
    );
  }

  if (input.proposal_ready_actionable_findings_count !== undefined) {
    update.proposal_ready_actionable_findings_count = toNonNegativeInteger(
      "proposal_ready_actionable_findings_count",
      input.proposal_ready_actionable_findings_count,
    );
  }

  if (input.proposals_created_count !== undefined) {
    update.proposals_created_count = toNonNegativeInteger(
      "proposals_created_count",
      input.proposals_created_count,
    );
  }

  if (input.nextStatus === "applied") {
    update.result_version_id = requireTrimmedString(
      "result_version_id",
      input.result_version_id,
    );
  }

  if (input.nextStatus === "failed") {
    update.failure_code = requireTrimmedString("failure_code", input.failure_code);
    update.failure_message = requireTrimmedString(
      "failure_message",
      input.failure_message,
    );
  }

  return update;
}

export async function transitionRevisionSessionState(
  revisionSessionId: string,
  input: TransitionRevisionSessionStateInput,
): Promise<RevisionSession> {
  const currentSession = await getRevisionSessionById(revisionSessionId);
  if (!currentSession) {
    throw new Error(`Revision session not found: ${revisionSessionId}`);
  }

  let update: Record<string, unknown>;
  try {
    update = buildRevisionSessionTransitionUpdate(currentSession, input);
  } catch (error) {
    void logRevisionEvent({
      revision_session_id: revisionSessionId,
      manuscript_version_id: currentSession.source_version_id,
      evaluation_run_id: currentSession.evaluation_run_id,
      event_type: "session",
      severity: "error",
      event_code: "REVISION_SESSION_TRANSITION_REJECTED",
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        from_status: currentSession.status,
        to_status: input.nextStatus,
      },
    });
    throw error;
  }

  const { data, error } = await supabase
    .from("revision_sessions")
    .update(update)
    .eq("id", revisionSessionId)
    .eq("status", currentSession.status)
    .select("*")
    .single();

  if (error) {
    throw new Error(`transitionRevisionSessionState failed: ${error.message}`);
  }

  const nextSession = mapRevisionSession(data);

  void logRevisionEvent({
    revision_session_id: revisionSessionId,
    manuscript_version_id: nextSession.source_version_id,
    evaluation_run_id: nextSession.evaluation_run_id,
    event_type: "session",
    event_code: transitionEventCode(input.nextStatus),
    message: `Revision session transitioned ${currentSession.status} -> ${input.nextStatus}.`,
    metadata: {
      from_status: currentSession.status,
      to_status: input.nextStatus,
      findings_count: nextSession.findings_count,
      actionable_findings_count: nextSession.actionable_findings_count,
      proposal_ready_actionable_findings_count:
        nextSession.proposal_ready_actionable_findings_count,
      proposals_created_count: nextSession.proposals_created_count,
      failure_code: nextSession.failure_code,
    },
  });

  return nextSession;
}
