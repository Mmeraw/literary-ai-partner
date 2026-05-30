"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WorkbenchOpportunity, WorkbenchQueuePayload, WorkbenchScope, WorkbenchSource } from "@/lib/revision/workbenchQueue";

type DecisionState = "pending" | "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
type DecisionFilter = "pending" | "accepted" | "custom" | "kept_original" | "rejected" | "deferred";
type SyncStatus = "pending" | "synced" | "failed";
type SeverityBand = "high" | "medium" | "low";
type EvidenceStatus = "has_excerpt" | "has_location" | "manuscript_wide" | "missing_evidence";
type SortOption = "guided" | "priority" | "evidence_first" | "manuscript_order" | "recently_changed";
type QueueType = "repair_plan" | "direct_rewrite";

type LedgerEntry = {
  localId: string;
  serverId?: string;
  at: string;
  createdAtIso: string;
  itemId: string;
  itemTitle: string;
  decision: DecisionState;
  selectedOption?: "A" | "B" | "C";
  customText?: string;
  selectedText?: string;
  sourceExcerpt?: string;
  sourceLocation?: string;
  criterion?: string;
  severity?: WorkbenchOpportunity["severity"];
  scope?: WorkbenchScope;
  queueType?: QueueType;
  source?: WorkbenchSource;
  evidenceStatus?: EvidenceStatus;
  isUndo?: boolean;
  undoneLocalId?: string;
  syncStatus: SyncStatus;
};

type ServerLedgerEntry = {
  id: string;
  local_id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: Exclude<DecisionState, "pending">;
  selected_option: "A" | "B" | "C" | null;
  custom_text: string | null;
  source_excerpt?: string | null;
  source_location?: string | null;
  client_created_at: string | null;
  client_synced_at: string;
  is_undo: boolean;
  undone_local_id: string | null;
};

type LocalWorkbenchCache = {
  version: 1;
  cachedAt: string;
  payload: WorkbenchQueuePayload;
  ledger: LedgerEntry[];
};

type RevisionQueueItem = {
  id: string;
  index: number;
  base: WorkbenchOpportunity;
  criterion: string;
  priority: WorkbenchOpportunity["severity"];
  severity: SeverityBand;
  scope: WorkbenchScope;
  queueType: QueueType;
  source: WorkbenchSource;
  evidenceStatus: EvidenceStatus;
  decisionStatus: DecisionFilter;
  clusterKey?: string;
};

type RevisionCluster = {
  id: string;
  clusterType: "repeated_finding" | "pattern_group" | "related_issues";
  clusterTitle: string;
  baseTitle: string;
  totalInstances: number;
  shownInstances: number;
  hiddenCount: number;
  sharedPriority: "must" | "should" | "could";
  sharedCriterion: string;
  sharedSeverity: "high" | "medium" | "low";
  instances: RevisionQueueItem[];
  evidenceSummary: {
    hasExcerptCount: number;
    hasLocationCount: number;
    manuscriptWideCount: number;
    missingEvidenceCount: number;
  };
  isExpanded: boolean;
  selectedInstanceId?: string;
};

type QueueNode =
  | { kind: "item"; item: RevisionQueueItem }
  | { kind: "cluster"; cluster: RevisionCluster };

type Filters = {
  searchText: string;
  priority: "all" | "must" | "should" | "could";
  criterion: "all" | string;
  severity: "all" | SeverityBand;
  scope: "all" | WorkbenchScope;
  queueType: "all" | QueueType;
  source: "all" | WorkbenchSource;
  evidence: "all" | EvidenceStatus;
  decisionStatus: "all" | DecisionFilter;
  sort: SortOption;
};

type RevisionQueueSummary = {
  total: number;
  visibleTotal: number;
  individualItems: number;
  clusteredItems: number;
  totalClusters: number;
  priorityCounts: {
    must: number;
    should: number;
    could: number;
  };
  evidenceCounts: {
    hasExcerpt: number;
    hasLocation: number;
    manuscriptWide: number;
    missingEvidence: number;
  };
  decisionCounts: {
    pending: number;
    accepted: number;
    custom: number;
    keptOriginal: number;
    rejected: number;
    deferred: number;
  };
  queueHealth: {
    evidenceCompleteness: number;
    clusterRatio: number;
    actionablePercentage: number;
  };
};

const CACHE_PREFIX = "revisiongrade:revise-workbench-v2:v1";
const BATCH_SIZE = 15;

function cacheKey(payload: WorkbenchQueuePayload) {
  const manuscript = payload.manuscriptId ?? "unknown-manuscript";
  const evaluation = payload.evaluationJobId ?? "unknown-evaluation";
  return `${CACHE_PREFIX}:${manuscript}:${evaluation}`;
}

function localId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadLocalCache(key: string): LocalWorkbenchCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalWorkbenchCache;
    if (parsed?.version !== 1 || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalCache(key: string, payload: WorkbenchQueuePayload, ledger: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        cachedAt: new Date().toISOString(),
        payload,
        ledger,
      } satisfies LocalWorkbenchCache),
    );
  } catch {
    // Local cache is resilience-only and should never block decisions.
  }
}

function rowToLedgerEntry(row: ServerLedgerEntry): LedgerEntry {
  const created = row.client_created_at ?? row.client_synced_at ?? new Date().toISOString();
  return {
    localId: row.local_id,
    serverId: row.id,
    at: new Date(created).toLocaleTimeString(),
    createdAtIso: created,
    itemId: row.opportunity_id,
    itemTitle: row.opportunity_title,
    decision: row.decision,
    selectedOption: row.selected_option ?? undefined,
    customText: row.custom_text ?? undefined,
    sourceExcerpt: row.source_excerpt ?? undefined,
    sourceLocation: row.source_location ?? undefined,
    isUndo: row.is_undo,
    undoneLocalId: row.undone_local_id ?? undefined,
    syncStatus: "synced",
  };
}

