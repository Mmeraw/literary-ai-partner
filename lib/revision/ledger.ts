import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import type { WorkbenchOpportunity } from "@/lib/revision/workbenchQueue";
import { logRevisionLedgerAudit } from "@/lib/revision/workbenchQueueAudit";

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
  user?: { id: string; email?: string | null } | null;
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

export type RevisionQualityDriftMetrics = {
  measurement_version: "revision_quality_drift_v1";
  source_word_count: number;
  selected_word_count: number;
  word_count_ratio: number | null;
  vocabulary_retention: number | null;
  pov_source: "first_person" | "second_person" | "third_person" | "none";
  pov_selected: "first_person" | "second_person" | "third_person" | "none";
  pov_shift: boolean;
  tense_source: "past" | "present" | "mixed" | "unknown";
  tense_selected: "past" | "present" | "mixed" | "unknown";
  tense_shift: boolean;
  added_proper_nouns: string[];
  flags: Array<"pov_shift" | "tense_shift" | "low_vocabulary_retention" | "large_length_shift" | "added_proper_nouns">;
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

function normalizedEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivilegedRevisionViewer(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;

  const allowlist = new Set<string>([
    ...normalizedEmailList(process.env.EVALUATION_OPERATOR_EMAILS),
    ...normalizedEmailList(process.env.REVISIONGRADE_ADMIN_EMAILS),
  ]);

  return allowlist.has(email);
}

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

function words(value: string | null | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 0);
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "had", "has", "have", "he", "her", "hers", "him", "his", "i", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our", "ours", "she", "so", "that", "the", "their", "them", "they", "this", "to", "was", "we", "were", "with", "you", "your",
]);

