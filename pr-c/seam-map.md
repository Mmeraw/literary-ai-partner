# PR-C Seam Map
_Captured 2026-05-09. Do not edit without updating line numbers._

Issues: #384 (architectural defect — P0), #385 (BlankBreak label regression — medium, deferred)

---

## The Problem in One Sentence

The chunk substrate exists in the database. It does not exist in the evaluation.

---

## Data Flow (Current — Broken)

```
manuscript_chunks (58 rows, ~500K chars total, min 3500 / median 9566 chars)
    │
    │  resolveManuscriptText()              [lib/evaluation/processor.ts:L807–835]
    ▼
validChunks.map(c => c.content.trim()).join('\n')   ← ALL 58 chunks → one string
    │                                                ← COLLAPSE POINT (single line)
    │  runPipeline({ manuscriptText: ... }) [lib/evaluation/processor.ts:L1863]
    ▼
buildPromptInputWindow(text, 40_000)        [lib/evaluation/pipeline/prompts/pass1-craft.ts:L83]
                                            [lib/evaluation/pipeline/prompts/pass2-editorial.ts:L112]
(begin/middle/end sampler, hardcoded 3 segments)
    │
    ▼
Pass 1 + Pass 2  ← see ~6,800 of 87,737 words (7.7% coverage)
    │
    ▼
Pass 3 synthesis ← same starved window; manuscriptChunks[] passed but is metadata-only
    │
    ▼
Pass 4 / QGv2 path   ← non-certification surfaced honestly when anchor evidence is insufficient
```

---

## Exact Seams PR-C Must Touch

### 1. The Collapse Point
**File:** `lib/evaluation/processor.ts` **Lines:** L826–835  
**Symbol:** `resolveManuscriptText`  
**Current behavior:** `validChunks.map((chunk) => chunk.content.trim()).join('\n')` — collapses all chunks into one string, destroys locality.  
**PR-C change:** Return `loadedChunks` array to the caller without concatenating; let the map phase iterate it directly. The concatenated `text` is still needed for short-form manuscripts — guard on `chunkRouting.route === 'long_form'`.

### 2. The Sampling Points (where manuscript becomes a 7.7% fragment)
**File:** `lib/evaluation/pipeline/prompts/pass1-craft.ts` **Line:** L83  
`buildPromptInputWindow(params.manuscriptText)` — no `maxChars` arg → 40K env default  

**File:** `lib/evaluation/pipeline/prompts/pass2-editorial.ts` **Line:** L112  
Same pattern.

**File:** `lib/evaluation/pipeline/promptInput.ts` **Lines:** L34–47  
`buildPromptInputWindow` implementation: begin/middle/end segments, hard cap at `inputCharBudget`.  
**PR-C change:** In the map phase, each Pass 1 / Pass 2 call receives one chunk's content as `manuscriptText`. Per-chunk content is ~9,500 chars — well inside the 40K budget without sampling. `buildPromptInputWindow` passes through unchanged for chunk-scoped calls (no truncation occurs). The sampler stays valid for short-form manuscripts.

### 3. The Misleading Counter
**File:** `lib/evaluation/pipeline/promptInput.ts` **Line:** L69  
`derivePromptChunkCount` — returns `3` when truncated, `1` when full.  
This is what populates **"Chunks Analyzed: 3"** in the UI (`app/evaluate/[jobId]/page.tsx:L584` uses `artifact.chunk_count`).  
**PR-C change:** `chunk_count` in the artifact must reflect actual DB chunks consumed, not prompt-window count. Update the artifact writer, not just the counter function. The counter function itself may be retired or renamed.

### 4. The Pass Call Sites (where chunks could enter but don't today)
**File:** `lib/evaluation/pipeline/runPipeline.ts` **Line:** L572  
`_runPass1({ manuscriptText: opts.manuscriptText, ... })` — receives full concat string.  

**File:** `lib/evaluation/pipeline/runPipeline.ts` **Line:** L610  
`_runPass2({ manuscriptText: opts.manuscriptText, ... })` — same.  

