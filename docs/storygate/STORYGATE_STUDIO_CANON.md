# Storygate Studio Canon

> **Status:** Current Storygate Studio authority  
> **Governance:** `AI_GOVERNANCE.md` is binding  
> **Last updated:** 2026-06-11

This document is the primary current source of truth for Storygate Studio governance. It supersedes legacy Base44 Storygate material for current Storygate Studio SIPOC/FIPOC work.

---

## Canonical Authority Order

1. `docs/storygate/STORYGATE_STUDIO_CANON.md` — primary binding Storygate Studio canon.
2. `docs/SIPOC_STORYGATE_PROCESS.md` — SIPOC/FIPOC process constitution.
3. `lib/storygate/storygateRegistry.ts` — executable registry and machine-readable contract.
4. `docs/SYSTEM_FACTORY_MAP.md` — executive cross-factory summary.
5. Current app routes/components under `app/storygate-studio/**` and `components/storygate/**` — runtime/UI reference.
6. `base44/**` and `archive/base44-export/**` — legacy reference only, non-binding.

If Base44 or archive material conflicts with this document, this document wins.

---

## Current Product Scope

Storygate Studio is a manuscript-first, literary/publishing-facing controlled access layer. It helps prepared creators present organized manuscript project materials to verified publishing professionals without turning the project into a public listing.

Current supported pathways:

- Novels and long-form fiction.
- Memoir and serious nonfiction projects.
- Complex long-form prose manuscripts.

Current Storygate Studio does **not** include:

- Film Track.
- Film Deck.
- Screenplay conversion.
- Manuscript-to-screenplay adaptation.
- Treatment requirements.
- Logline as a film/deck requirement.
- Producer-facing materials.
- Film-rights marketplace language.

A manuscript may later have adaptation potential, but adaptation is not part of current Storygate Studio governance.

---

## Canonical Admission Threshold

Storygate Studio admission threshold is:

**9.0 / 10**

This value is canonical for Storygate Studio admission.

RevisionGrade readiness and Storygate Studio admission are separate gates. A manuscript may be useful for RevisionGrade readiness, Revise, or Agent Readiness work below 9.0, but Storygate Studio admission requires 9.0 unless a future formal policy changes this canon.

No Storygate registry, SIPOC, CSV, test, route, component, or documentation may define Storygate Studio admission as 8.0.

---

## Required Agent-Facing Package

Storygate Studio eligibility requires a complete literary/publishing package:

1. Query Letter.
2. Synopsis.
3. Author Bio.
4. Elevator Pitch.
5. Agent Pitch.
6. Market Comparables.
7. Market Category.
8. Target Audience.
9. Market Position Statement.
10. Sample Pages.
11. Rights Declaration.

Market Comparables are required. They are not optional positioning garnish for Storygate Studio governance.
Market Category is required because it tells a publishing professional where the manuscript lives operationally, e.g. upmarket suspense, commercial thriller, literary fiction, historical mystery, speculative eco-thriller, or middle grade fantasy.
Target Audience and Market Position Statement are also required because comparables alone do not tell a publishing professional who the manuscript is for or where it sits on the shelf.

A RevisionGrade/Agent Readiness package may satisfy this requirement when it includes or is supplemented with every required Storygate field. Creators are not required to purchase RevisionGrade services. Equivalent professional materials may qualify if they meet the same package and readiness standard.

---

## Professional Readiness Package Doctrine

Each Storygate package field answers a distinct professional-readiness question. Fields must not be merged, inferred from each other, or treated as optional substitutes.

### `query_letter`

**Purpose:** Provides the concise professional submission letter that introduces the project, hook, author, and reason for consideration.

**Answers:** Why should a publishing professional keep reading?

**Must include:** project hook, title/context, category/genre signal, concise stakes or premise, and professional close.

### `synopsis`

**Purpose:** Provides the clear narrative or project overview needed to understand the full work beyond the hook.

**Answers:** What happens, what is the shape of the work, and does the story/project hold together?

**Must include:** beginning-to-end arc or nonfiction project structure, core conflict or thesis, major turns, and resolution or endpoint where applicable.

### `author_bio`

