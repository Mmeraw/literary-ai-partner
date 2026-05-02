**GATE\_15\_1\_PR5\_FRONT\_END\_VISIBILITY\_SPEC.md**

**RevisionGrade — PR5 Front-End Visibility Specification**

**Scope:** PR5 only
**Purpose:** Expose Gate 15.1 results in the RevisionGrade interface so failures are visible, actionable, and impossible to miss.

**1. Objective**

PR5 implements the **front-end visibility layer** for Gate 15.1.

This PR must expose:

* **Gate 15.1 summary card**
* **Q1–Q5 and D1–D3 result panels**
* **flagged line table**
* **governance log panel**
* **resubmit / rerun controls**

PR5 must ensure the UI reflects governance truth:

* blocked chapters look blocked
* failed gates are visually explicit
* line-level violations are reviewable
* governance decisions are visible
* rerun and resubmit paths are controlled

PR5 does **not** implement:

* validator logic
* governance enforcement logic
* Layer 2 review logic
* exception approval policy

It only renders and triggers existing pipeline behavior.

**2. Core UI Principle**

Gate 15.1 must be **visible as a blocking system state**, not buried as a technical detail.

The interface should make three things instantly clear:

* **Did the gate pass or fail?**
* **Why?**
* **What can the user do next?**

**3. Deliverables**

**New / updated front-end files**

/apps/web/app/chapters/[chapterId]/page.tsx
/apps/web/components/gates/Gate15SummaryCard.tsx
/apps/web/components/gates/Gate15MetricPanel.tsx
/apps/web/components/gates/Gate15FlaggedLinesTable.tsx
/apps/web/components/gates/Gate15GovernanceLogPanel.tsx
/apps/web/components/gates/Gate15ActionsBar.tsx
/apps/web/components/gates/Gate15StatusBadge.tsx
/apps/web/lib/api/gate15.ts
/apps/web/lib/types/gate15-ui.ts

**Optional styling / support files**

/apps/web/components/ui/EmptyState.tsx
/apps/web/components/ui/SectionCard.tsx
/apps/web/components/ui/BlockingBanner.tsx

**4. Required Page Placement**

**Primary page**

Gate 15.1 should appear on the **chapter detail page**:

/projects/[projectId]/chapters/[chapterId]

**Recommended layout order**

1. Chapter header
2. Blocking banner (if failed)
3. Gate 15.1 summary card
4. Q1–Q5 and D1–D3 results
5. Flagged line table
6. Governance log panel
7. Actions bar

**5. Gate 15.1 Summary Card**

**Component**

/apps/web/components/gates/Gate15SummaryCard.tsx

**Purpose**

Provide an at-a-glance status view for the gate.

**Must display**

* gate name: **Gate 15.1 — Dialogue & Attribution Purity Gate**
* overall status: PASS / FAIL
* blocking state: YES / NO
* chapter state
* last run timestamp
* whether Layer 2 was required
* whether exception log is required

**Example layout**

┌──────────────────────────────────────────────────────┐
│ Gate 15.1 — Dialogue & Attribution Purity Gate │
├──────────────────────────────────────────────────────┤
│ Status: FAIL │
│ Blocking: YES │
│ Chapter State: blocked\_in\_revision │
│ Layer 2 Required: YES │
│ Exception Log Required: YES │
│ Last Run: 2026-03-22 20:40 │
└──────────────────────────────────────────────────────┘

**Required props**

export interface Gate15SummaryCardProps {
 overallStatus: "PASS" | "FAIL";
 blocking: boolean;
 chapterState: string;
 lastRunAt: string;
 layer2Present: boolean;
 exceptionLogRequired: boolean;
}

**6. Status Badge**

**Component**

/apps/web/components/gates/Gate15StatusBadge.tsx

**Purpose**

Render a compact PASS / FAIL badge consistently across all Gate 15 components.

**Required states**

* PASS
* FAIL
* NOT\_RUN
* PENDING\_LAYER2

**Visual rule**

FAIL and blocking states must be visually stronger than PASS states.

**7. Q1–Q5 and D1–D3 Result Panels**

**Component**

/apps/web/components/gates/Gate15MetricPanel.tsx

**Purpose**

Show each quantitative and structural result clearly.

**Required sections**

**Layer 1**

* Q1 Attribution Density
* Q2 Soft Tags
* Q3 Thought Verbs
* Q4 Physiological Fillers
* Q5 Boundary Test

