# RevisionGrade™ Platform Functionality Schema

## Platform Overview
RevisionGrade™ is an end-to-end manuscript evaluation and submission preparation platform that takes writers from draft to agent-ready submission package.

---

## Core Workflow (Sequential)

### Phase 1: UPLOAD & INTAKE
**Entry Points:**
- **Upload Manuscript** (pages/UploadManuscript) - Primary entry for full novels/screenplays
- **Upload Work** (pages/UploadWork) - General upload interface
- **Evaluate Chapter/Scene** (pages/Evaluate) - Quick evaluation for individual scenes/chapters

**What Happens:**
- User submits manuscript text (TXT, DOCX, or paste)
- System splits manuscript into chapters
- Manuscript stored in `Manuscript` entity with metadata

**Output:** Manuscript record created, ready for evaluation

---

### Phase 2: EVALUATE
**Evaluation Types:**

#### A. Full Manuscript Evaluation
- **13 Story Evaluation Criteria** (Agent-Ready™ framework)
- **WAVE Revision System** (60+ craft checks across chapters)
- **Spine Analysis** (structural integrity, narrative architecture)
- **Story Architecture Layer** (continuity tracking via `NarrativeThread` entity)

**Evaluation Modes:**
- Standard (mainstream agent-ready)
- Transgressive (literary extreme/experimental)
- Trauma Memoir (survivor testimony)

**Evaluation Outputs:**
- Overall RevisionGrade score (0-100)
- Chapter-by-chapter breakdown
- WAVE craft scores per chapter
- Structural diagnostics (spine, causality, stakes, character motive)
- Continuity report (unresolved threads, missing beats)

#### B. Quick Chapter/Scene Evaluation
- 13 Story Criteria only (no full WAVE)
- 2-5 minute turnaround
- Ideal for testing opening chapters or single scenes

**Pages:**
- `pages/ManuscriptDashboard` - View manuscript evaluation results
- `pages/ChapterReport` - Detailed chapter analysis
- `pages/SpineReport` - Structural integrity report
- `pages/ValidationReport` - WAVE validation results

---

### Phase 3: REVISE
**Revision Tools:**

#### A. Revision Mode™
- Diagnostic system that identifies structural and craft weaknesses
- Does NOT auto-rewrite (shows what must change and why)
- Generates revision suggestions with alternatives
- Tracks revision effectiveness (before/after scoring)

#### B. Trusted Path™
- Guided automation for high-confidence revisions
- **Structure-gated:** Only applies line-level polish if spine is strong enough
- Prevents "false polish" (masking structural issues with clean prose)
- User remains in control (accept/reject/undo)

**Pages:**
- `pages/Revise` - Main revision interface
- `pages/EvaluateChapter` - Re-evaluate after revisions

**Entities:**
- `RevisionSession` - Tracks revision suggestions and user decisions
- `Suggestion` - Individual revision recommendations

---

### Phase 4: AGENT SUBMISSION PACKAGE
**Complete Package Creation** (pages/CompletePackage)

#### Auto-Generated Assets:
1. **Pitch Generator** (pages/PitchGenerator)
   - One-sentence pitch
   - Elevator pitch
   - Short/medium/long synopses

2. **Synopsis** (pages/Synopsis)
   - 250-word, 500-word, 1000-word versions
   - Calibrated against professional standards

3. **Author Bio** (pages/Biography)
   - Professional bio generation from user details
   - File upload support for existing bios

4. **Market Comparables** (pages/Comparables)
   - 5-10 comp titles with justification
   - Genre-matched positioning

5. **Agent Discovery** (pages/FindAgents)
   - Targeted agent search
   - Submission tracking

6. **Query Letter Builder** (pages/QueryLetter)
   - Auto-embeds pitch, synopsis, bio
   - Professional query format

**Output:** Complete submission package (PDF export ready)

---

## Parallel Workflows

### Novel-to-Screenplay Conversion
**Entry:** pages/ScreenplayFormatter

**Process:**
1. Upload novel manuscript
2. System converts to screenplay format (industry-standard)
3. Applies WriterDuet formatting conventions
4. Scene breakdown and beat mapping
5. Dialogue extraction and formatting

