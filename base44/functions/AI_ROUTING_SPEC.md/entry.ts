# Base44 AI Routing Map (v1) — Canon (Internal)
**Doc ID:** Base44-AI-ROUTING-V1 | **Owner:** Mike | **Last Updated:** 2025-12-31  
**Scope:** Production routing and guardrails (excludes prompt chains and creative rubrics)

## WHAT THIS IS / WHAT THIS IS NOT
**What This Is:** A canonical internal specification for routing, provenance, and quality guardrails.  
**What This Is Not:** Not public; not a prompt library; not an editorial rubric.

---

## Base44 AI Routing Map (v1)
**How tasks are routed across Base44, OpenAI, Perplexity, and ChatGPT**

### Canon count (what this system actually is)
- **2 production AI engines (model providers):** OpenAI API + Perplexity API
- **1 orchestrator (not a model):** Base44
- **1 separate UI tool (manual only, not in production routing):** ChatGPT UI

---

## System roles (high level)

### Base44 (Orchestrator)
- **Orchestration layer:** handles user intent, task classification, routing, and output assembly
- Manages context (project, manuscript, prior analyses) across calls
- Enforces quality standards (deck spec, screenplay spec, grading rubrics)
- **Does not generate content itself**
- Applies policy gates ("no web," "no external facts," "self-guided tier," "studio request") before routing
- Maintains deterministic run states (queued / running / ready / ready_with_errors / failed) so every job terminates
- Enforces "production vs. manual" separation: only OpenAI + Perplexity are callable in production; ChatGPT UI is never called by Base44
- Enforces tier entitlements (Starter / Pro / Premium) before allowing expensive workflows (full-manuscript runs, research calls, multi-output packages)

### OpenAI (API)
- **Primary reasoning, writing, and synthesis engine**
- Used for all creative, analytical, structural, and stylistic outputs where voice, nuance, and structure matter
- Default engine for any output that must remain voice-consistent and manuscript-faithful
- **Final-authoring engine for client-facing deliverables** (decks, synopses, coverage, revisions, screenplay pages)

### Perplexity (API)
- **Research and verification layer**
- Used when tasks require external facts, live comparables, market or industry data, or verification
- **Never used as the final writing engine for client-facing narrative prose**; it supplies citations/inputs that OpenAI shapes
- Used only when the task explicitly requires external grounding (numbers, recency, market comps, company lists, industry claims)

### ChatGPT (UI tool)
- **Manual operator tool** for ideation, prompt/RAG design, drafting standards, and quality experiments
- **Not called by Base44**; used directly by humans outside the production pipeline
- May be used for internal QA sampling and prompt iteration, but does not participate in production runs
- Same general model family as OpenAI may be used in the UI, but it is accessed separately (web interface), not via the production API workflow

---

## Routing table — production logic

| Task Type | Routed To | Reason |
|-----------|-----------|--------|
| Manuscript analysis (macro) | OpenAI | Long-form reasoning on structure, pacing, POV, arcs |
| Developmental notes / revision memos | OpenAI | Contextual, multi-layered critique and guidance |
| Line edits / local rewrites | OpenAI | Precision language control and stylistic fidelity |
| Tone calibration / voice matching | OpenAI | Consistent voice modeling across outputs |
| Synopses (short/long) | OpenAI | High-level abstraction and narrative compression |
| Film/TV pitch decks (slides, loglines, beats) | OpenAI | Structured, industry-facing narrative packaging |
| Coverage / reader reports | OpenAI | Analytical, evidence-based reporting on the work |
| Character analysis & arc mapping | OpenAI | Psychological modeling and arc clarity |
| Theme extraction & articulation | OpenAI | Conceptual synthesis from text |
| Screenplay pages (WriterDuet spec) | OpenAI | Formatting + scene craft under Screenplay Standard |
| Structural grading (beats, acts, POV balance) | OpenAI | Pattern recognition plus narrative reasoning |
| "Vibe-based" comps from text only | OpenAI | Inferred comparables without web dependency |
| Submission assets (query, logline variants, synopses, bio drafts, pitch summary) — manuscript-derived | OpenAI | Narrative packaging from provided text; no external lookup required |
| Market comps (films/books with numbers) | Perplexity | Needs up-to-date box office, budgets, release context |
| Comparable projects for pitch positioning | Perplexity | Live knowledge of recent titles and performance |
| Industry trends (genres, formats, streamers) | Perplexity | Pulls current articles, coverage, and analyses |
| Budget ranges & production tier checks | Perplexity | External data validation against real productions |
| Agent / manager / producer / company lookup | Perplexity | Real-world contact and company discovery |
| Audience / demographic & market data | Perplexity | Uses reports, surveys, and public stats |
| Fact-checking specific claims in docs | Perplexity | Verification layer before finalizing claims |
| Citation pack / sources list for market claims (optional add-on) | Perplexity | Provides external references that can be attached to a deck or memo |
| Final narrative output (what client sees) | OpenAI | Ensures stylistic consistency and controlled voice |
| Human QA / overrides | Human | Editorial authority; final say on release |

---

## Routing triggers (simple rules Base44 enforces)

