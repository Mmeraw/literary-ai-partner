import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { RevisionFailureCode, isRevisionFailureCode } from "@/lib/errors/revisionCodes";
import { buildAnchorForSnippet } from "@/lib/revision/anchorContract";
import { applyProposalsBatchStrict } from "@/lib/revision/applyBatch";
import {
  buildApplyFailureEnvelope,
  classifyApplyFailureCode,
} from "@/lib/revision/failureClassification";
import type { ChangeProposal } from "@/lib/revision/types";

export type SoakHarnessMode = "dry-run" | "deterministic" | "stress";

export type SoakHarnessOptions = {
  events: number;
  concurrency: number;
  seed: number;
  mode: SoakHarnessMode;
  outputDir?: string;
  commitSha?: string;
  branch?: string;
  sampleFailuresLimit?: number;
  log?: (line: string) => void;
};

type CanonicalJobStatus = "queued" | "running" | "complete" | "failed";

type SoakEventScenario =
  | "valid_apply"
  | "overlap_conflict"
  | "duplicate_range"
  | "stale_reapply"
  | "anchor_miss"
  | "context_mismatch"
  | "parse_error"
  | "anchor_ambiguous"
  | "invariant_violation";

type SoakEvent = {
  id: string;
  scenario: SoakEventScenario;
  sourceText: string;
  expectedOutput?: string;
  proposals?: ChangeProposal[];
};

type PersistedRecord = {
  eventId: string;
  status: CanonicalJobStatus;
  failure_code: RevisionFailureCode | null;
  failure_envelope: ReturnType<typeof buildApplyFailureEnvelope> | null;
  last_error: string | null;
  attempts: number;
};

export type SoakHarnessMetrics = {
  requested_events: number;
  total_events_processed: number;
  classified_failures_total: Record<RevisionFailureCode, number>;
  unclassified_failures_total: number;
  wrong_location_edits_total: number;
  lost_writes_total: number;
  persistence_write_failures_total: number;
  retries_total: number;
  non_canonical_status_total: number;
  silent_fallback_total: number;
  duration_ms: number;
  throughput_events_per_sec: number;
  max_concurrency_observed: number;
  mode: SoakHarnessMode;
  seed: number;
  concurrency: number;
  pass: boolean;
};

export type SoakHarnessFailureSample = {
  event_id: string;
  scenario: SoakEventScenario;
  code: RevisionFailureCode;
  detail: string;
  persisted: boolean;
};

export type SoakHarnessRunResult = {
  metadata: Record<string, unknown>;
  metrics: SoakHarnessMetrics;
  failuresSample: SoakHarnessFailureSample[];
  runLog: string[];
  persistedRecords: PersistedRecord[];
};

const CANONICAL_JOB_STATUSES: CanonicalJobStatus[] = [
  "queued",
  "running",
  "complete",
  "failed",
];

const ALL_FAILURE_CODES = Object.values(RevisionFailureCode);

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildClassifiedFailuresTotal(): Record<RevisionFailureCode, number> {
  return ALL_FAILURE_CODES.reduce(
    (acc, code) => {
      acc[code] = 0;
      return acc;
    },
    {} as Record<RevisionFailureCode, number>,
  );
}

function buildProposal(
  source: string,
  original: string,
  replacement: string,
  overrides: Partial<ChangeProposal> = {},
): ChangeProposal {
  const start = overrides.start_offset ?? source.indexOf(original);
  if (start < 0) {
    throw new Error(`Harness setup failed: original text not found: ${original}`);
  }

  const end = overrides.end_offset ?? start + original.length;

  return {
    id: overrides.id ?? `${start}-${end}-${original}`,
    revision_session_id: overrides.revision_session_id ?? "session-packf",
    location_ref: overrides.location_ref ?? "loc:packf",
    rule: overrides.rule ?? "clarity",
    action: overrides.action ?? "refine",
    original_text: overrides.original_text ?? original,
    proposed_text: overrides.proposed_text ?? replacement,
    justification: overrides.justification ?? "pack-f harness",
    severity: overrides.severity ?? "medium",
    decision: overrides.decision ?? "accepted",
    modified_text: overrides.modified_text ?? null,
    start_offset: start,
    end_offset: end,
    before_context:
      overrides.before_context ?? source.slice(Math.max(0, start - 40), start),
    after_context:
      overrides.after_context ?? source.slice(end, Math.min(source.length, end + 40)),
    anchor_text_normalized:
      overrides.anchor_text_normalized ?? original.replace(/\r\n/g, "\n"),
    created_at: overrides.created_at ?? new Date().toISOString(),
  };
}

