# COPY BLOCKS: MICRO POLICY v1.0.0

**Status:** CANONICAL  
**Policy Family:** MICRO_POLICY  
**Applies to:** Flash Fiction, Micro-Fiction, Poetry, Vignettes  
**Effective Date:** 2026-01-08  

---

## PURPOSE

This document contains the **locked, non-negotiable copy** for all user-facing messaging when evaluating micro-works. **No ad-hoc language generation is permitted.**

All copy must reflect the **craft-focused, non-submission** nature of micro-work evaluation.

---

## SCORE DISPLAY

### Overall Score Label
```
"Craft Score"
```

### Score Range Display
```
"{score}/10"
```
**Example:** "Craft Score: 8.5/10"

### Score Band Labels
- **8.0-10.0:** "Exceptional Craft"
- **6.0-7.9:** "Strong Craft"
- **4.0-5.9:** "Developing Craft"
- **1.0-3.9:** "Early Draft"

---

## EVALUATION SUMMARY MESSAGING

### High Craft (8.0+)
```
"Exceptional craft quality. Compression and moment impact are strong. Continue refining for publication in literary journals or anthologies."
```

### Mid Craft (6.0-7.9)
```
"Solid craft foundation. Focus on tightening language and deepening the central moment for stronger impact."
```

### Low Craft (4.0-5.9)
```
"Promising concept with room for development. Strengthen clarity, compression, and emotional resonance."
```

### Early Draft (1.0-3.9)
```
"Early-stage work. Focus on fundamental craft: clear language, purposeful structure, and emotional truth."
```

---

## FORBIDDEN PHRASES (MUST NEVER APPEAR)

- "readiness floor"
- "professional routing"
- "Agent-Reality Grade"
- "submission-ready"
- "agent-viable"
- "Phase 2"
- "StoryGate eligible"
- "manuscript"
- "market positioning"
- "query-ready"
- "agent triage"

---

## ALLOWED LANGUAGE

- "craft score"
- "compression"
- "moment quality"
- "literary journal fit"
- "anthology consideration"
- "scene economy"
- "emotional truth"
- "image precision"

---

## GATE MESSAGING

**CRITICAL:** Micro-works have NO gates. If a gate check is invoked for a micro-work, return:

```
{
  "error": "POLICY_VIOLATION",
  "message": "Gates are not applicable to micro-fiction. This work is evaluated purely for craft quality."
}
```

---

## REVISION REQUEST FRAMING

### Template:
```
"Strengthen [aspect] by [specific action]."
```

### Examples:
- "Strengthen compression by cutting unnecessary modifiers."
- "Deepen the central moment by focusing on sensory detail."
- "Clarify the emotional pivot by emphasizing contrast."

**Prohibited Framing:**
- "This needs revision before submission." (implies submission context)
- "Agents will reject this." (micro-works don't target agents)

---

## EXPORT/DOWNLOAD MESSAGING

### PDF Export Title:
```
"Craft Evaluation: {title}"
```

### Subtitle:
```
"Micro-Fiction Craft Analysis"
```

---

## UI BADGE TEXT

### Primary Badge:
```
"Micro-Fiction Craft Evaluation"
```

### Score Badge:
```
"Craft: {score}/10"
```

---

**Sealed:** 2026-01-08  
**Canon Owner:** RevisionGrade Product Team  
**Change Protocol:** Requires Phase 2 governance review