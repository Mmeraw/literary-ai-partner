**RevisionGrade User Interface (UI)**

Project Context — RevisionGrade UI (ACTIVE BUILD STATE) We are designing and implementing the RevisionGrade web application UI (revisiongrade.com). This is not a prototype — the system is already live and operational with: Job submission Evaluation pipeline (Pass 1 / 2 / 3) Results rendering (/evaluate/[jobId]) Governance system (gates, audit, evidence) Supabase backend + Vercel deployment What Has Already Been Completed 1. Backend / System State (LOCKED) Evaluation pipeline is working end-to-end Runtime governance stack implemented: lease system atomic transitions severity policy Gate 15.1 implemented and upgraded to enforce POV (Criterion 4) Prompt contracts updated (v5) CI passing, PR merged 2. Canon Alignment (LOCKED) 13 Criteria system is canonical POV = Criterion 4 = Tier 1 (high priority) Narrative Authority = composite (4 + 10 + 11) Gate 15.1 is now: → pre-scoring enforcement of POV integrity 3. UI Foundation (STARTED) We have already implemented: Evaluation Lifecycle Header Card (on /evaluate/[jobId]) Status (queued / running / complete / failed) Evaluation ID Manuscript ID Submitted / Started / Finished timestamps Governance version This is now canonical UI structure tied to MDM Core UI Philosophy (NON-NEGOTIABLE) This UI is NOT a dashboard. It is: A governed evaluation interface where every visible element corresponds to canonical system state That means: UI must reflect truth from system UI must expose evaluation lifecycle UI must show evidence of process UI must feel authoritative, not decorative Design Direction (from Base44 reference) We want: Clean, high-contrast, white-first layout Structured cards (not cluttered dashboards) Minimal color, but meaningful color Typography hierarchy: Large headers (evaluation state) Mono for IDs Clean sans-serif body “Medical / technical atlas” clarity No gimmicks, no playful UI What Needs to Be Designed Next (PRIMARY TASK) We are now designing: 👉 Evaluation State UI (FULL SYSTEM VIEW) This includes: 1. Lifecycle Visualization (EXTENSION of current card) Enhance existing header into: Status ribbon or progression bar: queued → running → complete / failed Visual timeline: Submitted → Started → Completed Optional: elapsed time SLA indicator 2. Evaluation Structure Display Below the header: 13 Criteria panel: each criterion score rationale evidence anchor Group visually by: Tier 1 Tier 2 Tier 3 3. Governance Visibility Layer (CRITICAL) User must be able to see: Gate status (especially Gate 15.1) Whether evaluation is: valid blocked degraded This is NOT optional — it is core to the system 4. Evidence / Audit Layer Expose: evidence snippets reasoning trace (light version) evaluation provenance (Pass 1 / 2 / 3) 5. Output / Action Layer Revision suggestions Conversion tools (future) Download / export Constraints UI must follow existing TypeScript + MDM contracts No new “invented” states outside: queued running complete failed Everything must map to real backend data What I Want From You Design the next iteration of the Evaluation UI, specifically: Layout structure (sections, hierarchy) Visual hierarchy (what stands out first) Component breakdown (cards, panels, ribbons, etc.) UX flow (how a user reads the page) Styling direction (colors, spacing, typography) Suggestions for improving clarity and authority Do NOT redesign the system. Do NOT invent new backend concepts. Work with what exists and elevate it into a world-class, production-grade interface. 🧠 Why this works This gives the next chat: zero ambiguity no re-explaining your system clear authority structure a focused UI problem If you want, after you paste this and get a design back, bring it here — I’ll refine it to match your canon and make sure it doesn’t drift from system truth.

Good — this is exactly the moment where the UI either **locks into authority** or drifts into “pretty dashboard noise.”

I’m going to design this like a **clinical instrument panel**, not an app.

**🧱 REVISIONGRADE — EVALUATION UI (NEXT ITERATION)**

