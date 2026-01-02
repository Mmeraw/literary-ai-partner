# 13 Story Evaluation Criteria (Canonical)

**Version**: 1.0  
**Purpose**: Single source of truth for narrative quality assessment  
**Status**: Governing specification

---

## The 13 Canonical Criteria

These criteria assess narrative quality, coherence, and professional readiness. They diagnose structural, thematic, and craft-level issues without prescribing style.

### 1. Concept & Premise
**Question**: Is the central idea compelling, original, and clearly legible? Does the premise generate inherent narrative tension?

**Evaluates**: Core concept strength, originality, marketability, hook potential

### 2. Narrative Drive & Momentum
**Question**: Does the story maintain forward movement through escalation, consequence, and evolving stakes?

**Evaluates**: Pacing, causality chains, rising action, propulsive force

### 3. Character Depth & Psychological Coherence
**Question**: Are characters internally consistent, motivated, and capable of meaningful change or resistance to change?

**Evaluates**: Character dimensionality, arc authenticity, psychological truth

### 4. POV & Voice
**Question**: Is the narrative perspective stable, intentional, and appropriate to the material?

**Evaluates**: POV integrity, voice consistency, narrative distance control

### 5. Scene Function
**Question**: Does each scene perform a narrative function (reveal, escalate, complicate, or resolve)?

**Evaluates**: Scene purpose, structural efficiency, narrative economy

### 6. Dialogue & Subtext
**Question**: Does dialogue reveal character and power dynamics without unnecessary exposition?

**Evaluates**: Dialogue authenticity, subtext richness, exposition discipline

### 7. Theme
**Question**: Are themes embedded through action and consequence rather than stated directly?

**Evaluates**: Thematic integration, show vs tell, thematic coherence

### 8. World-Building
**Question**: Are physical spaces, social systems, and rules internally consistent and credible?

**Evaluates**: Environmental logic, sensory authenticity, systemic coherence

### 9. Pacing & Structure
**Question**: Is the rhythm of tension and release effective across the work as a whole?

**Evaluates**: Structural balance, act transitions, macro-pacing

### 10. Prose Craft
**Question**: Is the prose precise, intentional, and free from unmotivated repetition or ambiguity?

**Evaluates**: Line-level control, sentence variety, precision, authority

### 11. Tone
**Question**: Does the work maintain tonal integrity without unintended shifts or register drift?

**Evaluates**: Tonal consistency, register control, mood authority

### 12. Narrative Closure
**Question**: Are narrative promises fulfilled, intentionally subverted, or explicitly left open? Does the work avoid unresolved threads unless deliberately framed as such?

**Evaluates**: Resolution quality, promise-keeping, closure vs ambiguity discipline

**Note**: This criterion is informed by Story Architecture Layer analysis. It does not penalize intentional ambiguity when thematically justified.

### 13. Professional Readiness
**Question**: Does the manuscript demonstrate control, cohesion, and clarity consistent with professional publication standards?

**Evaluates**: Agent-readiness, market positioning clarity, submission fitness

---

## Implementation Rules

### Scoring Scale (1-10)
- **1-3**: Major structural issues; requires fundamental revision
- **4-6**: Functional but weak; needs targeted strengthening
- **7-8**: Strong; minor refinements only
- **9-10**: Exceptional; publication-ready

### Output Format
Each criterion must include:
- **score** (1-10)
- **strengths** (array of strings)
- **weaknesses** (array of strings)
- **notes** (string, actionable guidance)

### Relationship to Other Systems
- **Spine Evaluation**: Produces gate artifact (spine clarity, objective strength, closure mechanism); NOT a duplication of 13 criteria
- **WAVE System**: Identifies craft-level issues (line editing, compression, POV discipline); complements 13 criteria
- **Story Architecture**: Feeds Criterion 12 (Narrative Closure) with continuity/thread analysis

---

## Canonical Criteria Names (Code Reference)

Use these exact strings in all system code:

```javascript
const CANONICAL_CRITERIA = [
  "Concept & Premise",
  "Narrative Drive",
  "Character Depth",
  "POV & Voice",
  "Scene Function",
  "Dialogue & Subtext",
  "Theme",
  "World-Building",
  "Pacing & Structure",
  "Prose Craft",
  "Tone",
  "Narrative Closure",
  "Professional Readiness"
];
```

---

**END OF SPECIFICATION**