function mergeLedger(local: LedgerEntry[], remote: LedgerEntry[]) {
  const byLocalId = new Map<string, LedgerEntry>();
  [...remote, ...local].forEach((entry) => {
    const existing = byLocalId.get(entry.localId);
    if (!existing || existing.syncStatus !== "pending") {
      byLocalId.set(entry.localId, entry);
    }
  });
  return [...byLocalId.values()].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

function decisionFilterOf(decision: DecisionState | undefined): DecisionFilter {
  if (!decision || decision === "pending") return "pending";
  if (decision === "custom") return "custom";
  if (decision === "keep_original") return "kept_original";
  if (decision === "reject") return "rejected";
  if (decision === "deferred") return "deferred";
  return "accepted";
}

function rebuildDecisionMap(entries: LedgerEntry[]): Record<string, DecisionState> {
  const undoneIds = new Set<string>();
  for (const entry of entries) {
    if (entry.isUndo && entry.undoneLocalId) undoneIds.add(entry.undoneLocalId);
  }

  const next: Record<string, DecisionState> = {};
  for (const entry of entries) {
    if (entry.decision === "pending") continue;
    if (entry.isUndo) continue;
    if (undoneIds.has(entry.localId)) continue;
    if (!(entry.itemId in next)) {
      next[entry.itemId] = entry.decision;
    }
  }

  return next;
}

function criterionOf(item: WorkbenchOpportunity) {
  return item.crumb.split(" · ")[0]?.trim() || "General";
}

function severityBandOf(item: WorkbenchOpportunity): SeverityBand {
  if (item.severity === "must") return "high";
  if (item.severity === "should") return "medium";
  return "low";
}

function queueTypeOf(item: WorkbenchOpportunity): QueueType {
  return item.mode === "repair-brief" ? "repair_plan" : "direct_rewrite";
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function clusterHintForTitle(title: string): { key: string; label: string } | null {
  const norm = normalizeTitle(title);
  if (norm.includes("long paragraph")) {
    return { key: "pattern:long_paragraph", label: "Long paragraph pacing pattern" };
  }
  if (norm.includes("long sentence")) {
    return { key: "pattern:long_sentence", label: "Long sentence density pattern" };
  }
  return null;
}

function evidenceStatusOf(item: WorkbenchOpportunity): EvidenceStatus {
  const quote = `${item.quoteHighlight ?? ""} ${item.quoteRest ?? ""}`.trim().toLowerCase();
  const anchor = (item.anchor ?? "").trim().toLowerCase();

  const hasExcerpt = !!item.quoteHighlight && item.quoteHighlight !== "No excerpt available";

  const hasLocation = !!anchor && anchor !== "location pending" && !anchor.includes("pending");

  if (hasExcerpt) return "has_excerpt";
  if (hasLocation) return "has_location";

  if (quote.includes("across the manuscript") || quote.includes("manuscript-wide")) {
    return "manuscript_wide";
  }

  return "missing_evidence";
}

function sourceLabel(source: WorkbenchSource): string {
  if (source === "baseline_discovery") return "Discovery";
  if (source === "deep_revision") return "Deep revision";
  return "Evaluation";
}

function severityClasses(priority: WorkbenchOpportunity["severity"]) {
  switch (priority) {
    case "must":
      return "bg-[#7A2B1A]/30 text-[#E9B19F] border border-[#7A2B1A]/50";
    case "should":
      return "bg-[#C8A96E]/20 text-[#E9D9B7] border border-[#C8A96E]/45";
    case "could":
      return "bg-[#2D3B2A]/35 text-[#B8D6AD] border border-[#48603F]/50";
  }
}

function evidenceBadgeClasses(status: EvidenceStatus) {
  if (status === "has_excerpt") return "border-[#48603F]/70 bg-[#2D3B2A]/35 text-[#B8D6AD]";
  if (status === "has_location") return "border-[#5D4C31] bg-[#231C12] text-[#D8C6A4]";
  if (status === "manuscript_wide") return "border-[#6E5B3B] bg-[#2B2215] text-[#E4D3B5]";
  return "border-[#7A2B1A]/70 bg-[#7A2B1A]/20 text-[#E9B19F]";
}

function evidenceLabel(status: EvidenceStatus) {
  if (status === "has_excerpt") return "Has excerpt";
  if (status === "has_location") return "Has location";
  if (status === "manuscript_wide") return "Manuscript-wide";
  return "Needs evidence";
}

function optionRoleLabel(key: "A" | "B" | "C") {
  if (key === "A") return "A — Recommended Repair";
  if (key === "B") return "B — Rhythm Variant";
  return "C — Bolder Rendering Shift";
}

function decisionLabel(entry: LedgerEntry) {
  switch (entry.decision) {
    case "accepted_a":
    case "accepted_b":
    case "accepted_c":
      return `Accepted ${entry.selectedOption}`;
    case "keep_original":
      return "Kept original";
    case "reject":
      return "Rejected";
    case "custom":
      return "Custom";
    case "deferred":
      return "Deferred";
    default:
      return "Pending";
  }
}

function EmptyWorkbench({ payload, cachedAt }: { payload: WorkbenchQueuePayload; cachedAt?: string | null }) {
  const isFirstLoad = !cachedAt && payload.error && !payload.error.includes("not found") && !payload.error.includes("sign in");

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-6 text-[#F5EFE4] md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Revise Workspace · live queue</p>
        <h1 className="mt-3 text-4xl text-[#F8F1E6]" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
          {isFirstLoad ? "Building your guided queue…" : "No guided revision queue available yet."}
        </h1>
        <p className="mt-4 leading-7 text-[#CBBDA4]">
          {isFirstLoad
            ? "RevisionGrade is generating opportunities from your completed evaluation. This usually takes a moment — try refreshing the page."
            : (payload.error ?? "This evaluation did not persist revision opportunities.")}
        </p>
        {cachedAt && <p className="mt-3 text-sm text-[#A9987D]">Last local cache: {cachedAt}</p>}
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <button
            onClick={() => window.location.reload()}
            className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-1.5 font-semibold text-[#C8A96E] transition hover:bg-[#C8A96E]/20"
          >
            Refresh
          </button>
          <Link href="/workbench" className="rounded border border-[#6D5A3B] px-3 py-1.5 text-[#E8D8BA] hover:border-[#C8A96E]">Reference Workbench</Link>
        </div>
      </div>
    </main>
  );
}

export default function ReviseQueueV2Client({ payload }: { payload: WorkbenchQueuePayload }) {
  const [cachedPayload, setCachedPayload] = useState<WorkbenchQueuePayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const effectivePayload = payload.ok && payload.opportunities.length > 0 ? payload : (cachedPayload ?? payload);
  const opportunities = effectivePayload.opportunities;
  const key = cacheKey(effectivePayload);

  const [activeId, setActiveId] = useState<string>(opportunities[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C">("A");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [decisionById, setDecisionById] = useState<Record<string, DecisionState>>({});
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});
  const [isRetryingFailedSync, setIsRetryingFailedSync] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    searchText: "",
    priority: "all",
    criterion: "all",
    severity: "all",
    scope: "all",
    queueType: "all",
    source: "all",
    evidence: "all",
    decisionStatus: "all",
    sort: "guided",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (payload.ok && payload.opportunities.length === 0) {
      const retryKey = `revisiongrade:workbench-v2-autoretry:${payload.manuscriptId}:${payload.evaluationJobId}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, "1");
        const timer = setTimeout(() => window.location.reload(), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [payload]);

  useEffect(() => {
    const liveKey = cacheKey(payload);
    const cached = loadLocalCache(liveKey);
    if (cached) {
      setCachedPayload(cached.payload);
      setCachedAt(cached.cachedAt);
      setLedger(cached.ledger ?? []);
      setDecisionById(rebuildDecisionMap(cached.ledger ?? []));
      setActiveId((current) => current || cached.payload.opportunities[0]?.id || "");
    }

    if (payload.ok && payload.opportunities.length > 0) {
      saveLocalCache(liveKey, payload, cached?.ledger ?? []);
      setCachedPayload(payload);
      setCachedAt(new Date().toISOString());
      setActiveId((current) => current || payload.opportunities[0]?.id || "");
    }
  }, [payload]);

  useEffect(() => {
    if (!effectivePayload.ok || effectivePayload.opportunities.length === 0) return;
    saveLocalCache(key, effectivePayload, ledger);
    setCachedAt(new Date().toISOString());
  }, [effectivePayload, key, ledger]);

  useEffect(() => {
    if (!isOnline || !effectivePayload.manuscriptId || !effectivePayload.evaluationJobId) return;
    let cancelled = false;

    async function loadServerLedger() {
      try {
        const params = new URLSearchParams({
          manuscriptId: effectivePayload.manuscriptId ?? "",
          evaluationJobId: effectivePayload.evaluationJobId ?? "",
        });
        const response = await fetch(`/api/revision-ledger?${params.toString()}`);
        if (!response.ok) return;
        const json = await response.json();
        if (!json?.ok || !Array.isArray(json.entries) || cancelled) return;
        const remote = (json.entries as ServerLedgerEntry[]).map(rowToLedgerEntry);
        setLedger((current) => {
          const merged = mergeLedger(current, remote);
          setDecisionById(rebuildDecisionMap(merged));
          saveLocalCache(key, effectivePayload, merged);
          return merged;
        });
      } catch {
        // keep local state as source of truth until sync succeeds
      }
    }

    void loadServerLedger();
    return () => {
      cancelled = true;
    };
  }, [effectivePayload, isOnline, key]);

  useEffect(() => {
    if (!isOnline || !effectivePayload.manuscriptId || !effectivePayload.evaluationJobId) return;
    const pendingEntries = ledger.filter((entry) => entry.syncStatus !== "synced" && entry.decision !== "pending");
    if (pendingEntries.length === 0) return;
    let cancelled = false;

    async function syncPending() {
      try {
        const response = await fetch("/api/revision-ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manuscriptId: effectivePayload.manuscriptId,
            evaluationJobId: effectivePayload.evaluationJobId,
            entries: pendingEntries.map((entry) => ({
              localId: entry.localId,
              opportunityId: entry.itemId,
              opportunityTitle: entry.itemTitle,
              decision: entry.decision,
              selectedOption: entry.selectedOption ?? null,
              customText: entry.customText ?? null,
              selectedText: entry.selectedText ?? entry.customText ?? null,
              sourceExcerpt: entry.sourceExcerpt ?? null,
              sourceLocation: entry.sourceLocation ?? null,
              clientCreatedAt: entry.createdAtIso,
              isUndo: entry.isUndo ?? false,
              undoneLocalId: entry.undoneLocalId ?? null,
              metadata: {
                source: "workbench-v2-local-first",
                criterion: entry.criterion ?? null,
                severity: entry.severity ?? null,
                scope: entry.scope ?? null,
                queueType: entry.queueType ?? null,
                opportunitySource: entry.source ?? null,
                evidenceStatus: entry.evidenceStatus ?? null,
              },
            })),
          }),
        });

        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !Array.isArray(json.entries)) {
          throw new Error(json?.error ?? "Ledger sync failed");
        }

        const syncedIds = new Map((json.entries as ServerLedgerEntry[]).map((row) => [row.local_id, row]));
        if (cancelled) return;

        setLedger((current) => {
          const next = current.map((entry) => {
            const row = syncedIds.get(entry.localId);
            if (!row) return entry;
            return { ...entry, serverId: row.id, syncStatus: "synced" as const };
          });
          saveLocalCache(key, effectivePayload, next);
          return next;
        });
        setSyncMessage("Synced");
      } catch (error) {
        if (cancelled) return;
        setLedger((current) =>
          current.map((entry) =>
            pendingEntries.some((p) => p.localId === entry.localId)
              ? { ...entry, syncStatus: "failed" as const }
              : entry,
          ),
        );
        setSyncMessage(error instanceof Error ? error.message : "Ledger sync failed");
      }
    }

    void syncPending();
    return () => {
      cancelled = true;
    };
  }, [effectivePayload, isOnline, key, ledger]);

  const enriched = useMemo<RevisionQueueItem[]>(() => {
    const byTitle = new Map<string, number>();
    for (const item of opportunities) {
      const norm = normalizeTitle(item.title);
      byTitle.set(norm, (byTitle.get(norm) ?? 0) + 1);
    }

    return opportunities.map((base, index) => {
      const criterion = criterionOf(base);
      const hint = clusterHintForTitle(base.title);
      const normalized = normalizeTitle(base.title);
      const duplicateCount = byTitle.get(normalized) ?? 0;

      let clusterKey: string | undefined;
      if (hint) {
        clusterKey = hint.key;
      } else if (duplicateCount >= 3) {
        clusterKey = `dup:${normalized}`;
      }

      const decision = decisionById[base.id];

      return {
        id: base.id,
        index,
        base,
        criterion,
        priority: base.severity,
        severity: severityBandOf(base),
        scope: base.scope,
        queueType: queueTypeOf(base),
        source: base.source,
        evidenceStatus: evidenceStatusOf(base),
        decisionStatus: decisionFilterOf(decision),
        clusterKey,
      };
    });
  }, [opportunities, decisionById]);

  const criteriaOptions = useMemo(() => {
    return [...new Set(enriched.map((item) => item.criterion))].sort();
  }, [enriched]);

  const filtered = useMemo(() => {
    const search = filters.searchText.trim().toLowerCase();

    return enriched.filter((item) => {
      if (search) {
        const haystack = `${item.base.title} ${item.base.symptom} ${item.base.crumb} ${item.base.meta}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.priority !== "all" && item.priority !== filters.priority) return false;
      if (filters.criterion !== "all" && item.criterion !== filters.criterion) return false;
      if (filters.severity !== "all" && item.severity !== filters.severity) return false;
      if (filters.scope !== "all" && item.scope !== filters.scope) return false;
      if (filters.queueType !== "all" && item.queueType !== filters.queueType) return false;
      if (filters.source !== "all" && item.source !== filters.source) return false;
      if (filters.evidence !== "all" && item.evidenceStatus !== filters.evidence) return false;
      if (filters.decisionStatus !== "all" && item.decisionStatus !== filters.decisionStatus) return false;
      return true;
    });
  }, [enriched, filters]);

  const sorted = useMemo(() => {
    const orderPriority: Record<WorkbenchOpportunity["severity"], number> = { must: 0, should: 1, could: 2 };
    const orderEvidence: Record<EvidenceStatus, number> = {
      has_excerpt: 0,
      has_location: 1,
      manuscript_wide: 2,
      missing_evidence: 3,
    };
    const orderScope: Record<WorkbenchScope, number> = {
      Structural: 0,
      Scene: 1,
      Chapter: 2,
      Passage: 3,
      Line: 4,
      Manuscript: 5,
    };

    const lastChangedById = new Map<string, string>();
    for (const entry of ledger) {
      if (!lastChangedById.has(entry.itemId)) {
        lastChangedById.set(entry.itemId, entry.createdAtIso);
      }
    }

    return [...filtered].sort((a, b) => {
      if (filters.sort === "manuscript_order") {
        return a.index - b.index;
      }

      if (filters.sort === "recently_changed") {
        const aTime = lastChangedById.get(a.id) ?? "";
        const bTime = lastChangedById.get(b.id) ?? "";
        return bTime.localeCompare(aTime) || a.index - b.index;
      }

      if (filters.sort === "priority") {
        return orderPriority[a.priority] - orderPriority[b.priority]
          || orderEvidence[a.evidenceStatus] - orderEvidence[b.evidenceStatus]
          || a.index - b.index;
      }

      if (filters.sort === "evidence_first") {
        return orderEvidence[a.evidenceStatus] - orderEvidence[b.evidenceStatus]
          || orderPriority[a.priority] - orderPriority[b.priority]
          || a.index - b.index;
      }

      return orderEvidence[a.evidenceStatus] - orderEvidence[b.evidenceStatus]
        || orderPriority[a.priority] - orderPriority[b.priority]
        || orderScope[a.scope] - orderScope[b.scope]
        || a.index - b.index;
    });
  }, [filtered, filters.sort, ledger]);

  const queueNodes = useMemo<QueueNode[]>(() => {
    const grouped = new Map<string, RevisionQueueItem[]>();
    const ungrouped: RevisionQueueItem[] = [];

    for (const item of sorted) {
      if (item.clusterKey) {
        const group = grouped.get(item.clusterKey) ?? [];
        group.push(item);
        grouped.set(item.clusterKey, group);
      } else {
        ungrouped.push(item);
      }
    }

    const clustersByKey = new Map<string, RevisionCluster>();
    for (const [clusterKey, instances] of grouped) {
      if (instances.length < 3) {
        for (const fallback of instances) ungrouped.push(fallback);
        continue;
      }

      const first = instances[0];
      const hint = clusterHintForTitle(first.base.title);
      const clusterTitle = hint?.label ?? first.base.title;
      const shownInstances = Math.min(12, instances.length);
      const evidenceSummary = {
        hasExcerptCount: instances.filter((i) => i.evidenceStatus === "has_excerpt").length,
        hasLocationCount: instances.filter((i) => i.evidenceStatus === "has_location").length,
        manuscriptWideCount: instances.filter((i) => i.evidenceStatus === "manuscript_wide").length,
        missingEvidenceCount: instances.filter((i) => i.evidenceStatus === "missing_evidence").length,
      };

      clustersByKey.set(clusterKey, {
        id: clusterKey,
        clusterType: "repeated_finding",
        clusterTitle,
        baseTitle: first.base.title,
        totalInstances: instances.length,
        shownInstances,
        hiddenCount: Math.max(0, instances.length - shownInstances),
        sharedPriority: first.priority,
        sharedCriterion: first.criterion,
        sharedSeverity: first.severity,
        instances,
        evidenceSummary,
        isExpanded: !!expandedClusters[clusterKey],
        selectedInstanceId: instances.find((i) => i.id === activeId)?.id,
      });
    }

    const nodes: Array<{ order: number; node: QueueNode }> = [];

    for (const item of ungrouped) {
      nodes.push({ order: item.index, node: { kind: "item", item } });
    }

    for (const cluster of clustersByKey.values()) {
      const order = Math.min(...cluster.instances.map((instance) => instance.index));
      nodes.push({ order, node: { kind: "cluster", cluster } });
    }

    return nodes.sort((a, b) => a.order - b.order).map((entry) => entry.node);
  }, [sorted, expandedClusters, activeId]);

  const totalPages = Math.max(1, Math.ceil(queueNodes.length / BATCH_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * BATCH_SIZE;
  const pageNodes = queueNodes.slice(pageStart, pageStart + BATCH_SIZE);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, Math.max(1, Math.ceil(queueNodes.length / BATCH_SIZE))));
  }, [queueNodes.length]);

  useEffect(() => {
    if (pageNodes.length === 0) {
      setActiveId("");
      return;
    }

    const pageItemIds = new Set<string>();
    for (const node of pageNodes) {
      if (node.kind === "item") {
        pageItemIds.add(node.item.id);
      } else {
        node.cluster.instances.forEach((instance) => pageItemIds.add(instance.id));
      }
    }

    if (activeId && pageItemIds.has(activeId)) return;

    const first = pageNodes[0];
    if (first.kind === "item") {
      setActiveId(first.item.id);
    } else {
      setActiveId(first.cluster.instances[0]?.id ?? "");
    }
  }, [pageNodes, activeId]);

  const active = useMemo(() => {
    return enriched.find((item) => item.id === activeId) ?? enriched[0];
  }, [enriched, activeId]);

  const selectedProposal = useMemo(() => {
    return active?.base.options.find((option) => option.key === selectedOption) ?? active?.base.options[0];
  }, [active, selectedOption]);

  const summary = useMemo<RevisionQueueSummary>(() => {
    const total = enriched.length;
    const visibleTotal = sorted.length;
    const totalClusters = queueNodes.filter((node) => node.kind === "cluster").length;
    const clusteredItems = queueNodes
      .filter((node): node is { kind: "cluster"; cluster: RevisionCluster } => node.kind === "cluster")
      .reduce((acc, node) => acc + node.cluster.totalInstances, 0);

    const evidenceCounts = {
      hasExcerpt: enriched.filter((item) => item.evidenceStatus === "has_excerpt").length,
      hasLocation: enriched.filter((item) => item.evidenceStatus === "has_location").length,
      manuscriptWide: enriched.filter((item) => item.evidenceStatus === "manuscript_wide").length,
      missingEvidence: enriched.filter((item) => item.evidenceStatus === "missing_evidence").length,
    };

    const decisionCounts = {
      pending: enriched.filter((item) => item.decisionStatus === "pending").length,
      accepted: enriched.filter((item) => item.decisionStatus === "accepted").length,
      custom: enriched.filter((item) => item.decisionStatus === "custom").length,
      keptOriginal: enriched.filter((item) => item.decisionStatus === "kept_original").length,
      rejected: enriched.filter((item) => item.decisionStatus === "rejected").length,
      deferred: enriched.filter((item) => item.decisionStatus === "deferred").length,
    };

    const evidenceCompleteness = total === 0 ? 0 : Math.round(((evidenceCounts.hasExcerpt + evidenceCounts.hasLocation + evidenceCounts.manuscriptWide) / total) * 100);
    const clusterRatio = total === 0 ? 0 : Math.round((clusteredItems / total) * 100);
    const actionablePercentage = total === 0 ? 0 : Math.round(((total - evidenceCounts.missingEvidence) / total) * 100);

    return {
      total,
      visibleTotal,
      individualItems: queueNodes.filter((node) => node.kind === "item").length,
      clusteredItems,
      totalClusters,
      priorityCounts: {
        must: enriched.filter((item) => item.priority === "must").length,
        should: enriched.filter((item) => item.priority === "should").length,
        could: enriched.filter((item) => item.priority === "could").length,
      },
      evidenceCounts,
      decisionCounts,
      queueHealth: {
        evidenceCompleteness,
        clusterRatio,
        actionablePercentage,
      },
    };
  }, [enriched, queueNodes, sorted.length]);

  const pendingSync = ledger.filter((entry) => entry.syncStatus !== "synced").length;
  const failedSyncCount = ledger.filter((entry) => entry.syncStatus === "failed").length;

  const activeEvidence = active ? active.evidenceStatus : "missing_evidence";
  const canAccept = activeEvidence !== "missing_evidence";

  const referenceHref = useMemo(() => {
    const params = new URLSearchParams();
    if (effectivePayload.manuscriptId) params.set("manuscriptId", effectivePayload.manuscriptId);
    if (effectivePayload.evaluationJobId) params.set("evaluationJobId", effectivePayload.evaluationJobId);
    const query = params.toString();
    return query ? `/workbench?${query}` : "/workbench";
  }, [effectivePayload.evaluationJobId, effectivePayload.manuscriptId]);

  if (!effectivePayload.ok || opportunities.length === 0 || !active) {
    return <EmptyWorkbench payload={effectivePayload} cachedAt={cachedAt} />;
  }

  function moveToOpportunity(itemId: string) {
    setActiveId(itemId);
    setSelectedOption("A");
    setIsDraftOpen(false);
    setDraftText("");
  }

  function moveToNextOpportunity(fromId: string) {
    const orderedIds = sorted.map((item) => item.id);
    const currentIndex = orderedIds.indexOf(fromId);
    if (currentIndex === -1) return;
    const nextId = orderedIds[currentIndex + 1];
    if (nextId) {
      moveToOpportunity(nextId);
    }
  }

  function stampDecision(decision: DecisionState, customText?: string) {
    const normalized = decision === "accepted_a" || decision === "accepted_b" || decision === "accepted_c"
      ? (`accepted_${selectedOption.toLowerCase()}` as DecisionState)
      : decision;

    const createdAtIso = new Date().toISOString();
    const resolvedSelectedText = normalized.startsWith("accepted")
      ? selectedProposal?.text ?? undefined
      : customText?.trim() || undefined;

    const entry: LedgerEntry = {
      localId: localId(),
      at: new Date(createdAtIso).toLocaleTimeString(),
      createdAtIso,
      itemId: active.id,
      itemTitle: active.base.title,
      decision: normalized,
      selectedOption: normalized.startsWith("accepted") ? selectedOption : undefined,
      customText: customText?.trim() || undefined,
      selectedText: resolvedSelectedText,
      sourceExcerpt: active.base.quoteHighlight && active.base.quoteHighlight !== "No excerpt available"
        ? `${active.base.quoteHighlight}${active.base.quoteRest ?? ""}`.trim()
        : undefined,
      sourceLocation: active.base.anchor,
      criterion: active.criterion,
      severity: active.priority,
      scope: active.scope,
      queueType: active.queueType,
      source: active.source,
      evidenceStatus: active.evidenceStatus,
      syncStatus: "pending",
    };

    const nextLedger = [entry, ...ledger];
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    saveLocalCache(key, effectivePayload, nextLedger);
    moveToNextOpportunity(active.id);
  }

  function retryFailedSyncEntries() {
    if (failedSyncCount === 0) return;
    setIsRetryingFailedSync(true);
    setLedger((current) => {
      const next = current.map((entry) => entry.syncStatus === "failed" ? { ...entry, syncStatus: "pending" as const } : entry);
      saveLocalCache(key, effectivePayload, next);
      return next;
    });
    setSyncMessage("Retrying failed sync entries…");
    setTimeout(() => setIsRetryingFailedSync(false), 250);
  }

  function undoLedgerEntry(index: number) {
    const removed = ledger[index];
    if (!removed) return;

    const createdAtIso = new Date().toISOString();
    const undoEntry: LedgerEntry = {
      localId: localId(),
      at: new Date(createdAtIso).toLocaleTimeString(),
      createdAtIso,
      itemId: removed.itemId,
      itemTitle: removed.itemTitle,
      decision: "keep_original",
      isUndo: true,
      undoneLocalId: removed.localId,
      syncStatus: "pending",
    };

    const nextLedger = [undoEntry, ...ledger];
    setLedger(nextLedger);
    setDecisionById(rebuildDecisionMap(nextLedger));
    saveLocalCache(key, effectivePayload, nextLedger);
    moveToOpportunity(removed.itemId);
  }

  function updateFilter<K extends keyof Filters>(keyName: K, value: Filters[K]) {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, [keyName]: value }));
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0D0A05] px-4 py-4 text-[#F5EFE4] md:px-6 md:py-5">
      <div className="mx-auto flex h-full max-w-[1700px] min-h-0 flex-col">
        <header className="mb-3 shrink-0 rounded-xl border border-[#3A3022] bg-[#1C160E]/80 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96E]">Revise Workspace · live queue</p>
              <h1 className="mt-2 text-3xl leading-tight text-[#F8F1E6] md:text-4xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>
                {effectivePayload.manuscriptTitle}
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-[#CBBDA4]">
                {summary.priorityCounts.must > 0
                  ? "Review highest-impact, evidence-backed recommendations first."
                  : "No MUST repairs found. Start with SHOULD recommendations, then review COULD-level refinements."}
              </p>
            </div>
            <Link href={referenceHref} className="rounded border border-[#5D4C31] px-3 py-2 text-xs text-[#E8DABF] hover:border-[#C8A96E]">
              Current reference page
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className={`rounded border px-2 py-1 ${isOnline ? "border-[#48603F] text-[#B8D6AD]" : "border-[#7A2B1A]/70 text-[#E9B19F]"}`}>{isOnline ? "Online" : "Offline"}</span>
            <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#D8C6A4]">Local cache active</span>
            <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#D8C6A4]">Server ledger enabled</span>
            {pendingSync > 0 && <span className="rounded border border-[#C8A96E]/45 px-2 py-1 text-[#E9D9B7]">{pendingSync} pending sync</span>}
            {failedSyncCount > 0 && (
              <button
                type="button"
                disabled={isRetryingFailedSync}
                onClick={retryFailedSyncEntries}
                className="rounded border border-[#7A2B1A]/70 px-2 py-1 text-[#E9B19F] hover:bg-[#7A2B1A]/20 disabled:opacity-50"
              >
                Retry failed sync ({failedSyncCount})
              </button>
            )}
            {syncMessage && <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D]">{syncMessage}</span>}
            {cachedAt && <span className="rounded border border-[#5D4C31] px-2 py-1 text-[#A9987D]">Cached {new Date(cachedAt).toLocaleString()}</span>}
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-[#2D2519] bg-[#110D07] p-3 text-xs text-[#D8C6A4] md:grid-cols-2 xl:grid-cols-4">
            <div><span className="text-[#C8A96E]">Total:</span> {summary.total} opportunities</div>
            <div><span className="text-[#C8A96E]">Priority:</span> {summary.priorityCounts.must} MUST · {summary.priorityCounts.should} SHOULD · {summary.priorityCounts.could} COULD</div>
            <div><span className="text-[#C8A96E]">Decisions:</span> Accepted {summary.decisionCounts.accepted} · Custom {summary.decisionCounts.custom} · Pending {summary.decisionCounts.pending}</div>
            <div><span className="text-[#C8A96E]">Queue health:</span> Evidence {summary.queueHealth.evidenceCompleteness}% · Clustered {summary.queueHealth.clusterRatio}%</div>
          </div>
        </header>

        <section className="z-20 mb-3 shrink-0 rounded-xl border border-[#3A3022] bg-[#161109]/95 p-3 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={filters.searchText}
              onChange={(event) => updateFilter("searchText", event.target.value)}
              placeholder="Search queue"
              className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm text-[#F5EFE4] outline-none focus:border-[#C8A96E]"
            />

            <select value={filters.priority} onChange={(event) => updateFilter("priority", event.target.value as Filters["priority"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Priority: All</option>
              <option value="must">Must</option>
              <option value="should">Should</option>
              <option value="could">Could</option>
            </select>

            <select value={filters.criterion} onChange={(event) => updateFilter("criterion", event.target.value)} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Criterion: All</option>
              {criteriaOptions.map((criterion) => (
                <option key={criterion} value={criterion}>{criterion}</option>
              ))}
            </select>

            <select value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value as Filters["severity"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Severity: All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select value={filters.scope} onChange={(event) => updateFilter("scope", event.target.value as Filters["scope"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Scope: All</option>
              <option value="Manuscript">Manuscript</option>
              <option value="Structural">Structural</option>
              <option value="Chapter">Chapter</option>
              <option value="Scene">Scene</option>
              <option value="Passage">Passage</option>
              <option value="Line">Line</option>
            </select>

            <select value={filters.queueType} onChange={(event) => updateFilter("queueType", event.target.value as Filters["queueType"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Type: All</option>
              <option value="repair_plan">Repair plan</option>
              <option value="direct_rewrite">Direct rewrite</option>
            </select>

            <select value={filters.source} onChange={(event) => updateFilter("source", event.target.value as Filters["source"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Source: All</option>
              <option value="evaluation">Evaluation</option>
              <option value="deep_revision">Deep revision</option>
              <option value="baseline_discovery">Discovery</option>
            </select>

            <select value={filters.evidence} onChange={(event) => updateFilter("evidence", event.target.value as Filters["evidence"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Evidence: All</option>
              <option value="has_excerpt">Has excerpt</option>
              <option value="has_location">Has location</option>
              <option value="manuscript_wide">Manuscript-wide</option>
              <option value="missing_evidence">Needs evidence</option>
            </select>

            <select value={filters.decisionStatus} onChange={(event) => updateFilter("decisionStatus", event.target.value as Filters["decisionStatus"])} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="all">Status: All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="custom">Custom</option>
              <option value="kept_original">Kept original</option>
              <option value="rejected">Rejected</option>
              <option value="deferred">Deferred</option>
            </select>

            <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as SortOption)} className="rounded border border-[#3A3022] bg-[#0D0A05] px-3 py-2 text-sm">
              <option value="guided">Sort: Highest impact first</option>
              <option value="priority">Priority first</option>
              <option value="evidence_first">Evidence first</option>
              <option value="manuscript_order">Manuscript order</option>
              <option value="recently_changed">Recently changed</option>
            </select>
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_300px]">
          <aside className="min-h-0 overflow-y-auto rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">First Revision Set</h2>
              <button
                type="button"
                onClick={() => updateFilter("evidence", "missing_evidence")}
                className="rounded border border-[#7A2B1A]/60 px-2 py-1 text-[11px] text-[#E9B19F] hover:bg-[#7A2B1A]/20"
              >
                Needs evidence ({summary.evidenceCounts.missingEvidence})
              </button>
            </div>
            <p className="mb-4 text-xs text-[#A9987D]">Showing {queueNodes.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + BATCH_SIZE, queueNodes.length)} of {queueNodes.length} opportunities</p>

            <ol className="space-y-3">
              {pageNodes.map((node) => {
                if (node.kind === "item") {
                  const item = node.item;
                  const activeCard = active.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => moveToOpportunity(item.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${activeCard ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#110D07] hover:border-[#5D4C31]"}`}
                      >
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${severityClasses(item.priority)}`}>{item.priority}</span>
                          <span className="rounded border border-[#4E4333] bg-[#1B150E] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#D6C3A2]">{item.scope}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${evidenceBadgeClasses(item.evidenceStatus)}`}>{evidenceLabel(item.evidenceStatus)}</span>
                        </div>
                        <p className="text-sm text-[#F2E7D4]">{item.base.title}</p>
                        <p className="mt-1 text-xs text-[#AA9A7F]">{item.base.meta}</p>
                      </button>
                    </li>
                  );
                }

                const cluster = node.cluster;
                const isExpanded = !!expandedClusters[cluster.id];
                const isActiveCluster = !!cluster.instances.find((instance) => instance.id === active.id);
                const shown = isExpanded ? cluster.instances : cluster.instances.slice(0, cluster.shownInstances);

                return (
                  <li key={cluster.id} className={`rounded-lg border p-3 ${isActiveCluster ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2B241A] bg-[#110D07]"}`}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#F2E7D4]">{cluster.clusterTitle}</p>
                        <p className="text-xs text-[#AA9A7F]">Found in {cluster.totalInstances} locations. Showing top {cluster.shownInstances} examples.</p>
                      </div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${severityClasses(cluster.sharedPriority)}`}>{cluster.sharedPriority}</span>
                    </div>

                    <div className="mb-2 text-[11px] text-[#BDAE91]">
                      {cluster.sharedCriterion} · Evidence: excerpt {cluster.evidenceSummary.hasExcerptCount} · location {cluster.evidenceSummary.hasLocationCount} · needs evidence {cluster.evidenceSummary.missingEvidenceCount}
                    </div>

                    <ol className="space-y-1.5">
                      {shown.map((instance) => (
                        <li key={instance.id}>
                          <button
                            type="button"
                            onClick={() => moveToOpportunity(instance.id)}
                            className={`w-full rounded border px-2 py-1 text-left text-xs ${active.id === instance.id ? "border-[#C8A96E] bg-[#2B2114] text-[#F3E8D3]" : "border-[#2D2519] bg-[#161109] text-[#D6C3A2] hover:border-[#5D4C31]"}`}
                          >
                            {instance.base.meta}
                          </button>
                        </li>
                      ))}
                    </ol>

                    {cluster.hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedClusters((current) => ({ ...current, [cluster.id]: !isExpanded }))}
                        className="mt-2 text-xs text-[#C8A96E] hover:underline"
                      >
                        {isExpanded ? "Show fewer examples" : `Expand cluster (${cluster.hiddenCount} more)`}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                className="rounded border border-[#5D4C31] px-2 py-1 text-[#E8DABF] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[#A9987D]">Page {safePage} / {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                className="rounded border border-[#5D4C31] px-2 py-1 text-[#E8DABF] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </aside>

          <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#3A3022] bg-[#1C160E]">
            <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-[#A89574]">{active.base.crumb}</p>
                <h2 className="mt-2 text-2xl text-[#F7EFDF] xl:text-3xl" style={{ fontFamily: "Instrument Serif, Georgia, serif" }}>{active.base.title}</h2>
                <p className="mt-2 text-sm text-[#CBBDA4]">{active.base.symptom}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded px-2 py-1 text-[11px] uppercase tracking-wider ${severityClasses(active.priority)}`}>{active.priority}</span>
                  <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.criterion}</span>
                  <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.scope}</span>
                  <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{active.queueType === "repair_plan" ? "Repair plan" : "Direct rewrite"}</span>
                  <span className={`rounded border px-2 py-1 text-[11px] uppercase tracking-wider ${evidenceBadgeClasses(active.evidenceStatus)}`}>{evidenceLabel(active.evidenceStatus)}</span>
                  <span className="rounded border border-[#5A4B33] bg-[#231C12] px-2 py-1 text-[11px] uppercase tracking-wider text-[#D7C6A8]">{sourceLabel(active.source)}</span>
                </div>

                {active.evidenceStatus === "missing_evidence" && (
                  <section className="mt-4 rounded-lg border border-[#7A2B1A]/60 bg-[#7A2B1A]/15 p-3 text-sm text-[#E9B19F]">
                    This recommendation needs an excerpt or usable manuscript anchor before it should be accepted as an individual repair.
                  </section>
                )}

                <section className="mt-4 rounded-lg border border-[#2E261A] bg-[#12100B] p-4">
                  <h3 className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Evidence</h3>
                  <blockquote className="mt-2 border-l border-[#C8A96E]/60 pl-3 text-sm leading-relaxed text-[#E9DCC4]">
                    <span className="text-[#F8F1E2]">“{active.base.quoteHighlight}”</span>{active.base.quoteRest}
                  </blockquote>
                  <p className="mt-2 text-xs text-[#9D8D72]">{active.base.anchor}</p>
                </section>

                <section className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    ["Diagnosis", active.base.symptom],
                    ["Cause", active.base.cause],
                    ["Fix direction", active.base.fixDirection],
                    ["Reader effect", active.base.readerEffect],
                  ].map(([label, text]) => (
                    <div key={label} className="rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-[#E8DCC4]">{text}</p>
                    </div>
                  ))}
                </section>

                <section className="mt-4 rounded-lg border border-[#2E261A] bg-[#12100B] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Mistake-proofing</p>
                  <p className="mt-1 text-sm text-[#E8DCC4]">{active.base.mistakeProofing}</p>
                </section>

                <section className="mt-5 space-y-3">
                  {active.base.options.map((option) => {
                    const isSelected = selectedOption === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setSelectedOption(option.key);
                          if (isDraftOpen) setDraftText(option.text);
                        }}
                        className={`w-full rounded-lg border p-4 text-left transition ${isSelected ? "border-[#C8A96E] bg-[#221B11]" : "border-[#2E261A] bg-[#12100B] hover:border-[#5D4C31]"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[#F2E8D6]">{optionRoleLabel(option.key)}</p>
                          <span className="text-xs text-[#B29F7D]">{active.queueType === "repair_plan" ? "Plan" : "Proposal"}</span>
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#E5D8BE]">{option.text}</pre>
                        <p className="mt-2 text-xs text-[#BDAE91]">{option.rationale}</p>
                      </button>
                    );
                  })}
                </section>

                <section className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canAccept}
                    onClick={() => stampDecision(`accepted_${selectedOption.toLowerCase()}` as DecisionState)}
                    className="rounded border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#1A140C] disabled:opacity-50"
                  >
                    Accept {selectedOption}
                  </button>
                  <button
                    type="button"
                    disabled={!canAccept}
                    onClick={() => stampDecision("keep_original")}
                    className="rounded border border-[#5D4C31] px-4 py-2 text-sm text-[#E8DABF] disabled:opacity-50"
                  >
                    Keep My Original
                  </button>
                  <button
                    type="button"
                    disabled={!canAccept}
                    onClick={() => stampDecision("reject")}
                    className="rounded border border-[#7A2B1A]/70 px-4 py-2 text-sm text-[#E2B2A6] disabled:opacity-50"
                  >
                    Reject These Suggestions
                  </button>
                  <button type="button" onClick={() => stampDecision("deferred")} className="rounded border border-[#5C5140] px-4 py-2 text-sm text-[#B7A98D]">
                    Decide Later
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftText((current) => current || selectedProposal?.text || "");
                      setIsDraftOpen(true);
                    }}
                    className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-2 text-sm text-[#F3E3C3]"
                  >
                    Write My Own Revision
                  </button>
                </section>

                {isDraftOpen && (
                  <section className="mt-4 rounded-lg border border-[#C8A96E]/60 bg-[#120E08] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#C8A96E]">Author custom revision</p>
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      rows={6}
                      className="mt-3 w-full rounded border border-[#3A3022] bg-[#0D0A05] p-3 font-mono text-sm leading-6 text-[#F7EFDF] outline-none focus:border-[#C8A96E]"
                      placeholder="Write your custom repair here..."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!draftText.trim()}
                        onClick={() => stampDecision("custom", draftText)}
                        className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 text-sm font-medium text-[#1A140C] disabled:opacity-50"
                      >
                        Save custom revision
                      </button>
                      <button type="button" onClick={() => setIsDraftOpen(false)} className="rounded border border-[#5D4C31] px-3 py-2 text-sm text-[#E8DABF]">
                        Close
                      </button>
                    </div>
                  </section>
                )}
            </div>

            <div className="shrink-0 border-t border-[#2E261A] bg-[#161109] px-4 py-3">
              <section className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canAccept}
                  onClick={() => stampDecision(`accepted_${selectedOption.toLowerCase()}` as DecisionState)}
                  className="rounded border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#1A140C] disabled:opacity-50"
                >
                  Accept {selectedOption}
                </button>
                <button
                  type="button"
                  disabled={!canAccept}
                  onClick={() => stampDecision("keep_original")}
                  className="rounded border border-[#5D4C31] px-4 py-2 text-sm text-[#E8DABF] disabled:opacity-50"
                >
                  Keep My Original
                </button>
                <button
                  type="button"
                  disabled={!canAccept}
                  onClick={() => stampDecision("reject")}
                  className="rounded border border-[#7A2B1A]/70 px-4 py-2 text-sm text-[#E2B2A6] disabled:opacity-50"
                >
                  Reject These Suggestions
                </button>
                <button type="button" onClick={() => stampDecision("deferred")} className="rounded border border-[#5C5140] px-4 py-2 text-sm text-[#B7A98D]">
                  Decide Later
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftText((current) => current || selectedProposal?.text || "");
                    setIsDraftOpen(true);
                  }}
                  className="rounded border border-[#C8A96E] bg-[#C8A96E]/10 px-4 py-2 text-sm text-[#F3E3C3]"
                >
                  Write My Own Revision
                </button>
              </section>
            </div>
          </article>

          <aside className="min-h-0 overflow-y-auto rounded-xl border border-[#3A3022] bg-[#161109] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-[0.18em] text-[#D7C4A1]">Revision Ledger</h2>
              {ledger.length > 0 && (
                <button type="button" onClick={() => undoLedgerEntry(0)} className="rounded border border-[#5D4C31] px-2 py-1 text-[11px] text-[#E8D8BA] hover:border-[#C8A96E]">
                  Undo last
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Accepted <span className="text-[#C8A96E]">{summary.decisionCounts.accepted}</span></div>
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Custom <span className="text-[#C8A96E]">{summary.decisionCounts.custom}</span></div>
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Kept <span className="text-[#C8A96E]">{summary.decisionCounts.keptOriginal}</span></div>
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Rejected <span className="text-[#C8A96E]">{summary.decisionCounts.rejected}</span></div>
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Deferred <span className="text-[#C8A96E]">{summary.decisionCounts.deferred}</span></div>
              <div className="rounded border border-[#2D2519] bg-[#120E08] p-2">Pending <span className="text-[#C8A96E]">{summary.decisionCounts.pending}</span></div>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Recent decisions</p>
              <ol className="mt-2 space-y-2">
                {ledger.length === 0 ? (
                  <li className="rounded border border-[#2D2519] bg-[#120E08] p-2 text-xs text-[#A9987D]">No decisions yet.</li>
                ) : (
                  ledger.slice(0, 8).map((entry, i) => (
                    <li key={entry.localId} className="rounded border border-[#2D2519] bg-[#120E08] p-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[#E9DCC4]"><span className="text-[#C8A96E]">{decisionLabel(entry)}</span> — {entry.itemTitle}</p>
                        <button type="button" onClick={() => undoLedgerEntry(i)} className="rounded border border-[#5D4C31] px-1.5 py-0.5 text-[10px] text-[#D8C6A4]">Undo</button>
                      </div>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