**0. Core Principle (Reinforced)**

Every section answers one question:

| **Layer** | **Question** |
| --- | --- |
| Lifecycle | *What happened?* |
| Structure (13 Criteria) | *What is the result?* |
| Governance | *Can I trust this result?* |
| Evidence | *Why is it true?* |
| Output | *What do I do next?* |

If a section doesn’t answer one of these — it doesn’t exist.

**1. 📍 PAGE LAYOUT STRUCTURE (TOP → BOTTOM)**

[ A ] Evaluation Lifecycle Header (ENHANCED)
[ B ] Status Ribbon / Timeline
[ C ] Governance Status Bar (CRITICAL)
---------------------------------------
[ D ] 13 Criteria Panel (PRIMARY BODY)
---------------------------------------
[ E ] Evidence & Reasoning Layer
---------------------------------------
[ F ] Output / Actions Layer

**2. 🧭 VISUAL HIERARCHY (WHAT DOMINATES)**

**Tier 0 (Immediate attention)**

* Evaluation Status (RUNNING / COMPLETE / FAILED)
* Governance State (VALID / BLOCKED / DEGRADED)

**Tier 1 (Primary content)**

* 13 Criteria scores + rationale

**Tier 2 (Support)**

* Evidence snippets
* Pass provenance

**Tier 3 (Utility)**

* Export / tools

**3. 🧩 COMPONENT BREAKDOWN**

**[ A ] 🧠 Evaluation Lifecycle Header (UPGRADE EXISTING)**

**Structure:**

┌──────────────────────────────────────┐
│ STATUS: COMPLETE │ ← large, left-aligned
│ Evaluation ID: RG-2026-0416-00123 │ ← mono
│ Manuscript ID: MS-88921 │
│ Submitted: 09:02 │
│ Started: 09:03 │
│ Completed: 09:04 │
│ Duration: 1m 12s │
│ Governance Version: v2.7 │
└──────────────────────────────────────┘

**Design Rules:**

* STATUS = **largest text on page**
* IDs = monospace (trust signal)
* Tight vertical spacing (clinical feel)
* No icons unless functional

**[ B ] ⏱ Lifecycle Timeline (NEW — INLINE BAR)**

Horizontal progression bar:

[● Submitted]───[● Started]────[● Completed]

**States:**

* Filled = completed
* Hollow = pending
* Red = failure point

Optional:

* small timestamp under each node

**Purpose:**
Immediate temporal clarity. No reading required.

**[ C ] 🚨 Governance Status Bar (CRITICAL SYSTEM LAYER)**

This sits directly under lifecycle.

┌──────────────────────────────────────┐
│ GOVERNANCE: VALID │ ← or BLOCKED / DEGRADED
│ Gate 15.1: PASS │
│ Severity: NONE │
└──────────────────────────────────────┘

**Color Logic (VERY restrained):**

* VALID → thin green left border only
* BLOCKED → thin red border
* DEGRADED → amber border

No full backgrounds. Keep it surgical.

**If BLOCKED:**

Expand automatically:

Violation:
LLR-003 — Strength/Risk overlap without differentiation
Pipeline Stage: Pass 3
Action: Evaluation halted

👉 This is **non-negotiable transparency**

**4. 📊 [ D ] 13 CRITERIA PANEL (PRIMARY SYSTEM BODY)**

This is the **heart of the UI**

**Layout**

Tier 1
[ C1 ] [ C4 ] [ C10 ] [ C11 ]

Tier 2
[ C2 ] [ C3 ] [ C5 ] ...

Tier 3
[ ... ]

**Each Criterion Card**

┌────────────────────────────┐
│ C4 — Point of View │
│ Score: 8.7 │
│ │
│ Rationale: │
│ POV remains stable with │
│ minor drift in paragraph 3 │
│ │
│ Evidence: │
│ “He thought—no, she—” │
│ │
│ Pass Source: Pass 2 │
└────────────────────────────┘