**Layer 2**

* D1 Attribution Independence
* D2 Voice Differentiation Integrity
* D3 Rhythm Integrity

**Required fields per row**

* metric name
* status badge
* count or rationale
* threshold where relevant

**Example layout**

Layer 1
Q1 Attribution Density FAIL 6.77 / 1000 Threshold: 4
Q2 Soft Tags FAIL 4 Threshold: 2
Q3 Thought Verbs FAIL 3 Threshold: 0
Q4 Physiological Fillers FAIL 8 Threshold: 3
Q5 Boundary Test PASS 0

Layer 2
D1 Attribution Independence FAIL Speaker identity breaks without tags
D2 Voice Differentiation PASS Distinct voice retained
D3 Rhythm Integrity FAIL Mechanical cadence detected

**Required props**

export interface Gate15MetricRow {
 id: string;
 label: string;
 status: "PASS" | "FAIL" | "NOT\_RUN";
 count?: number;
 per1000?: number;
 threshold?: number;
 rationale?: string;
}

**8. Flagged Line Table**

**Component**

/apps/web/components/gates/Gate15FlaggedLinesTable.tsx

**Purpose**

Expose all flagged instances in a reviewable, sortable table.

**Required columns**

* line number
* matched text
* category
* context
* justification required
* exception status
* action

**Category examples**

* Q1
* Q2
* Q3
* Q4
* Q5
* D1
* D2
* D3

**Action examples**

* View context
* Add justification
* Open chapter at line
* Mark for revision

**Example layout**

| Line | Match | Cat | Context | Justification | Exception | Action |
|------|------------------|-----|--------------------------------------|---------------|-----------|---------------|
| 118 | said | Q1 | “…he said, turning toward the door…” | Required | None | Open line |
| 144 | whispered | Q2 | “…she whispered without looking…” | Required | Logged | View details |
| 170 | wondered | Q3 | “…he wondered if she knew…” | Required | None | Open line |

**Required behaviors**

* sortable by line number
* filterable by category
* filterable by unresolved only
* paginated if large
* stable ordering by line number ascending by default

**Required props**

export interface Gate15FlaggedLineRow {
 lineNumber: number;
 matchedText: string;
 category: string;
 context: string;
 justificationRequired: boolean;
 exceptionStatus: "NONE" | "LOGGED";
}

**9. Governance Log Panel**

**Component**

/apps/web/components/gates/Gate15GovernanceLogPanel.tsx

**Purpose**

Expose the governance decision trail for Gate 15.1.

**Must display**

* latest governance decision
* block reason
* next chapter state
* timestamp
* whether progression is blocked
* whether exceptions are pending

**Example layout**

Governance Log
- Gate: 15.1
- Status: FAIL
- Blocking: true
- Reason: Q1 threshold exceeded; D1 failed
- Next State: blocked\_in\_revision
- Timestamp: 2026-03-22 20:40

**Extended view**

If log history exists, show prior runs in reverse chronological order.

**Required props**

export interface GovernanceLogEntry {
 gate: "15.1";
 status: "PASS" | "FAIL";
 blocking: boolean;
 reason: string;
 nextState: string;
 timestamp: string;
}

**10. Blocking Banner**

**Component**

/apps/web/components/ui/BlockingBanner.tsx

**Purpose**

Make gate failure impossible to miss at page entry.

**Required behavior**

Show only when:

* gate overall status = FAIL
* chapter state indicates blocked progression

**Example text**

This chapter is blocked by Gate 15.1.
Scoring and Wave 16 progression are disabled until violations are corrected or explicitly justified.

**11. Resubmit / Rerun Controls**

**Component**

/apps/web/components/gates/Gate15ActionsBar.tsx

**Purpose**

Provide clear next actions.

**Required controls**

* **Re-run Layer 1**
* **Request Layer 2 Review**
* **Submit Exception**
* **Re-submit Chapter**

**Rules**

**Re-run Layer 1**

Available when:

* chapter text has changed
* user wants a fresh scan

**Request Layer 2 Review**

Available when:

* Layer 1 passed
* Layer 2 not yet run or needs rerun

**Submit Exception**

Available when:

* flagged lines exist
* justification is required

**Re-submit Chapter**

Available when:

* revision changes completed
* all required exceptions logged if needed

**Required behavior**

