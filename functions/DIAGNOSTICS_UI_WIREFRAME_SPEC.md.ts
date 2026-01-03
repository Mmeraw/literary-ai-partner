# Diagnostics Dashboard — UI Wireframe Specification
## Engineering-Usable, No Design Guesswork

**Purpose:** Provide clear UI structure for Base44 engineering without requiring design interpretation  
**Last Updated:** 2026-01-03  
**Status:** Implementation-Ready

---

## 1. Entry Point & Navigation

### How Users Access Diagnostics
1. **Automatic Trigger:** After Evaluate completes, dashboard opens automatically
2. **Manual Access:** From Manuscript Dashboard → "View Diagnostics" button
3. **Version History:** From OutputVersion detail view → "Diagnostics" tab

### Workflow Integration
```
Evaluate → Diagnostics → Revise
   ↓          ↓            ↓
 Measure   Evidence    Controlled Change
```

**Critical Rule:** Revise button disabled until diagnostics complete.

---

## 2. Page Layout (Top → Bottom)

### A. Header Bar
**Location:** Fixed at top, scrolls away on mobile

**Elements (Left to Right):**
1. **Page Title:** "Diagnostics"
2. **Mode Indicator:** Stepper UI showing `Evaluate → Diagnostics → Revise`
3. **Status Badge:** 
   - ✅ Complete (green)
   - ⏳ Running (yellow with spinner)
   - ⚠️ Warnings Present (amber)
4. **Last Updated:** Timestamp (e.g., "Updated 2 hours ago")
5. **Action Buttons:**
   - "Re-run Diagnostics" (primary button)
   - "View Audit Trail" (secondary button, opens modal)

**Visual Hierarchy:**
- Title: 24px bold
- Status badge: Inline with title, right-aligned
- Timestamp: 14px gray text below title
- Buttons: Standard button sizing, right-aligned

---

### B. Summary Strip
**Location:** Below header, full-width banner

**Purpose:** At-a-glance manuscript health

**Elements (3 tiles, side-by-side):**

#### Tile 1: Overall Revision Score
- **Score Display:** Large number (0–100) or letter grade (A–F)
- **Label:** "Overall Revision Score"
- **Tooltip:** "Weighted from 13 core criteria"
- **Subtext:** Issue breakdown (e.g., "13 critical, 42 major, 103 minor")

#### Tile 2: Revision Readiness
- **Status Indicator:** Traffic-light badge (🔴/🟡/🟢)
- **Label:** "Revision Readiness"
- **Status Text:**
  - 🔴 "Not Ready — Critical issues must be resolved"
  - 🟡 "Limited Ready — Some issues remain"
  - 🟢 "Ready — All critical issues addressed"

#### Tile 3: Canon Status (Phase 2)
- **Score Display:** Canon Drift Score (0–100)
- **Label:** "Canon Integrity"
- **Status Text:** "No drift detected" or "⚠️ Drift warnings present"
- **Phase 1 Placeholder:** "Canon monitoring active"

---

### C. Metrics Grid
**Location:** Below summary strip

**Layout:** Responsive grid (3 columns desktop, 2 tablet, 1 mobile)

**Tile Count:** 8–13 tiles (depending on phase)

**Each Tile Contains:**
1. **Title** (e.g., "Pacing & Momentum", "Dialogue Balance")
2. **Score** (0–100) with color indicator:
   - 🔴 Red: < 60
   - 🟡 Yellow: 60–79
   - 🟢 Green: ≥ 80
3. **Issue Summary:** "3 critical, 12 major, 24 minor"
4. **Evidence Badge:** Small "🔍 Evidence" label (clickable)
5. **Primary Action:** "View Details" button → scrolls to relevant panel

**Tile Interaction:**
- Hover: Subtle lift + shadow
- Click title/score: Opens details panel
- Click Evidence Badge: Opens evidence modal (see section 3)

---

### D. Diagnostics Panels (Tabbed Interface)
**Location:** Below metrics grid

**Tabs:** Core · Repeats · Structure · Canon

**Tab Behavior:**
- Default: Core tab active
- URL param: `?tab=repeats` for deep linking
- Persistent scroll position when switching tabs

---

#### Tab 1: Core
**Focus:** High-level manuscript health

**Widgets (Vertically Stacked):**

##### Widget 1: Pacing Chart
- **Type:** Line chart
- **X-Axis:** Manuscript progression (chapters or %)
- **Y-Axis:** Average paragraph length + average sentence length
- **Visual:** Dual-line chart with "ideal range" shaded band
- **Interaction:** 
  - Hover: Show chapter number + exact values
  - Click: Jump to chapter in manuscript view