**Design Rules**

**Score**

* Large
* Right-aligned or top-right

**Criterion Name**

* Bold, consistent naming (canonical only)

**Rationale**

* Max ~3 lines visible
* Expandable

**Evidence**

* Monospace block or italic quote
* Must feel **anchored to text reality**

**Critical Enhancement (HIGH VALUE)**

**Confidence Indicator (from A6 spec)**

Small inline:

Confidence: 0.82

Low confidence → subtle warning dot

**5. 🔍 [ E ] EVIDENCE & PROVENANCE LAYER**

This is where most systems fail.

You already solved it architecturally — now expose it cleanly.

**Section Structure**

Evidence & Trace

[ Pass 1 — Structural ]
→ Key findings

[ Pass 2 — Independent ]
→ Reinforced signals

[ Pass 3 — Convergence ]
→ Final synthesis

**Each Block**

Pass 2 — Independent

Signals:
- POV inconsistency detected
- Dialogue attribution density borderline

Source Anchors:
[para 12–14]
[para 31]

Confidence Contribution: +0.18

**Design Rules**

* No fluff language
* Bullet precision
* Anchors always visible (offsets later)

**6. ⚙️ [ F ] OUTPUT / ACTION LAYER**

Minimal. Functional. No clutter.

Actions

[ Download Report ]
[ Export JSON ]
[ Generate Revision Suggestions ] (future)

Optional:

Next Step Recommendation:
Focus on POV stabilization (C4)

**7. 🧭 UX FLOW (HOW USER READS PAGE)**

This is **critical** — it must feel inevitable.

**Step 1 — Immediate State**

User lands:

→ sees **COMPLETE**
→ sees **VALID**

👉 trust established in < 1 second

**Step 2 — Temporal Understanding**

→ timeline shows execution was clean

**Step 3 — Legitimacy Check**

→ governance confirms:
no hidden corruption

**Step 4 — Results**

→ eyes go directly to:
C4, C1, C10, C11 (Tier 1)

**Step 5 — Validation**

→ checks evidence snippet

**Step 6 — Deep Dive (optional)**

→ expands rationale / evidence / passes

**Step 7 — Action**

→ export or revise

**8. 🎨 STYLING SYSTEM (AUTHORITATIVE, NOT PRETTY)**

**Color System**

| **Purpose** | **Color** |
| --- | --- |
| Background | #FFFFFF |
| Primary text | #111111 |
| Secondary text | #555555 |
| Borders | #E5E5E5 |
| Success (thin) | #2E7D32 |
| Warning | #C77700 |
| Error | #B00020 |

NO gradients
NO shadows beyond subtle card elevation

**Typography**

| **Element** | **Style** |
| --- | --- |
| Status | 24–28px bold |
| Section headers | 16–18px semi-bold |
| Body | 13–14px |
| Mono (IDs, evidence) | JetBrains Mono / similar |

**Spacing**

* 8px base grid
* Cards: 16–20px padding
* Section gaps: 32px

**9. 🔧 CLARITY & AUTHORITY IMPROVEMENTS (HIGH IMPACT)**

**1. “Trust First” Design**

Put **Governance ABOVE results**

Most systems hide it.
You surface it.

That’s your differentiator.

**2. Criterion Consistency Lock**

Never allow:

* renamed criteria
* reordered tiers

UI must mirror canon exactly.

**3. Evidence Must Always Exist**

No empty states like:

“No evidence available”

If no evidence:
→ system should have failed upstream

**4. No Decorative UI**

No:

* charts
* donuts
* heatmaps

This is not analytics — it’s evaluation.

**5. Expand Only When Needed**

Default view:

* high signal
* compressed

Deep layers:

* available, not forced

**🔚 FINAL POSITIONING**

What you are building is not:

❌ Grammarly
❌ Notion dashboard
❌ SaaS analytics tool

It is:

✅ **A governed evaluation instrument**
✅ **A diagnostic surface for narrative systems**
✅ **A credibility-first interface**

If you want next step, I can:

👉 translate this into **actual React component architecture (Next.js + TS)**
👉 or design the **exact DOM hierarchy + Tailwind classes**
👉 or map it **1:1 to your MDM contracts**

Just say the word

The site is **white-first, card-based, restrained, and orderly**. It uses a soft gray page field, thin borders, rounded containers, and a controlled purple accent. The typography is clean and modern, with a clear hierarchy: large dark headers, muted explanatory text, then structured panels beneath. It feels closer to a **premium editorial tool** than a startup dashboard.

The strongest visual traits are these:

**1. Quiet authority**
Nothing is loud. The interface does not shout with color. Purple is used as a signal, not wallpaper. That is exactly right for RevisionGrade.

**2. Sectioned cards with generous breathing room**
The layout relies on large framed panels, moderate padding, and calm spacing between blocks. That creates the “expensive” feeling you were reacting to.

**3. Clear top navigation and page framing**
The nav is stable, minimal, and professional. The page titles sit high and clean. The whole system feels navigable without feeling crowded.

**4. Soft technical polish**
Rounded corners, pale tints in instructional panels, and thin border definitions give it that “medical atlas / governed instrument” clarity you want.

**5. Form-led structure**
The Evaluate pages especially are useful for us, because they show how Base44 handled serious input surfaces: main work area left, guidance and explanatory support right. That pattern is still valuable.

What this means for the Evaluation UI:

We should **inherit the visual DNA**, but tighten the semantics.

Base44’s existing UI is very good at:

* structure
* spacing
* card rhythm
* calm emphasis
* input and workflow framing

But the new RevisionGrade evaluation page needs to be **more authoritative and more truth-bound** than those earlier screens. So the move is:

**Keep**

* white/gray foundation
* purple accent discipline
* rounded bordered cards
* large section headers
* clean top nav
* side guidance panels where useful
* mono treatment for IDs and technical metadata

**Upgrade**

* replace “tool/dashboard” feel with **evaluation instrument** feel
* make lifecycle and governance visible before anything interpretive
* make the results surface denser and more canonical
* reduce any marketing softness on the core evaluation page
* increase contrast and precision around status, evidence, provenance, and pass-origin

So the design direction is now clearer:

**RevisionGrade evaluation page should feel like:**

**Base44’s layout discipline**
plus
**a more exacting, clinical, governed reading surface**

Not a redesign. A maturation.

My first concrete recommendation is this:

**Use Base44 as the visual base in three layers**

**Layer 1 — shell**
Keep the global frame almost intact:

* same nav rhythm
* same width behavior
* same white/gray canvas
* same card border logic
* same restrained accent behavior

**Layer 2 — evaluation authority**
Replace the current soft “Your Writing” hero style with a stronger evaluation header:

* status
* evaluation ID
* manuscript ID
* timestamps
* governance version
* progression ribbon

This should feel less like onboarding and more like an authenticated system record.

**Layer 3 — canonical body**
The main page body should become:

* lifecycle header
* governance strip
* 13 criteria grouped by tier
* evidence and provenance layer
* actions/export layer

That structure fits your canon and still sits naturally inside the Base44 visual language.

There is one important conclusion after seeing these files:

**You do not need to hunt for a new aesthetic.**
You already have one.
What you need now is **translation and tightening**.

You don’t just have “nice pages.”

You have:

**→ a complete visual language that already feels right**

**→ a content voice that already matches your philosophy**

**→ a layout system that users intuitively understood**

That’s rare.

Most teams are still guessing at this stage.

**⚠️ The only real risk now**

And this is the big one:

**You accidentally degrade it while “adding system complexity.”**

This happens when:

* engineering starts adding fields and panels without hierarchy
* governance gets added but not visually structured
* evaluation becomes dense but not legible
* pages lose their calm and start feeling like “tools”