**PR-C change:** For long-form manuscripts, `runPipeline` must accept `manuscriptChunks[]` and iterate them. Each iteration calls `_runPass1` / `_runPass2` with a single chunk's content as `manuscriptText`. Evidence is collected per chunk, then reduced in Pass 3.

### 5. The Existing Hook (the door left open by the original architect)
**File:** `lib/evaluation/pipeline/runPipeline.ts` **Line:** L96  
`manuscriptChunks?: ManuscriptChunkEvidence[]` — already typed in `RunPipelineOptions`.  

**File:** `lib/evaluation/pipeline/runPipeline.ts` **Lines:** L849–851  
Already threaded to Pass 3: `_runPass3({ ..., manuscriptChunks: opts.manuscriptChunks })`.  

**PR-C change:** Use this same array as the map-phase loop driver in Pass 1 / Pass 2. The hook exists; wire it.

---

## Criteria Split (Map vs. Reduce)

| Criterion | Evaluation Locality | Notes |
|---|---|---|
| Prose Control & Line-Level Craft | Chunk-local (map) | One chunk is enough to assess |
| Point of View & Voice Control | Chunk-local (map) | Voice is consistent or not within chunks |
| Dialogue Authenticity & Subtext | Chunk-local (map) | Dialogue is analyzable per scene/chunk |
| Scene Construction & Function | Chunk-local (map) | Scenes are typically within one chunk |
| Tonal Authority & Consistency | Chunk-local with cross-chunk signal | Start with map; reduce flags inconsistency |
| Concept & Core Premise | Manuscript-scale (reduce) | Needs opening AND resolution context |
| Character Depth & Psychological Coherence | Manuscript-scale (reduce) | Arc spans entire manuscript |
| Thematic Integration | Manuscript-scale (reduce) | Propagation must be verified end-to-end |
| World-Building & Environmental Logic | Manuscript-scale (reduce) | Consistency errors only visible across chunks |
| Pacing & Structural Balance | Manuscript-scale (reduce) | Requires whole-manuscript structural view |
| Narrative Drive & Momentum | Manuscript-scale (reduce) | Momentum across chapters, not within |
| Narrative Closure & Promises Kept | Manuscript-scale (reduce) | Closure is only visible at the end |
| Professional Readiness & Market Positioning | Manuscript-scale (reduce) | Holistic judgment |

---

## Idempotency Key

`(chunk_id, content_hash, prompt_version)` — enables selective recomputation. Re-evaluation only re-runs chunks whose content or prompt version changed. Pass 1 / Pass 2 outputs can be cached per this key. Cost scales with the number of changed chunks, not total manuscript size.

---

## Doctrine Alignment

Three commitments this seam map must honor:

1. **"The canon is the substrate, not the surface."** — PR-C makes the chunk substrate substantive in cognition, not merely decorative in storage.
2. **"Quality first. Mistake-proofed. Complete. Scalable to 100,000 users."** — Manuscript-scale evaluation that is literal rather than aspirational is the only version that scales. 53.00 derived from 7.7% coverage is not quality.
3. **Governance worked. Honor what it surfaced.** — Prose Control refused to certify. Confidence degraded honestly. The system told the truth. PR-C's job is to give the evaluation layer enough substrate to certify when the work merits it, not to paper over the starvation.

---

## What PR-C Is NOT

- Not a budget bump (40K → 100K → still failing at 14% coverage)
- Not a prompt-window widening
- Not a new quality gate
- Not a chunker change (PR-A closed that)
- Not a hot-fix

PR-C is a re-routing: chunks enter the map phase before the collapse; the reduce phase uses the existing Pass 3 / manuscriptChunks infrastructure.

---

## Related

- PR #383 — fix(chunker): TOC-aware boundary detection (prerequisite, merged to main 611e927b)
- Issue #384 — architectural defect (this document's primary concern)
- Issue #385 — BlankBreak label regression (secondary, deferred until #384 design phase)
- `lib/evaluation/pipeline/promptInput.ts` — `buildPromptInputWindow`, `derivePromptChunkCount`
- `lib/evaluation/processor.ts` — `resolveManuscriptText`, `manuscriptChunksForPipeline`
- `lib/evaluation/pipeline/types.ts` — `ManuscriptChunkEvidence` type definition