function contentTokenSet(value: string | null | undefined): Set<string> {
  return new Set(words(value).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function vocabularyRetention(source: string, selected: string): number | null {
  const sourceTokens = contentTokenSet(source);
  if (sourceTokens.size === 0) return null;
  const selectedTokens = contentTokenSet(selected);
  let shared = 0;
  for (const token of sourceTokens) {
    if (selectedTokens.has(token)) shared += 1;
  }
  return roundMetric(shared / sourceTokens.size);
}

function detectPov(value: string): RevisionQualityDriftMetrics["pov_source"] {
  const tokenSet = new Set(words(value));
  if (["i", "me", "my", "mine", "we", "us", "our", "ours"].some((token) => tokenSet.has(token))) return "first_person";
  if (["you", "your", "yours"].some((token) => tokenSet.has(token))) return "second_person";
  if (["he", "him", "his", "she", "her", "hers", "they", "them", "their", "theirs"].some((token) => tokenSet.has(token))) return "third_person";
  return "none";
}

function tenseScores(value: string): { past: number; present: number } {
  const list = words(value);
  let past = 0;
  let present = 0;
  for (const word of list) {
    if (["was", "were", "had", "did", "went", "saw", "said", "asked", "looked", "turned", "held", "felt", "knew"].includes(word) || /ed$/.test(word)) {
      past += 1;
    }
    if (["am", "is", "are", "has", "do", "does", "go", "goes", "see", "sees", "say", "says", "ask", "asks", "look", "looks", "turn", "turns", "hold", "holds", "feel", "feels", "know", "knows"].includes(word)) {
      present += 1;
    }
  }
  return { past, present };
}

function detectTense(value: string): RevisionQualityDriftMetrics["tense_source"] {
  const { past, present } = tenseScores(value);
  if (past === 0 && present === 0) return "unknown";
  if (past > 0 && present > 0 && Math.min(past, present) / Math.max(past, present) >= 0.4) return "mixed";
  return past >= present ? "past" : "present";
}

function properNouns(value: string): Set<string> {
  const matches = value.match(/\b[A-Z][A-Za-z’'\-]{2,}\b/g) ?? [];
  return new Set(matches.filter((token) => !["The", "This", "That", "And", "But", "Then", "When", "While", "After", "Before"].includes(token)));
}

function addedProperNouns(source: string, selected: string): string[] {
  const sourceNames = properNouns(source);
  return [...properNouns(selected)].filter((name) => !sourceNames.has(name)).sort();
}

function calculateRevisionQualityDriftMetrics(input: {
  sourceExcerpt: string;
  selectedText: string;
}): RevisionQualityDriftMetrics {
  const sourceWords = words(input.sourceExcerpt).length;
  const selectedWords = words(input.selectedText).length;
  const wordCountRatio = sourceWords > 0 ? roundMetric(selectedWords / sourceWords) : null;
  const retention = vocabularyRetention(input.sourceExcerpt, input.selectedText);
  const povSource = detectPov(input.sourceExcerpt);
  const povSelected = detectPov(input.selectedText);
  const tenseSource = detectTense(input.sourceExcerpt);
  const tenseSelected = detectTense(input.selectedText);
  const names = addedProperNouns(input.sourceExcerpt, input.selectedText);
  const flags: RevisionQualityDriftMetrics["flags"] = [];

  const povShift = povSource !== "none" && povSelected !== "none" && povSource !== povSelected;
  const tenseShift = tenseSource !== "unknown" && tenseSelected !== "unknown" && tenseSource !== "mixed" && tenseSelected !== "mixed" && tenseSource !== tenseSelected;

  if (povShift) flags.push("pov_shift");
  if (tenseShift) flags.push("tense_shift");
  if (retention !== null && retention < 0.25) flags.push("low_vocabulary_retention");
  if (wordCountRatio !== null && (wordCountRatio < 0.4 || wordCountRatio > 2.5)) flags.push("large_length_shift");
  if (names.length > 0) flags.push("added_proper_nouns");

  return {
    measurement_version: "revision_quality_drift_v1",
    source_word_count: sourceWords,
    selected_word_count: selectedWords,
    word_count_ratio: wordCountRatio,
    vocabulary_retention: retention,
    pov_source: povSource,
    pov_selected: povSelected,
    pov_shift: povShift,
    tense_source: tenseSource,
    tense_selected: tenseSelected,
    tense_shift: tenseShift,
    added_proper_nouns: names,
    flags,
  };
}

function metadataWithRevisionQuality(entry: SyncRevisionLedgerEntryInput): Record<string, unknown> {
  const metadata = entry.metadata ?? {};
  const selectedText = entry.selectedText ?? entry.customText ?? null;
  if (!entry.sourceExcerpt || !selectedText) return metadata;

  return {
    ...metadata,
    revision_quality: calculateRevisionQualityDriftMetrics({
      sourceExcerpt: entry.sourceExcerpt,
      selectedText,
    }),
  };
}

async function assertOwnedEvaluation(
  input: {
    manuscriptId: string | number;
    evaluationJobId: string;
    user?: { id: string; email?: string | null } | null;
  },
  options?: { allowPrivilegedRead?: boolean },
) {
  const user =
    input.user && process.env.WORKER_ALLOW_SERVICE_ROLE_DEV === "1"
      ? input.user
      : await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) throw new Error("Invalid manuscript id");

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");

  const privilegedRead = Boolean(options?.allowPrivilegedRead && isPrivilegedRevisionViewer(user));
  const manuscriptOwnerId = typeof manuscript.user_id === "string" ? manuscript.user_id : null;
  const isOwner = manuscriptOwnerId === user.id;
  if (!isOwner && !manuscriptOwnerId) {
    throw new Error("Manuscript ownership metadata is missing");
  }
  if (!isOwner && !privilegedRead) {
    throw new Error("Manuscript not found in your workspace");
  }

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, status")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Evaluation job not found for this manuscript");

  return {
    supabase,
    userId: user.id,
    manuscriptId,
    ledgerUserId: isOwner ? user.id : manuscriptOwnerId,
  };
}

const ACCEPT_DECISIONS = new Set<RevisionLedgerDecision>(["accepted_a", "accepted_b", "accepted_c"]);

function decisionToOption(decision: RevisionLedgerDecision): "A" | "B" | "C" | null {
  if (decision === "accepted_a") return "A";
  if (decision === "accepted_b") return "B";
  if (decision === "accepted_c") return "C";
  return null;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function canonicalTextMatches(selected: string, canonical: string): boolean {
  return normalizeWhitespace(selected).toLowerCase() === normalizeWhitespace(canonical).toLowerCase();
}

function validateEntry(
  entry: SyncRevisionLedgerEntryInput,
  canonicalOpportunityById: Map<string, WorkbenchOpportunity>,
): SyncRevisionLedgerEntryInput {
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

  // Server-side acceptance guard: reload the canonical opportunity from the
  // workbench queue projection and validate the server-derived classification
  // and candidate text. Do not trust client-provided metadata.
  if (ACCEPT_DECISIONS.has(decision)) {
    const expectedOption = decisionToOption(decision);
    const clientOption = normalizeOption(entry.selectedOption);
    if (expectedOption && clientOption && clientOption !== expectedOption) {
      throw new Error("Ledger acceptance blocked: decision and selected option are inconsistent");
    }
    const selectedOption = expectedOption ?? clientOption;
    if (!selectedOption) {
      throw new Error("Ledger acceptance blocked: missing selected option");
    }

    const canonical = canonicalOpportunityById.get(entry.opportunityId);
    if (!canonical) {
      throw new Error("Ledger acceptance blocked: opportunity not found in canonical queue projection");
    }
    if (canonical.cardType !== "copy_paste_rewrite" || canonical.trustedPathStatus !== "eligible") {
      throw new Error("Ledger acceptance blocked: only TrustedPath-eligible copy-paste rewrite cards may be accepted");
    }

    const selectedText = normalizeText(entry.selectedText);
    if (!selectedText) {
      throw new Error("Ledger acceptance blocked: accepted decision must include selected text");
    }
    const canonicalOption = canonical.options.find((option) => option.key === selectedOption);
    if (!canonicalOption) {
      throw new Error("Ledger acceptance blocked: selected option not found in canonical opportunity");
    }
    const canonicalCandidateText = canonicalOption.candidateText || canonicalOption.text;
    if (!canonicalTextMatches(selectedText, canonicalCandidateText)) {
      throw new Error("Ledger acceptance blocked: selected text does not match canonical candidate text");
    }
  }

  return {
    ...entry,
    decision,
    selectedOption: decisionToOption(decision) ?? normalizeOption(entry.selectedOption),
    customText: normalizeText(entry.customText),
    selectedText: normalizeText(entry.selectedText),
    sourceExcerpt: normalizeText(entry.sourceExcerpt),
    sourceLocation: normalizeText(entry.sourceLocation),
  };
}

export async function syncRevisionLedgerDecisions(input: SyncRevisionLedgerInput): Promise<SyncedRevisionLedgerRow[]> {
  const { supabase, userId, manuscriptId } = await assertOwnedEvaluation({
    manuscriptId: input.manuscriptId,
    evaluationJobId: input.evaluationJobId,
    user: input.user,
  }, {
    allowPrivilegedRead: false,
  });

  // Authoritative canonical projection: rebuild the workbench queue from the
  // saved ledger / evaluation artifacts so acceptance is never based on client
  // metadata.
  const queuePayload = await getWorkbenchQueue({
    manuscriptId: String(manuscriptId),
    evaluationJobId: input.evaluationJobId,
  });
  if (!queuePayload.ok) {
    throw new Error(queuePayload.error ?? "Canonical workbench queue projection unavailable");
  }
  const canonicalOpportunities = [
    ...queuePayload.opportunities,
    ...queuePayload.needsTargeting,
    ...queuePayload.withheldUnsupported,
  ];
  const canonicalOpportunityById = new Map(canonicalOpportunities.map((opportunity) => [opportunity.id, opportunity]));

  const entries = Array.isArray(input.entries)
    ? input.entries.map((entry) => validateEntry(entry, canonicalOpportunityById))
    : [];
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
    metadata: metadataWithRevisionQuality(entry),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("revision_ledger_decisions")
    .upsert(rows, { onConflict: "user_id,evaluation_job_id,local_id" })
    .select(LEDGER_SELECT)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const synced = (data ?? []) as SyncedRevisionLedgerRow[];
  logRevisionLedgerAudit({
    type: 'revision-ledger-audit',
    action: 'sync',
    evaluationJobId: input.evaluationJobId,
    manuscriptId: input.manuscriptId,
    decisionCount: synced.length,
    decisionIds: synced.map((row) => row.opportunity_id),
    timestamp: new Date().toISOString(),
  });
  return synced;
}

export const __testing = {
  calculateRevisionQualityDriftMetrics,
};

export async function listRevisionLedgerDecisions(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
  user?: { id: string; email?: string | null } | null;
}): Promise<SyncedRevisionLedgerRow[]> {
  const { supabase, userId, manuscriptId, ledgerUserId } = await assertOwnedEvaluation({
    manuscriptId: input.manuscriptId,
    evaluationJobId: input.evaluationJobId,
    user: input.user,
  }, {
    allowPrivilegedRead: true,
  });
  const targetUserId = ledgerUserId ?? userId;

  const { data, error } = await supabase
    .from("revision_ledger_decisions")
    .select(LEDGER_SELECT)
    .eq("user_id", targetUserId)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const decisions = (data ?? []) as SyncedRevisionLedgerRow[];
  logRevisionLedgerAudit({
    type: 'revision-ledger-audit',
    action: 'read',
    evaluationJobId: input.evaluationJobId,
    manuscriptId: input.manuscriptId,
    decisionCount: decisions.length,
    decisionIds: decisions.map((row) => row.opportunity_id),
    timestamp: new Date().toISOString(),
  });
  return decisions;
}