function createEvent(index: number): SoakEvent {
  const bucket = index % 9;

  if (bucket === 0) {
    const sourceText = `Document ${index}: Alpha beta gamma delta.\nTail ${index}.`;
    const replacement = `BETA_${index}`;
    const proposal = buildProposal(sourceText, "beta", replacement, {
      id: `valid-${index}`,
    });
    return {
      id: `event-${index}`,
      scenario: "valid_apply",
      sourceText,
      proposals: [proposal],
      expectedOutput: sourceText.replace("beta", replacement),
    };
  }

  if (bucket === 1) {
    const sourceText = `Overlap ${index}: abcdefg`;
    return {
      id: `event-${index}`,
      scenario: "overlap_conflict",
      sourceText,
      proposals: [
        buildProposal(sourceText, "bcd", `BCD_${index}`, {
          id: `ov-a-${index}`,
          start_offset: sourceText.indexOf("bcd"),
          end_offset: sourceText.indexOf("bcd") + 3,
          before_context: `Overlap ${index}: a`,
          after_context: "efg",
        }),
        buildProposal(sourceText, "cde", `CDE_${index}`, {
          id: `ov-b-${index}`,
          start_offset: sourceText.indexOf("cde"),
          end_offset: sourceText.indexOf("cde") + 3,
          before_context: `Overlap ${index}: ab`,
          after_context: "fg",
        }),
      ],
    };
  }

  if (bucket === 2) {
    const sourceText = `Duplicate ${index}: abcdef`;
    return {
      id: `event-${index}`,
      scenario: "duplicate_range",
      sourceText,
      proposals: [
        buildProposal(sourceText, "cd", `CD_${index}`, { id: `dup-a-${index}` }),
        buildProposal(sourceText, "cd", `XX_${index}`, { id: `dup-b-${index}` }),
      ],
    };
  }

  if (bucket === 3) {
    const sourceText = `Stale ${index}: Alpha beta gamma.`;
    return {
      id: `event-${index}`,
      scenario: "stale_reapply",
      sourceText,
      proposals: [buildProposal(sourceText, "beta", `BETA_${index}`, { id: `stale-${index}` })],
    };
  }

  if (bucket === 4) {
    const sourceText = `Anchor miss ${index}: Alpha beta gamma.`;
    const proposal = buildProposal(sourceText, "beta", `BETA_${index}`, {
      id: `miss-${index}`,
      original_text: "theta",
      anchor_text_normalized: "theta",
    });
    return {
      id: `event-${index}`,
      scenario: "anchor_miss",
      sourceText,
      proposals: [proposal],
    };
  }

  if (bucket === 5) {
    const sourceText = `Context mismatch ${index}: Alpha beta gamma.`;
    const proposal = buildProposal(sourceText, "beta", `BETA_${index}`, {
      id: `ctx-${index}`,
      before_context: "incorrect-before-context",
    });
    return {
      id: `event-${index}`,
      scenario: "context_mismatch",
      sourceText,
      proposals: [proposal],
    };
  }

  if (bucket === 6) {
    const sourceText = `Parse ${index}: Alpha beta gamma.`;
    const proposal = buildProposal(sourceText, "beta", `BETA_${index}`, {
      id: `parse-${index}`,
      start_offset: 1.5 as unknown as number,
    });
    return {
      id: `event-${index}`,
      scenario: "parse_error",
      sourceText,
      proposals: [proposal],
    };
  }

  if (bucket === 7) {
    const repeatedSnippet = `Repeated anchor ${index}`;
    const sourceText = `Lead ${index}. ${repeatedSnippet}. Middle. ${repeatedSnippet}. Tail.`;
    return {
      id: `event-${index}`,
      scenario: "anchor_ambiguous",
      sourceText,
    };
  }

  return {
    id: `event-${index}`,
    scenario: "invariant_violation",
    sourceText: `Invariant ${index}: Alpha beta gamma.`,
    proposals: [
      buildProposal(`Invariant ${index}: Alpha beta gamma.`, "beta", `BETA_${index}`, {
        id: `inv-${index}`,
        start_offset: 10,
        end_offset: 10,
      }),
    ],
  };
}