**Output:** Industry-standard screenplay (FDX format)

---

### Film Adaptation Package
**Entry:** pages/FilmAdaptation

**Components:**
1. **12-Slide Producer Pitch Deck**
   - Logline, synopsis, key characters
   - Genre and tone
   - Visual approach
   - Comparative titles (film comps)
   - Target audience
   - Production considerations (scope, format, positioning)
   - 5-Part Mythic Structure validation
   - Screen Viability Score (0-100)

2. **Screenplay Formatting** (if applicable)
3. **Market Positioning** (film-specific comps)

**Evaluation Standards:**
- Del Toro-level tone enforcement
- Canon compliance checks
- Producer-ready presentation

**Output:** 12-slide PPTX pitch deck, sample screenplay scenes, viability report

---

## Dashboard & Analytics

### User Dashboard (pages/Dashboard)
**Overview:**
- Recent submissions
- Recent manuscripts
- Revision history
- Feedback preferences

**Metrics:**
- Submission count
- Manuscript evaluation progress
- Revision effectiveness tracking

### Progress Tracking (pages/Progress)
**Longitudinal Learning:**
- Editorial Growth Tracking (persistent skill tracking over time)
- Recurring pattern detection (what you keep getting wrong)
- Trend-based scoring (improvement across multiple submissions)
- Revision effectiveness analysis (before/after comparisons)

### Analytics Dashboard (pages/Analytics)
**Admin-Level Insights:**
- Page views and traffic patterns
- User engagement metrics
- Feedback analytics
- Device/referrer breakdown

---

## Enterprise & Professional Services

### Storygate Studio™ (pages/StorygateStudio)
**Selective Development Track:**
- Curated submission review
- Invitation-based engagement
- Professional editorial consideration
- Requires: contact info, full project description, film adaptation package

**Submission Requirements:**
- Complete film adaptation package (10-12 slide pitch deck)
- Minimum composite score of 8.0/10
- 300-500 word project description
- Why Storygate specifically

### Enterprise (pages/Enterprise)
**For Organizations:**
- Literary agencies
- Publishing houses
- MFA programs
- Content studios

**Features:**
- Team dashboard
- User seat management
- Custom criteria
- Bulk processing
- API access
- White-label options

---

## Pricing & Plans (pages/Pricing)

### Free Tier
- 1-2 evaluations (~2,000 words)
- Experience the 13 Story Criteria

### Starter ($25/month)
- Quick scene/chapter evaluations
- 25,000 words/month
- 13 Story Criteria only

### Professional ($99/month) - PRIMARY PLAN
- Unlimited evaluations (500,000 words/month cap)
- Full 13 Story Criteria + WAVE Revision System
- Complete agent submission pipeline
- Novel-to-screenplay conversion
- Film adaptation package
- Progress dashboard
- Priority processing

### Enterprise (Custom)
- Team/organization features
- Custom integrations
- Dedicated support

---

## Supporting Infrastructure

### Evaluation Frameworks

#### 13 Story Evaluation Criteria (Agent Ready™)
1. Voice & Style
2. Opening Hook
3. Character Development
4. Dialogue
5. Pacing
6. Show Don't Tell
7. Conflict & Stakes
8. Emotional Resonance
9. World-Building
10. Plot Structure
11. Theme
12. Marketability
13. Genre Fit

#### WAVE Revision System (60+ checks)
- Sentence craft
- Sensory details
- Tension arc
- Word economy
- Scene beats
- Transitions
- Dialogue function
- POV consistency
- Interiority
- Exposition distribution
- Stakes escalation
- Causality logic

---

## Technical Architecture

### Entities
- `Manuscript` - Full manuscript storage and metadata
- `Chapter` - Individual chapter text and evaluation results
- `Submission` - Quick evaluation submissions
- `Suggestion` - Revision recommendations
- `RevisionSession` - Revision tracking
- `StorygateSubmission` - Storygate Studio submissions
- `ComparativeReport` - Comp title analysis
- `NarrativeThread` - Story continuity tracking
- `Analytics` - Usage and engagement data