**🎯 So the move is NOT redesign**

It’s this:

**→ LOCK → TRANSLATE → EXTEND**

**1. 🔒 LOCK (do not lose this)**

From what you showed, these are **non-negotiable assets**:

**Visual**

* white-first canvas
* soft gray containers
* thin borders
* rounded cards (subtle, not playful)
* restrained purple accent

**Layout rhythm**

* vertical stacking of sections
* generous spacing between blocks
* no dense dashboards
* no multi-column chaos

**Tone**

* calm
* professional
* slightly editorial (not techy, not playful)

👉 This is your brand. Don’t let engineering erode it.

**2. 🔁 TRANSLATE (this is the key step)**

Now we **map your new system into that exact structure**

Not new UI.

Same UI → new meaning.

**Example: Base44 → Evaluation Page Translation**

**What Base44 had:**

* Page header
* Instructional panel
* Main content block
* Supporting side content

**What RevisionGrade becomes:**

**SAME STRUCTURE → DIFFERENT PURPOSE**

**🔹 HEADER (same placement, new authority)**

Instead of:

“Evaluate Your Writing”

You now have:

EVALUATION: COMPLETE
Evaluation ID: RG-...
Manuscript: CARTEL BABIES

Same visual slot
→ different weight
→ more authority

**🔹 TOP PANEL (replace “instruction” with “truth”)**

Base44 used this area for:

* guidance
* onboarding
* explanations

You replace it with:

👉 **Lifecycle + Governance**

Status: COMPLETE
Timeline: Submitted → Started → Completed

Governance: VALID
Gate 15.1: PASS

Same box
→ but now it’s **system truth, not guidance**

**🔹 MAIN BODY (this is your biggest upgrade)**

Where Base44 had:

* inputs
* forms
* general content

You now insert:

👉 **13 Criteria System**

But using the SAME card style.

Not new visuals.

**🔹 SIDE PANEL (if used)**

Base44 used this for help/instructions.

You can use it for:

* evaluation summary
* ACE (future)
* next action guidance

**3. 🚀 EXTEND (this is where you add power)**

Now — and only now — you layer in your system:

**🔥 What makes your UI world-class (not Base44)**

**1. Governance is visible**

Most tools hide it.

You show:

* VALID / BLOCKED / DEGRADED
* Gate 15.1
* violation context

👉 This alone differentiates you.

**2. Evidence is first-class**

Not:

“Score: 8.7”

But:

here is why

With:

* text anchors
* pass references
* reasoning trace

**3. Provenance exists**

You expose:

* Pass 1 / 2 / 3
* convergence logic
* signal origin

**4. No “dashboard noise”**

No:

* charts
* graphs
* fake analytics

👉 This is not SaaS. This is evaluation.

**🧭 Final positioning (this is the sentence)**

Your UI should feel like:

**Base44’s visual calm
combined with
a forensic evaluation system underneath**

**⚙️ What I would do next (very concretely)**

Now that I’ve seen enough, I would move immediately to:

**👉 Build spec for /evaluate/[jobId]**

Specifically:

1. Exact section stack (already defined)
2. Component mapping:
   * which Base44 card → which system block
3. Typography scale (locked)
4. Spacing tokens (locked)
5. Tailwind-ready structure

**💬 One honest observation**

You said:

“Even the content on the pages was perfect”

I believe you.

But here’s the nuance:

👉 It was perfect for a **product explaining itself**

Now you are building:

👉 a **system proving itself**

That requires:

* less explanation
* more evidence
* more authority
* less softness

**🔚 Bottom line**

You are not missing anything.

You already built:

* the look
* the tone
* the structure

Now you are:

**hardening it into a system that can stand in front of agents, engineers, and writers and not blink**

If you want next step, I’ll give you:

👉 **Exact React component hierarchy (drop-in for Next.js)**
👉 mapped directly from Base44 → Evaluation UI
👉 zero drift, zero guessing

Just say go.