function maybeRecordNonCanonicalStatus(
  status: string,
  metrics: SoakHarnessMetrics,
): void {
  if (!CANONICAL_JOB_STATUSES.includes(status as CanonicalJobStatus)) {
    metrics.non_canonical_status_total += 1;
  }
}

function shouldInjectPersistenceFailure(
  mode: SoakHarnessMode,
  rng: () => number,
  attempt: number,
): boolean {
  if (mode !== "stress") {
    return false;
  }

  if (attempt > 1) {
    return false;
  }

  return rng() < 0.03;
}

function writeArtifacts(
  outputDir: string,
  result: SoakHarnessRunResult,
): void {
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    path.join(outputDir, "metadata.json"),
    JSON.stringify(result.metadata, null, 2),
  );
  writeFileSync(
    path.join(outputDir, "metrics.json"),
    JSON.stringify(result.metrics, null, 2),
  );
  writeFileSync(path.join(outputDir, "run.log"), `${result.runLog.join("\n")}\n`);
  writeFileSync(
    path.join(outputDir, "summary.md"),
    buildSummaryMarkdown(result),
  );

  if (result.failuresSample.length > 0) {
    writeFileSync(
      path.join(outputDir, "failures_sample.json"),
      JSON.stringify(result.failuresSample, null, 2),
    );
  }
}

function buildSummaryMarkdown(result: SoakHarnessRunResult): string {
  const { metadata, metrics } = result;
  const invariantRows = [
    ["requested_events", String(metrics.requested_events)],
    ["total_events_processed", String(metrics.total_events_processed)],
    ["unclassified_failures_total", String(metrics.unclassified_failures_total)],
    ["wrong_location_edits_total", String(metrics.wrong_location_edits_total)],
    ["lost_writes_total", String(metrics.lost_writes_total)],
    ["non_canonical_status_total", String(metrics.non_canonical_status_total)],
    ["silent_fallback_total", String(metrics.silent_fallback_total)],
  ];

  return [
    "# Pack F Summary",
    "",
    `- run date: ${String(metadata.run_date_utc)}`,
    `- commit SHA: ${String(metadata.commit_sha)}`,
    `- command used: ${String(metadata.command)}`,
    `- requested event count: ${metrics.requested_events}`,
    `- actual event count: ${metrics.total_events_processed}`,
    `- concurrency: ${metrics.concurrency}`,
    `- duration: ${metrics.duration_ms} ms`,
    `- pass/fail verdict: ${metrics.pass ? "PASS" : "FAIL"}`,
    "",
    "## Invariants",
    "",
    "| invariant | value |",
    "| --- | --- |",
    ...invariantRows.map(([name, value]) => `| ${name} | ${value} |`),
    "",
    "## Classified failures",
    "",
    ...ALL_FAILURE_CODES.map(
      (code) => `- ${code}: ${result.metrics.classified_failures_total[code]}`,
    ),
    "",
    "## Notes",
    "",
    `- recovered transient faults: ${metrics.persistence_write_failures_total > 0 ? "yes" : "no"}`,
    `- max concurrency observed: ${metrics.max_concurrency_observed}`,
  ].join("\n");
}