**Purpose:** Establishes the creator's relevant identity, credibility, context, and platform without inventing credentials.

**Answers:** Who is the creator, and why are they a credible or relevant person to bring this work forward?

**Must include:** only creator-supplied facts; no fabricated awards, credentials, publications, education, platform, or personal history.

### `elevator_pitch`

**Purpose:** Provides a short, fast verbal summary of the project.

**Answers:** What is this project in one quick professional exchange?

**Must include:** core premise, protagonist/subject, conflict or promise, and immediate professional clarity.

### `agent_pitch`

**Purpose:** Provides the agent-facing sales rationale and submission framing.

**Answers:** Why might an agent want to represent this, and how can they pitch it onward?

**Must include:** commercial/literary hook, audience promise, market logic, and representation-facing value proposition without guaranteeing outcomes.

### `market_comparables`

**Purpose:** Identifies successful or professionally recognizable works that help frame market adjacency.

**Answers:** What is this like in the current or relevant publishing market?

**Must include:** comparable titles/authors or adjacent works with rationale. Comparables are required and are not optional positioning garnish.

### `market_category`

**Purpose:** Provides the operational publishing shelf location.

**Answers:** Where does this manuscript live operationally?

**Examples:** Upmarket Suspense; Commercial Thriller; Literary Fiction; Historical Mystery; Speculative Eco-Thriller; Middle Grade Fantasy.

**Must include:** a concise category/lane usable by agents, editors, scouts, or acquisition readers. It is not the same as comparables and must not be replaced by the market position statement.

### `target_audience`

**Purpose:** Identifies the intended readership and buying audience.

**Answers:** Who is this for?

**Must include:** audience segment, readership expectations, age band where relevant, and any professional audience constraints without making unsupported sales claims.

### `market_position_statement`

**Purpose:** Explains why the project belongs in its category and how it sits on the shelf.

**Answers:** Why does it belong there, and what is its shelf logic?

**Must include:** category fit, audience promise, differentiator, and market rationale. It may use comparables as support but must not merely repeat a comparable list.

### `sample_pages`

**Purpose:** Provides representative manuscript material for professional review.

**Answers:** Can the writing itself sustain the package claims?

**Must include:** creator-approved pages or manuscript materials appropriate to the project and access scope. Sample material is controlled access, not public browsing.

### `rights_declaration`

**Purpose:** Confirms that the creator has the rights needed to submit or present the project.

**Answers:** Who owns or controls the work for submission purposes?

**Must include:** explicit rights confirmation before listing activation. Missing, false, or unverifiable rights status blocks Storygate promotion.

---

## Access Doctrine

Storygate Studio is controlled access, not open browsing.

- Projects are not publicly searchable.
- Publishing professionals must be verified before viewing controlled materials or requesting project access.
- Access requests do not grant access automatically.
- Creator/admin approval is required per project.
- Approved users may view only creator-approved materials.
- Views, downloads, access decisions, revocations, and verification actions require append-only audit events before Storygate can be SIPOC-enforced.

---

## Rights Doctrine

Storygate Studio requires an explicit rights declaration before listing activation. The system must not promote projects when rights status is missing, false, or unverifiable.

---

## Base44 Legacy Policy

Base44 Storygate files are historical artifacts only. They must not be cited as binding authority for current Storygate Studio threshold, package scope, workflow, or runtime certification.

If Base44 files remain in the repository, current Storygate registries may reference them only with:

`authorityLevel = legacy_reference_only`

They must have no binding stage or artifact authority over current Storygate Studio SIPOC/FIPOC contracts.

---

## Governance Status

Storygate is currently **registry-described** and **partial**. It is not fully SIPOC-enforced.

Known missing-critical enforcement areas include:

- Current-canon submission persistence.
- Centralized intake validation.
- Internal screening persistence.
- Tier assignment persistence/audit.
- Professional verification enforcement.
- Listing activation persistence.
- Access request persistence.
- Creator/admin approval persistence.
- Controlled viewing enforcement.
- Structured append-only audit events.
- Revocation/expiration enforcement.

Accurate registry description is required before implementation work claims certification. A SIPOC/FIPOC must expose gaps honestly; it must not certify UI simulation as enforcement.
