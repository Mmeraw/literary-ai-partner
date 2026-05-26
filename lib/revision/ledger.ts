import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export type RevisionLedgerDecision =
  | "accepted_a"
  | "accepted_b"
  | "accepted_c"
  | "custom"
  | "keep_original"
  | "reject"
  | "deferred";

export type SyncRevisionLedgerEntryInput = {
  localId: string;
  opportunityId: string;
  opportunityTitle: string;
  decision: RevisionLedgerDecision;
  selectedOption?: "A" | "B" | "C" | null;
  customText?: string | null;
  selectedText?: string | null;
  sourceExcerpt?: string | null;
  sourceLocation?: string | null;
  clientCreatedAt?: string | null;
  isUndo?: boolean;
  undoneLocalId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SyncRevisionLedgerInput = {
  manuscriptId: string | number;
  evaluationJobId: string;
  entries: SyncRevisionLedgerEntryInput[];
};

export type SyncedRevisionLedgerRow = {
  id: string;
  local_id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: RevisionLedgerDecision;
  selected_option: "A" | "B" | "C" | null;
  custom_text: string | null;
  selected_text: string | null;
  source_excerpt: string | null;
  source_location: string | null;
  client_created_at: string | null;
  client_synced_at: string;
  is_undo: boolean;
  undone_local_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const DECISIONS = new Set<RevisionLedgerDecision>([
  "accepted_a",
  "accepted_b",
  "accepted_c",
  "custom",
  "keep_original",
  "reject",
  "deferred",
]);

const LEDGER_SELECT =
  "id, local_id, opportunity_id, opportunity_title, decision, selected_option, custom_text, selected_text, source_excerpt, source_location, client_created_at, client_synced_at, is_undo, undone_local_id, metadata, created_at, updated_at";

function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function normalizeDecision(value: unknown): RevisionLedgerDecision | null {
  if (typeof value !== "string") return null;
  return DECISIONS.has(value as RevisionLedgerDecision) ? (value as RevisionLedgerDecision) : null;
}

function normalizeOption(value: unknown): "A" | "B" | "C" | null {
  return value === "A" || value === "B" || value === "C" ? value : null;
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function assertOwnedEvaluation(input: { manuscriptId: string | number; evaluationJobId: string }) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) throw new Error("Invalid manuscript id");

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, status")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Evaluation job not found for this manuscript");

  return { supabase, userId: user.id, manuscriptId };
}

function validateEntry(entry: SyncRevisionLedgerEntryInput): SyncRevisionLedgerEntryInput {
  if (!entry || typeof entry !== "object") throw new Error("Invalid ledger entry");
  if (typeof entry.localId !== "string" || entry.localId.trim().length === 0) {
    throw new Error("Ledger entry missing localId");
  }
  if (typeof entry.opportunityId !== "string" || entry.opportunityId.trim().length === 0) {
    throw new Error("Ledger entry missing opportunityId");
  }
  if (typeof entry.opportunityTitle !== "string" || entry.opportunityTitle.trim().length === 0) {
    throw new Error("Ledger entry missing opportunityTitle");
  }
  const decision = normalizeDecision(entry.decision);
  if (!decision) throw new Error(`Invalid ledger decision: ${String(entry.decision)}`);

  return {
    ...entry,
    decision,
    selectedOption: normalizeOption(entry.selectedOption),
    customText: normalizeText(entry.customText),
    selectedText: normalizeText(entry.selectedText),
    sourceExcerpt: normalizeText(entry.sourceExcerpt),
    sourceLocation: normalizeText(entry.sourceLocation),
  };
}

export async function syncRevisionLedgerDecisions(input: SyncRevisionLedgerInput): Promise<SyncedRevisionLedgerRow[]> {
  const { supabase, userId, manuscriptId } = await assertOwnedEvaluation(input);
  const entries = Array.isArray(input.entries) ? input.entries.map(validateEntry) : [];
  if (entries.length === 0) return [];

  const rows = entries.map((entry) => ({
    user_id: userId,
    manuscript_id: manuscriptId,
    evaluation_job_id: input.evaluationJobId,
    finding_id: isUuid(entry.opportunityId) ? entry.opportunityId : null,
    opportunity_id: entry.opportunityId,
    opportunity_title: entry.opportunityTitle,
    decision: entry.decision,
    selected_option: entry.selectedOption ?? null,
    custom_text: entry.customText ?? null,
    selected_text: entry.selectedText ?? entry.customText ?? null,
    source_excerpt: entry.sourceExcerpt ?? null,
    source_location: entry.sourceLocation ?? null,
    local_id: entry.localId,
    client_created_at: entry.clientCreatedAt ?? null,
    client_synced_at: new Date().toISOString(),
    is_undo: Boolean(entry.isUndo),
    undone_local_id: entry.undoneLocalId ?? null,
    metadata: entry.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("revision_ledger_decisions")
    .upsert(rows, { onConflict: "user_id,evaluation_job_id,local_id" })
    .select(LEDGER_SELECT)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SyncedRevisionLedgerRow[];
}

export async function listRevisionLedgerDecisions(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
}): Promise<SyncedRevisionLedgerRow[]> {
  const { supabase, userId, manuscriptId } = await assertOwnedEvaluation(input);

  const { data, error } = await supabase
    .from("revision_ledger_decisions")
    .select(LEDGER_SELECT)
    .eq("user_id", userId)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SyncedRevisionLedgerRow[];
}