async function processEvent(
  event: SoakEvent,
  metrics: SoakHarnessMetrics,
  persistedRecords: PersistedRecord[],
  failuresSample: SoakHarnessFailureSample[],
  rng: () => number,
  logLine: (line: string) => void,
  sampleFailuresLimit: number,
  mode: SoakHarnessMode,
): Promise<void> {
  let status: CanonicalJobStatus = "queued";
  maybeRecordNonCanonicalStatus(status, metrics);

  const persist = (nextStatus: CanonicalJobStatus, error: unknown | null): boolean => {
    maybeRecordNonCanonicalStatus(nextStatus, metrics);

    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      if (shouldInjectPersistenceFailure(mode, rng, attempt)) {
        metrics.persistence_write_failures_total += 1;
        metrics.retries_total += 1;
        logLine(
          `[persist-retry] event=${event.id} attempt=${attempt} status=${nextStatus}`,
        );
        continue;
      }

      let failureCode: RevisionFailureCode | null = null;
      let failureEnvelope: ReturnType<typeof buildApplyFailureEnvelope> | null = null;
      let lastError: string | null = null;

      if (error != null) {
        failureCode = classifyApplyFailureCode(error);
        failureEnvelope = buildApplyFailureEnvelope(error, {
          event_id: event.id,
          scenario: event.scenario,
          persistence_attempts: attempt,
        });
        lastError = error instanceof Error ? error.message : String(error);
      }

      persistedRecords.push({
        eventId: event.id,
        status: nextStatus,
        failure_code: failureCode,
        failure_envelope: failureEnvelope,
        last_error: lastError,
        attempts: attempt,
      });
      return true;
    }

    metrics.lost_writes_total += 1;
    return false;
  };

  if (!persist(status, null)) {
    return;
  }

  status = "running";
  if (!persist(status, null)) {
    return;
  }

  try {
    switch (event.scenario) {
      case "valid_apply": {
        const result = applyProposalsBatchStrict(event.sourceText, event.proposals ?? []);
        if (result.output_text !== event.expectedOutput) {
          metrics.wrong_location_edits_total += 1;
          throw new Error("Apply harness invariant violation: output text diverged from expected output.");
        }
        status = "complete";
        if (!persist(status, null)) {
          return;
        }
        logLine(`[complete] event=${event.id} scenario=${event.scenario}`);
        return;
      }

      case "stale_reapply": {
        const first = applyProposalsBatchStrict(event.sourceText, event.proposals ?? []);
        applyProposalsBatchStrict(first.output_text, event.proposals ?? []);
        status = "complete";
        if (!persist(status, null)) {
          return;
        }
        logLine(`[unexpected-complete] event=${event.id} scenario=${event.scenario}`);
        return;
      }

      case "anchor_ambiguous": {
        const repeatedSnippet = `Repeated anchor ${event.id.split("-").pop()}`;
        const build = buildAnchorForSnippet(event.sourceText, repeatedSnippet);
        if (build.anchor_status !== "ambiguous") {
          throw new Error(`Invariant violation: expected ambiguous anchor but got ${build.anchor_status}.`);
        }
        throw new Error(build.reason);
      }

      case "invariant_violation": {
        throw new Error(
          `Invariant violation: synthetic Pack F contract breach for ${event.id}.`,
        );
      }

      default: {
        applyProposalsBatchStrict(event.sourceText, event.proposals ?? []);
        status = "complete";
        if (!persist(status, null)) {
          return;
        }
        logLine(`[unexpected-complete] event=${event.id} scenario=${event.scenario}`);
        return;
      }
    }
  } catch (error) {
    status = "failed";
    const persisted = persist(status, error);
    const code = classifyApplyFailureCode(error);
    if (isRevisionFailureCode(code)) {
      metrics.classified_failures_total[code] += 1;
    } else {
      metrics.unclassified_failures_total += 1;
    }

    if (failuresSample.length < sampleFailuresLimit) {
      failuresSample.push({
        event_id: event.id,
        scenario: event.scenario,
        code,
        detail: error instanceof Error ? error.message : String(error),
        persisted,
      });
    }

    logLine(`[failed] event=${event.id} scenario=${event.scenario} code=${code}`);
  }
}

