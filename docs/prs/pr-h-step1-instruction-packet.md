# PR-H Step 1 — Pass 1 Phase A Enrichment

**Status:** DRAFTED — awaiting PR-I and PR-J merges before push
**Depends on:** PR-I #522 (provenance hardening — touches pass1-craft.ts), PR-J #523 (display fixes — independent)
**Branch:** `pr-h-step1/pass1-extraction-enrichment` (off latest main after I+J merge)
**PR Type:** evaluation (validator type `evaluation`)
**Goal:** Seed Phase A with 4 new extraction fields that Phase B deep-eval worker will consume — no scoring impact, no governance impact, pure additive enrichment.

---

## Why this step matters

The Phase B deep-evaluation worker (PR-H Step 2-5) reads Phase A artifact and fans out parallel layer-analysis prompts. To do that without re-tokenizing the manuscript, Phase B needs **structured extraction signals from Pass 1**:

1. **entity_extraction** — characters, places, objects, doctrine/glyph references appearing in the text (Phase B's `SymbolicSystemAuditRow` source)
2. **layer_voice_map** — detected narrative layers (Era/Plane/Voice/Function/Stakes per layer), feeds Phase B's `LayerEntry` records
3. **stack_diagnosis** — one-paragraph architectural observation (what the layered stack is *trying to do* and where the weakest joint is); seeds Phase B's `ArchitecturalCriterion` reasoning
4. **promise_ledger** — list of opened-but-not-yet-resolved narrative promises (a → b → ?); seeds Phase B's `CrossLayerIntegration.Architectural risk` and the `narrativeClosure` revision pack

All four are **optional fields**. Phase B falls back to a single classifier call if they're missing on legacy jobs.

---

## Files to change

### 1. `lib/evaluation/pipeline/types.ts` (additive)

Extend `SinglePassOutput` with optional fields:

```ts
// ── Phase A enrichment (Pass 1 only; consumed by Phase B deep-eval worker) ──

export type EntityRecord = {
  name: string;                  // canonical surface form, max 80 chars
  kind: "character" | "place" | "object" | "doctrine" | "glyph" | "other";
  first_mention_snippet?: string; // <= 120 chars
  role_hint?: string;             // <= 80 chars
};

export type LayerVoiceMapEntry = {
  layer_label: string;              // detector-assigned, <= 60 chars
  era_or_plane?: string;            // <= 60 chars
  voice_or_mode?: string;           // e.g. "first-person witness", <= 60 chars
  function_in_whole?: string;       // <= 200 chars
  stakes?: string;                  // <= 200 chars
};

export type PromiseLedgerEntry = {
  promise: string;                  // <= 200 chars
  opened_at_snippet?: string;       // <= 120 chars
  status: "open" | "resolved" | "abandoned";
};

export type Pass1Enrichment = {
  entity_extraction?: EntityRecord[];      // soft cap 24
  layer_voice_map?: LayerVoiceMapEntry[];  // soft cap 6
  stack_diagnosis?: string;                // <= 600 chars, single paragraph
  promise_ledger?: PromiseLedgerEntry[];   // soft cap 12
};

export type SinglePassOutput = {
  pass: 1 | 2;
  axis: "craft_execution" | "editorial_literary";
  criteria: AxisCriterionResult[];
  model: string;
  prompt_version: string;
  temperature: number;
  generated_at: string;
  coverage_summary?: PassCoverageSummary;
  pass1_enrichment?: Pass1Enrichment;  // populated only when pass === 1
};
```

### 2. `lib/evaluation/pipeline/prompts/pass1-craft.ts` (v8 → v9)

After PR-I lands, the file's version literal is `pass1-craft-v8-provenance-hardening` and the system prompt is at 4972 chars. The enrichment instructions must respect that prompt-pack budget. Strategy: keep new instruction text terse, push the JSON example into a separate constant if needed to stay under 5000.

Bump to `pass1-craft-v9-phase-a-enrichment`. Add to system prompt:

```
PHASE A ENRICHMENT (optional fields, Pass 1 only — Phase B consumes these)
Beyond the 13 criteria, emit these optional top-level fields. If a signal is absent, OMIT the field (do NOT emit []/empty string).
- entity_extraction: array of {name, kind, first_mention_snippet?, role_hint?} (max 24). kind ∈ character|place|object|doctrine|glyph|other.
- layer_voice_map: array of {layer_label, era_or_plane?, voice_or_mode?, function_in_whole?, stakes?} (max 6). Only when the text shows multiple distinct narrative planes/eras/voices.
- stack_diagnosis: one paragraph (<= 600 chars) describing what the layered structure tries to do and the weakest joint. Omit for short_form.
- promise_ledger: array of {promise, opened_at_snippet?, status} (max 12). status ∈ open|resolved|abandoned.
All four are bounded extractions; no editorial commentary.
```

### 3. `lib/evaluation/pipeline/runPass1.ts` (parser + aggregator passthrough)

In `parsePass1Response`, after parsing criteria, extract optional enrichment:

```ts
// Phase A enrichment — additive, optional
const enrichment: Pass1Enrichment = {};
if (Array.isArray(obj["entity_extraction"])) {
  enrichment.entity_extraction = (obj["entity_extraction"] as unknown[])
    .slice(0, 24)
    .map((e) => {
      const r = e as Record<string, unknown>;
      const kindRaw = String(r["kind"] ?? "other");
      const kind = ["character","place","object","doctrine","glyph","other"].includes(kindRaw)
        ? kindRaw as EntityRecord["kind"]
        : "other";
      return {
        name: truncateText(r["name"], 80),
        kind,
        first_mention_snippet: r["first_mention_snippet"] ? truncateText(r["first_mention_snippet"], 120) : undefined,
        role_hint: r["role_hint"] ? truncateText(r["role_hint"], 80) : undefined,
      };
    })
    .filter((e) => e.name.length > 0);
}
if (Array.isArray(obj["layer_voice_map"])) { /* analogous, cap 6 */ }
if (typeof obj["stack_diagnosis"] === "string") {
  enrichment.stack_diagnosis = truncateText(obj["stack_diagnosis"], 600);
}
if (Array.isArray(obj["promise_ledger"])) { /* analogous, cap 12 */ }

const hasEnrichment =
  enrichment.entity_extraction?.length
  || enrichment.layer_voice_map?.length
  || enrichment.stack_diagnosis
  || enrichment.promise_ledger?.length;

return {
  pass: 1,
  axis: "craft_execution",
  criteria,
  model: String(fallbackModel),
  prompt_version: PASS1_PROMPT_VERSION,
  temperature: PASS1_TEMPERATURE,
  generated_at: new Date().toISOString(),
  ...(hasEnrichment ? { pass1_enrichment: enrichment } : {}),
};
```

In `aggregateChunkResults`, merge enrichment across chunks (union with dedup by `name` for entities, by `layer_label` for layers, by `promise` for ledger; concatenate stack_diagnosis paragraphs with " / " separator, truncate to 600).

### 4. Tests

`__tests__/lib/evaluation/pipeline/pass1-enrichment.test.ts` — new, covers:
- Parser accepts well-formed enrichment
- Parser handles missing enrichment (back-compat: no `pass1_enrichment` field in output)
- Soft caps enforced (24 entities, 6 layers, 12 promises)
- Invalid `kind` defaults to `other`
- Aggregator dedups by name/layer_label/promise
- Aggregator truncates joined stack_diagnosis

`__tests__/lib/evaluation/pipeline/prompt-pack.test.ts` — update version literal check; verify PASS1_SYSTEM_PROMPT length still < 5000 (the budget gate).

---

## Out of scope

- Phase B worker (Step 2-5; separate PR)
- Pass 2 / Pass 3 enrichment passthrough
- UI rendering of enrichment (Phase B PR adds this)
- Schema persistence (`pass-artifact-v1` stays at v1; enrichment lives in pipeline-internal type for now)

## Provenance

This is **pure extraction**, no scoring impact. PR-G governance, PR-I provenance hardening, and PR-J display fixes are all untouched.

## Quality Gate

Not reducing intelligence — adding structured signal extraction that the gold-standard DREAM benchmark requires. Phase A wall-clock budget impact: +0 ms (same prompt, additive output tokens only).