### Backend Functions
- `evaluateFullManuscript` - Main evaluation orchestrator
- `evaluateSpine` - Structural analysis
- `splitManuscript` - Chapter segmentation
- `generateRevisionSuggestions` - Revision generation
- `formatScreenplay` - Novel-to-screenplay conversion
- `generateFilmPitchDeck` - Pitch deck creation
- `generateCompletePackage` - Full submission package
- `generateQueryPitches` - Pitch/synopsis generation
- `generateSynopsis` - Synopsis generation
- `generateBenchmarkComparison` - Comp title analysis

---

## User Journey Examples

### Example 1: First-Time Novelist
1. Upload manuscript → `UploadManuscript`
2. Wait 5-15 minutes for evaluation
3. View results → `ManuscriptDashboard`
4. Review spine report → `SpineReport`
5. Review chapter-by-chapter WAVE results → `ChapterReport`
6. Apply revisions → `Revise` (Trusted Path or manual)
7. Re-evaluate revised chapters → `EvaluateChapter`
8. Generate complete package → `CompletePackage`
9. Find agents → `FindAgents`
10. Build query letter → `QueryLetter`
11. Submit to agents

### Example 2: Screenplay Writer
1. Upload novel → `ScreenplayFormatter`
2. Convert to screenplay format
3. Generate film pitch deck → `FilmAdaptation`
4. Review screen viability score
5. Download 12-slide PPTX pitch deck
6. Submit to Storygate Studio → `StorygateStudio`

### Example 3: Quick Chapter Test
1. Upload opening chapter → `Evaluate`
2. Get 13 Story Criteria feedback (2-5 min)
3. Revise and re-evaluate
4. Repeat until 8.0+ score
5. Upload full manuscript once chapter is strong

---

## Key Differentiators

### What RevisionGrade IS:
- Editorial evaluation system
- Submission readiness diagnostic
- Professional standards enforcement
- Longitudinal learning platform
- Complete agent submission pipeline

### What RevisionGrade IS NOT:
- Not a ghostwriter
- Not a co-author
- Not a shortcut to publication
- Not a grammar checker
- Not a generic writing assistant

### Core Philosophy:
"RevisionGrade doesn't write your book. It helps you understand it—so you can write it better."

---

## Success Metrics

### Quality Thresholds
- 8.0/10 composite score = agent-ready baseline
- 9.0/10 = highly competitive
- Below 8.0 = requires structural work before line-level polish

### Output Standards
- All generated assets (pitches, synopses, bios, queries) calibrated against professional acquisition outcomes
- Film pitch decks meet producer presentation standards
- Screenplay formatting matches WriterDuet/Final Draft conventions

---

## Support & Resources

### Educational Resources
- `pages/FAQ` - Comprehensive FAQ covering pricing, quality, authorship, ethics
- `pages/Methodology` - Detailed evaluation methodology
- `pages/Criteria` - Breakdown of 13 Story Criteria + WAVE Guide
- `pages/SampleAnalyses` - Real evaluation examples
- `pages/EthicsAndSafety` - Content handling policies

### Contact & Help
- `pages/Contact` - Support contact form
- `pages/HelpCenter` - Guided help resources
- `pages/Privacy` - Privacy policy
- `pages/Terms` - Terms of service

---

## Summary Flow

```
┌─────────────────┐
│  UPLOAD TEXT    │
│  (Manuscript/   │
│   Chapter)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   EVALUATE      │
│  • 13 Criteria  │
│  • WAVE System  │
│  • Spine Check  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    REVISE       │
│  • Diagnostics  │
│  • Suggestions  │
│  • Trusted Path │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SUBMISSION PKG  │
│  • Pitch        │
│  • Synopsis     │
│  • Bio          │
│  • Comps        │
│  • Query        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AGENT SUBMIT   │
│  (or Storygate) │
└─────────────────┘

PARALLEL TRACKS:
• Novel → Screenplay
• Film Adaptation Package
• Progress Analytics
```

---

**Last Updated:** 2025-12-31
**Platform Version:** RevisionGrade™ v3.0