export async function runSoakHarness(
  options: SoakHarnessOptions,
): Promise<SoakHarnessRunResult> {
  if (!Number.isInteger(options.events) || options.events <= 0) {
    throw new Error("Pack F requires events to be a positive integer.");
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
    throw new Error("Pack F requires concurrency to be a positive integer.");
  }

  const rng = createSeededRng(options.seed);
  const startedAt = Date.now();
  const runLog: string[] = [];
  const logLine = (line: string) => {
    runLog.push(line);
    options.log?.(line);
  };

  const metrics: SoakHarnessMetrics = {
    requested_events: options.events,
    total_events_processed: 0,
    classified_failures_total: buildClassifiedFailuresTotal(),
    unclassified_failures_total: 0,
    wrong_location_edits_total: 0,
    lost_writes_total: 0,
    persistence_write_failures_total: 0,
    retries_total: 0,
    non_canonical_status_total: 0,
    silent_fallback_total: 0,
    duration_ms: 0,
    throughput_events_per_sec: 0,
    max_concurrency_observed: 0,
    mode: options.mode,
    seed: options.seed,
    concurrency: options.concurrency,
    pass: false,
  };

  const failuresSample: SoakHarnessFailureSample[] = [];
  const persistedRecords: PersistedRecord[] = [];
  const events = Array.from({ length: options.events }, (_, index) => createEvent(index));
  const sampleFailuresLimit = options.sampleFailuresLimit ?? 25;

  let nextIndex = 0;
  let active = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= events.length) {
        return;
      }

      active += 1;
      metrics.max_concurrency_observed = Math.max(metrics.max_concurrency_observed, active);
      const event = events[currentIndex];
      try {
        await processEvent(
          event,
          metrics,
          persistedRecords,
          failuresSample,
          rng,
          logLine,
          sampleFailuresLimit,
          options.mode,
        );
        metrics.total_events_processed += 1;
      } finally {
        active -= 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, options.events) }, () => worker()),
  );

  metrics.duration_ms = Date.now() - startedAt;
  metrics.throughput_events_per_sec =
    metrics.duration_ms > 0
      ? Number(((metrics.total_events_processed / metrics.duration_ms) * 1000).toFixed(3))
      : metrics.total_events_processed;
  metrics.pass =
    metrics.total_events_processed === options.events &&
    metrics.unclassified_failures_total === 0 &&
    metrics.wrong_location_edits_total === 0 &&
    metrics.lost_writes_total === 0 &&
    metrics.non_canonical_status_total === 0 &&
    metrics.silent_fallback_total === 0;

  const metadata = {
    commit_sha: options.commitSha ?? "unknown",
    branch: options.branch ?? "unknown",
    mode: options.mode,
    seed: options.seed,
    total_event_count: options.events,
    concurrency_level: options.concurrency,
    fault_injection_enabled: options.mode === "stress",
    run_date_utc: new Date().toISOString(),
    command: `npm run soak:run -- --events=${options.events} --concurrency=${options.concurrency} --seed=${options.seed} --mode=${options.mode}`,
  };

  const result: SoakHarnessRunResult = {
    metadata,
    metrics,
    failuresSample,
    runLog,
    persistedRecords,
  };

  if (options.outputDir) {
    const resolvedOutputDir = path.isAbsolute(options.outputDir)
      ? options.outputDir
      : path.join(process.cwd(), options.outputDir);
    writeArtifacts(resolvedOutputDir, result);
  }

  return result;
}