Buttons must reflect disabled states accurately.

Examples:

* disable Re-submit if unresolved flags exist
* disable Layer 2 if Layer 1 failed and rerun hasn’t happened
* disable scoring controls entirely if gate failed

**12. API Integration**

**File**

/apps/web/lib/api/gate15.ts

**Required client functions**

export async function fetchGate15Result(chapterId: string): Promise<Gate15Result>;
export async function fetchGovernanceLog(chapterId: string): Promise<GovernanceLogEntry[]>;
export async function runGate15Layer1(chapterId: string): Promise<Gate15Result>;
export async function runGate15Layer2(chapterId: string): Promise<void>;
export async function submitGate15Exception(payload: unknown): Promise<void>;
export async function resubmitChapter(chapterId: string): Promise<void>;

**Notes**

PR5 consumes API behavior from earlier PRs; it does not define backend enforcement.

**13. UI State Handling**

**Required states**

* not run yet
* Layer 1 running
* Layer 1 pass
* Layer 1 fail
* Layer 2 pending
* Layer 2 fail
* full pass
* blocked in revision
* loading
* empty results
* API error

**Required visual behavior**

* loading skeletons for panels
* empty state when no results exist
* clear error message when API fails
* no hidden failures

**14. Chapter Page Integration**

**File**

/apps/web/app/chapters/[chapterId]/page.tsx

**Required page flow**

load chapter
→ load Gate 15.1 result
→ load governance log
→ render blocking banner if failed
→ render summary card
→ render metric panels
→ render flagged lines
→ render governance log
→ render action bar

**Required routing behavior**

The chapter page should remain accessible even if the chapter is blocked.
Blocking applies to scoring/progression, not page visibility.

**15. Accessibility Requirements**

PR5 must ensure:

* all status indicators have text labels, not color only
* tables are keyboard navigable
* action buttons have disabled-state explanation where possible
* governance and failure text are screen-readable
* no critical information is color-dependent only

**16. Test Plan**

**Component tests**

* summary card renders PASS and FAIL correctly
* metric panel displays thresholds and rationales correctly
* flagged table sorts by line number
* governance log panel displays latest result correctly
* actions bar enables/disables controls correctly

**Integration tests**

* failed gate shows blocking banner
* failed gate disables progression-related controls
* pass state renders no blocking banner
* unresolved flags prevent resubmit control from enabling
* governance history renders in correct order

**17. Example Page Layout**

Chapter 78 — The Safe Suite

[BLOCKING BANNER]
This chapter is blocked by Gate 15.1. Scoring and Wave 16 progression are disabled.

[GATE 15.1 SUMMARY CARD]
Status: FAIL
Blocking: YES
Chapter State: blocked\_in\_revision
Last Run: 2026-03-22 20:40

[LAYER 1 / LAYER 2 METRICS]
Q1 FAIL 6.77 / 1000
Q2 FAIL 4
Q3 FAIL 3
Q4 FAIL 8
Q5 PASS 0

D1 FAIL Attribution dependence detected
D2 PASS Voice retained
D3 FAIL Mechanical cadence detected

[FLAGGED LINE TABLE]
118 said Q1 “…he said…” Required None
144 whispered Q2 “…she whispered…” Required Logged

[GOVERNANCE LOG PANEL]
FAIL — Q1 threshold exceeded; D1 failed
Next State: blocked\_in\_revision

[ACTIONS BAR]
[Re-run Layer 1] [Request Layer 2 Review] [Submit Exception] [Re-submit Chapter]

**18. Done Definition**

PR5 is complete only when:

* chapter page displays Gate 15.1 state clearly
* failed gates show blocking banner
* summary card renders correctly
* Q1–Q5 and D1–D3 results are visible
* flagged line table is reviewable and sortable
* governance log panel renders current and historical decisions
* rerun / resubmit controls behave correctly
* tests pass

**19. Next Step**

Proceed to:

**PR6 — Evidence Pack & Audit Visibility**

This will expose:

* evidence artifact links
* validator output download
* governance log download
* exception log visibility
* reproducibility / audit bundle access

**20. Final System Effect**

After PR5:

* Gate 15.1 becomes visible to the user, not just the backend
* blocked chapters are visibly blocked
* line-level failures become actionable
* governance becomes part of the author workflow
* the interface reinforces system discipline instead of hiding it

Top of Form

Bottom of Form