##### Widget 2: Readability Band
- **Type:** Horizontal bar with zones
- **Display:** Flesch-Kincaid score (e.g., "Grade Level 8.2")
- **Target Overlay:** Genre-specific expected range (e.g., "Literary Fiction: 50–70")
- **Visual:** Color-coded zones (red/yellow/green)
- **Note:** Labeled as "reference only, not a goal"

##### Widget 3: Dialogue vs Exposition Ratio
- **Type:** Stacked bar chart per chapter
- **Display:** % dialogue (blue) vs % narrative (gray)
- **Baseline:** Genre-specific expected range overlay
- **Interaction:** Click bar → Jump to chapter

---

#### Tab 2: Repeats
**Focus:** Repetition diagnostics (AutoCrit/ProWritingAid parity)

**Widgets (Vertically Stacked):**

##### Widget 1: Top Repeated Words/Phrases
- **Type:** Sortable table
- **Columns:**
  - Term
  - Count
  - Frequency (per 1000 words)
  - Ideal Range (if genre baseline available)
- **Interaction:**
  - Click term → Highlights all occurrences in manuscript
  - "Queue for Revision" button per row (adds to revision task list)

##### Widget 2: Overused Patterns
- **Type:** Card list
- **Examples:**
  - "Sentences starting with 'And': 12% (genre avg: 6%)"
  - "Adverb density: 3.2% (genre avg: 2.1%)"
  - "Filter words: 47 instances (high for this genre)"
- **Interaction:** Click pattern → Show examples

##### Widget 3: Word Frequency Heatmap
- **Type:** Visual heatmap
- **Display:** Manuscript sections color-coded by repetition density
- **Interaction:** Click section → Jump to chapter, highlight repeated terms

---

#### Tab 3: Structure
**Focus:** Story spine, scene integrity, POV consistency

**Widgets (Vertically Stacked):**

##### Widget 1: Scene Length Distribution
- **Type:** Histogram
- **X-Axis:** Scene length brackets (e.g., <500, 500–1000, 1000–2000, >2000 words)
- **Y-Axis:** Count of scenes
- **Visual:** Bars with genre norm overlay
- **Flags:** Outliers highlighted in red

##### Widget 2: POV & Tense Consistency
- **Type:** Timeline
- **Display:** Manuscript timeline with POV/tense shifts marked as pins
- **Visual:** Color-coded pins (e.g., blue = 1st person, green = 3rd person, red = tense shift)
- **Interaction:** Click pin → Jump to segment

##### Widget 3: Spine Alignment
- **Type:** Story spine diagram
- **Display:** Vertical timeline with key story beats marked:
  - Opening Hook
  - Inciting Incident
  - Midpoint
  - Climax
  - Resolution
- **Visual:** Expected positions (dotted lines) vs actual positions (solid markers)
- **Interaction:** Click beat → Jump to chapter

---

#### Tab 4: Canon (Phase 1: Placeholder | Phase 2: Fully Wired)

**Phase 1 UI:**
- **Canon Status Tile:**
  - Label: "Canon Lock: ON/OFF"
  - Subtext: "X constraints defined"
- **Drift Preview Banner:**
  - Icon: 🔒
  - Text: "Canon drift scoring coming soon. Validators are actively enforcing canon in the background."
  - CTA: "Learn More" → links to methodology

**Phase 2 UI:**

##### Widget 1: Canon Drift Score
- **Type:** Large numeric score (0–100)
- **Visual:** Traffic-light color
- **Label:** "Canon Integrity Score"
- **Subtext:** "Deviation from approved baseline"

##### Widget 2: Drift Map
- **Type:** Table
- **Columns:**
  - Segment
  - Drift Type (voice / factual / style)
  - Severity (high / medium / low)
  - Details
- **Interaction:** Click row → Jump to segment, show comparison

##### Widget 3: Drift Timeline
- **Type:** Line chart
- **X-Axis:** Version history
- **Y-Axis:** Drift score
- **Visual:** Trend line showing drift over time

---

### E. Revision Readiness Footer
**Location:** Fixed at bottom, always visible

**Purpose:** Final gate before Revise action

**Elements:**

#### Left Section: Summary
- **Diagnostics Status:** "✅ Complete" or "⏳ Running"
- **Warnings Present:** "⚠️ 3 critical issues" or "✓ No critical issues"
- **Canon Status:** "🔒 Canon locked" or "⚠️ Drift detected"

#### Right Section: Actions
- **Primary Button:** "Proceed to Revise"
  - Enabled: Only if diagnostics complete AND (Green or Amber readiness)
  - Disabled: If Red readiness or diagnostics missing
  - Tooltip (if disabled): "Resolve critical issues first"
  