- **If output includes named external entities** (films, studios, budgets, gross, awards, "based on true…" claims) → route to Perplexity for verification first
- **If task is "write / rewrite / synthesize / summarize" from user text** → OpenAI only
- **If user selects "No web / Manuscript-only mode"** → Perplexity is hard-disabled
- **If user tier is Starter** → Perplexity is disabled by default except Billing/Account/Legal lookups (if any), and comps are "vibe-based" only
- **If the user requests "comps with numbers," "current market," "agent list," "studio list," or "budget ranges,"** Perplexity is required (unless "No web" is enabled)
- **If Perplexity is disabled** (tier or "No web"), Base44 must label outputs clearly as "manuscript-only / vibe-based" where appropriate
- **Base44 should never "call both providers then merge" by default**; Perplexity is used only to supply inputs (facts/citations) that OpenAI incorporates

---

## What Base44 actually does

Base44 acts as:

### Traffic controller
Routes each task to OpenAI or Perplexity according to this map.

### Context manager
Preserves manuscript context, prior grades, decks, and notes across calls so outputs remain coherent.

### Output gatekeeper
Applies quality standards (Film Pitch Deck Standard, Screenplay Standard, Grading Rubric) before anything leaves the system.

### Cost optimizer
Prevents unnecessary multi-provider calls; uses research only when required.

**Base44 itself never "speaks" as a model**; it decides how generation and retrieval happen.

It also enforces "single-source-of-truth" rules (e.g., if Perplexity supplies data, OpenAI cannot override it without re-calling Perplexity).

---

## Provenance tracking

Every output must carry internal metadata:
- `source_models`: `["openai"]` or `["perplexity", "openai"]`
- `research_used`: `true` / `false`
- `manuscript_only`: `true` / `false`
- `tier_override`: if admin manually enabled Perplexity for a Starter user

This metadata is for internal tracking only; users see simplified labels like "Manuscript-only analysis" or "Research-enhanced comparison."

---

## Tier enforcement rules

### Starter
- OpenAI only (all synthesis, grading, revision)
- No Perplexity access
- Comps are "vibe-based" (inferred from text, no box office data)
- No agent/company lookup
- Can upgrade to Pro for research access

### Pro
- OpenAI (synthesis, grading, revision)
- Perplexity available for:
  - Market comps with numbers
  - Agent/company discovery
  - Industry trends
  - Fact-checking
- "Ask Before Research" toggle available
- Can enable/disable research per task

### Premium / Enterprise
- Full OpenAI + Perplexity access
- Priority routing
- Custom research workflows
- White-label outputs

---

## Quality gates (applied by Base44 before release)

Before any output leaves the system:
1. ✅ **Routing correct:** Task routed per this spec
2. ✅ **Standards applied:** Film Pitch Deck Standard, Screenplay Standard, Grading Rubric enforced
3. ✅ **Provenance tracked:** Metadata attached (internal)
4. ✅ **Tier compliance:** User has access to the workflow they requested
5. ✅ **No hallucination:** If Perplexity was used, facts are cited; if not, claims are manuscript-derived
6. ✅ **Voice consistency:** OpenAI wrote all final prose
7. ✅ **Human override:** Final QA pass before client delivery

---

## User-facing language (vendor-neutral)

### What users see:
- "Manuscript-only analysis" (OpenAI, no research)
- "Research-enhanced comparison" (Perplexity data + OpenAI prose)
- "Vibe-based comps" (OpenAI inference, no box office)
- "Market-verified comps" (Perplexity data + OpenAI synthesis)

### What users don't see:
- Provider names (OpenAI, Perplexity)
- Routing logic
- Model names or versions
- Temperature settings
- Token counts or cost breakdowns

---

## Integration with quality standards

### Film Pitch Deck Standard
- Routing: OpenAI for all deck content
- Research: Perplexity for comps, budget ranges, box office (if enabled)
- Final output: OpenAI synthesizes research into deck slides

### Screenplay Quality Standard
- Routing: OpenAI only (formatting + scene craft)
- No research layer (screenplay pages are manuscript-derived)

### WAVE Revision System
- Routing: OpenAI only (structural + craft evaluation)
- No research layer (revision is manuscript-derived)

---

## Edge cases & overrides

### "No web" mode enabled but user requests comps with numbers
- Base44 blocks the request OR
- Offers manuscript-only alternative: "We can provide vibe-based comps without box office data"

### User tier is Starter but asks for agent lookup
- Base44 prompts upgrade: "Agent discovery requires Pro plan"

### Perplexity returns no results
- Base44 falls back to OpenAI vibe-based inference OR
- Notifies user: "No current market data found; would you like a manuscript-derived alternative?"

### Human QA rejects output
- Base44 re-routes task with corrections OR
- Human writes final output manually

---

## Internal notes (not user-facing)

- **ChatGPT UI is not in production:** Used by Mike for prompt design, QA sampling, and standards drafting
- **Perplexity is research only:** Never writes final prose
- **OpenAI is the voice:** All client-facing narrative goes through OpenAI for consistency
- **Base44 never generates:** It orchestrates, enforces, and gates — it doesn't "speak"

---

**Last Updated:** 2025-12-31  
**Version:** 1.0  
**Status:** Active Canonical Routing Specification  
**Owner:** Mike