- **Secondary Button:** "Override & Log Reason"
  - Visible: Only if Amber readiness (soft-fail)
  - Behavior: Opens modal requiring reason + confirmation
  - Logs: Override recorded in EvaluationAuditEvent

---

## 3. Evidence Badge Modal

**Trigger:** Click any "🔍 Evidence" badge

**Modal Contents:**
- **Header:** Validator name (e.g., "PACING_SENTENCE_LENGTH_VARIANCE")
- **Section 1: Rule Description**
  - Plain English explanation of what the validator checks
  - Link to full methodology documentation
- **Section 2: Affected Segments**
  - List of 3–5 flagged segments with:
    - Line numbers
    - Excerpt (50 words context)
    - Highlight of specific issue
- **Section 3: Audit Trail**
  - Timestamp of evaluation
  - EvaluationAuditEvent ID (clickable)
- **Footer:**
  - "View Full Audit Log" button
  - "Close" button

---

## 4. Critical UX Rules

### Rule 1: No Inline Rewriting
- Diagnostics is **read-only**
- No "fix" buttons
- No "apply suggestion" actions
- Only "View Details" and "Queue for Revision"

### Rule 2: No Hidden Automation
- Every metric must show its source
- No "magic" scores without explanation
- No AI generation without explicit user trigger

### Rule 3: Every Warning Explainable in One Click
- Evidence Badge always present
- Modal always shows:
  - What rule fired
  - Why it fired
  - Where it fired
  - When it fired

### Rule 4: Gating is Enforced, Not Suggested
- Revise button state controlled by backend, not just UI
- Overrides require explicit confirmation + reason
- All overrides logged in audit trail

---

## 5. Responsive Behavior

### Desktop (≥1024px)
- Full 3-column metrics grid
- Side-by-side summary tiles
- Tabbed panels with full widgets

### Tablet (768px–1023px)
- 2-column metrics grid
- Stacked summary tiles
- Tabbed panels with simplified widgets (e.g., smaller charts)

### Mobile (≤767px)
- 1-column metrics grid
- Vertically stacked summary tiles
- Accordion-style panels instead of tabs
- Evidence modals full-screen

---

## 6. Loading & Error States

### Loading State
- Skeleton loaders for all tiles/panels
- Message: "Loading diagnostics..."
- Expected time: < 2 seconds
- If > 5 seconds: "Taking longer than usual..." with cancel option

### Empty State
- Icon: Empty document illustration
- Message: "No diagnostics available yet"
- CTA: "Run your first evaluation to see diagnostics"

### Error State
- Icon: Warning triangle
- Message: "Unable to load diagnostics"
- Details: Specific error reason (e.g., "WAVE validator failed")
- CTA: "Retry" button + "Contact Support" link

---

## 7. Accessibility

- All interactive elements keyboard navigable
- Evidence modals closable via Esc key
- ARIA labels on all charts and graphs
- Color-blind safe palette (red/yellow/green with icons/patterns)
- Screen reader announcements for status changes

---

## 8. Implementation Notes for Base44

### Data Fetching
```javascript
// Primary API call
GET /api/diagnostics/:manuscript_id

Response:
{
  overall_score: 78,
  readiness_status: 'amber',
  category_scores: [...],
  metrics: {...},
  audit_event_id: 'evt_123',
  last_updated: '2026-01-03T10:30:00Z'
}
```

### Gating Logic (Frontend)
```javascript
const canRevise = (diagnostics) => {
  if (!diagnostics.completed) return false;
  if (diagnostics.readiness_status === 'red') return false;
  if (manuscript.updated_at > diagnostics.last_updated) return false;
  return true;
};
```

### Evidence Modal Data
```javascript
// Secondary API call
GET /api/diagnostics/evidence/:validator_id

Response:
{
  validator_name: 'PACING_SENTENCE_LENGTH_VARIANCE',
  rule_description: '...',
  affected_segments: [...],
  audit_event_id: 'evt_123',
  timestamp: '2026-01-03T10:30:00Z'
}
```

---

## 9. Phase Rollout

### Phase 1: Core UI (Sprint 1-2)
- Header + Summary Strip
- Metrics Grid (static scores)
- Core/Repeats/Structure tabs (basic)
- Evidence Badge modals
- Revision Readiness Footer

### Phase 2: Interactivity (Sprint 3)
- Clickable charts → manuscript navigation
- "Queue for Revision" functionality
- Progress Over Time visualization

### Phase 3: Canon (Sprint 4+)
- Canon tab fully wired
- Drift scoring + timeline
- Advanced override workflows

---

**END OF UI SPEC**