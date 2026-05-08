# VOLUME II-A - OPERATIONAL SCHEMA

**Machine-Operational Specification for RevisionGrade Evaluation, Routing, Scoring, and Audit Artifacts**

> **Status:** CANONICAL - ACTIVE
> **Authority:** Volume II Canon -> Volume II-A Operational Schema -> application code -> database artifacts -> dashboards

This is implementation infrastructure, not canon. It translates doctrine into:
- Criterion registry tables
- Weight models
- Threshold constants
- Routing logic
- JSON evaluation envelopes
- Persistence schemas
- Multi-AI orchestration contracts

> Volume II = Constitution
> Volume II-A = Machine Code

---

**Relationship to Volume II Canon:** This document translates the doctrine of Volume II into structured constants, tables, schemas, and routing rules for GitHub, Supabase, Vercel, and governed multi-AI evaluation pipelines. It does not replace Volume II; it operationalizes it.

---

## 1. Purpose and authority chain

This specification is the executable companion to Volume II - The 13 Story Criteria Canon. It exists so the platform can score manuscripts consistently, gate refinement correctly, and emit auditable artifacts.

- **Authority chain:** Volume II Canon -> Volume II-A Operational Schema -> application code -> database artifacts -> dashboards / agent-facing surfaces.

---

## 2. Criterion registry

Every evaluation must contain exactly the 13 canonical criteria below. No additional criteria may be invented at runtime, and no criterion may be omitted.

| ID | Key | Canonical Name | Domain | Weight |
|----|-----|----------------|--------|--------|
| 1 | CONCEPT | Concept and Core Premise | Macro structural | 1.20 |
| 2 | MOMENTUM | Narrative Drive and Momentum | Macro structural | 1.20 |
| 3 | CHARACTER | Character Depth and Psychological Coherence | Macro structural | 1.15 |
| 4 | POV_VOICE | Point of View and Voice Control | Bridge | 1.10 |
| 5 | SCENE | Scene Construction and Function | Macro structural | 1.10 |
| 6 | DIALOGUE | Dialogue Authenticity and Subtext | Bridge | 1.00 |
| 7 | THEME | Thematic Integration | Macro structural | 0.95 |
| 8 | WORLD | World-Building and Environmental Logic | Macro structural | 0.95 |
| 9 | PACING | Pacing and Structural Balance | Macro structural | 1.15 |
| 10 | PROSE | Prose Control and Line-Level Craft | Bridge | 1.00 |
| 11 | TONE | Tonal Authority and Consistency | Bridge | 0.95 |
| 12 | CLOSURE | Narrative Closure and Promises Kept | Macro structural | 1.05 |
| 13 | MARKET | Professional Readiness and Market Positioning | Market | 0.90 |

---

## 3. Score scale and banding

Each criterion is scored on a 1-10 integer scale. Half-points are disallowed unless a future version bump explicitly authorizes them.

- 1-3 = Foundational weakness
- 4-6 = Developing but inconsistent
- 7-8 = Strong with minor gaps
- 9-10 = Professional-grade execution

---

## 4. Weight table and composite scoring

Weighted Composite Score (WCS) = SUM(score x weight) / SUM(weights). This score drives readiness states but does not override hard fail conditions.

- Structural emphasis is intentional: concept, momentum, character, pacing, and closure materially affect eligibility.
- Bridge criteria (POV/voice, dialogue, prose, tone) influence readiness but do not rescue broken architecture.
- Market positioning may depress final readiness but may not block structural refinement on its own.

---

## 5. Eligibility gate constants

| Constant | Value | Meaning |
|----------|-------|---------|
| WAVE_ELIGIBILITY_MIN_WCS | 7.0 | Minimum weighted composite score to unlock Volume I WAVE refinement |
| STRUCTURAL_FAIL_THRESHOLD | 5 | If any structural criterion falls below 5, WAVE is blocked |
| AGENT_READY_WCS | 8.5 | Composite threshold for strong professional/agent-ready status |
| MARKET_REVIEW_TRIGGER | 6 | If MARKET criterion < 6, flag market-path review |

Structural criteria for fail-fast purposes: CONCEPT, MOMENTUM, CHARACTER, SCENE, PACING, CLOSURE.

---

## 6. Criteria-to-WAVE routing map

This map determines which WAVE domains should be emphasized after Criteria scoring. It is routing guidance, not a substitute for human judgment.

| Criterion Key | Primary WAVE Domains | Routing Intent |
|---------------|---------------------|----------------|
| CONCEPT | Waves 1-3 | Narrative architecture, chapter/scene function, foreshadowing |
| MOMENTUM | Waves 31-40 | Scene-to-scene momentum, hooks, tension escalation, denouement |
| CHARACTER | Waves 11-20 | Character arc tracking, consistency, relationship dynamics, voice differentiation |
| POV_VOICE | Waves 5, 16, 20, 58 | POV stability, thought boundaries, voice differentiation, lyric control |
| SCENE | Waves 2-3, 31-32 | Chapter/scene function, openings/exits, hook strength |
| DIALOGUE | Waves 13-15, 49 | Dialogue authenticity, subtext, tag reduction, dialogue spacing |
| THEME | Waves 21, 28, 60 | Thematic integration, symbol/motif tracking, repetition as motif |
| WORLD | Waves 22-24, 29 | World-building logic, cultural authenticity, setting as character |
| PACING | Waves 31-40, 41-42 | Momentum, pacing balance, sentence/paragraph rhythm |
| PROSE | Waves 45-55, 61 | Echo detection, abstract diagnosis, punctuation authority, compression, micro-edit precision |
| TONE | Waves 43-44, 58-59 | Silence, sound anchors, lyric control, white space |
| CLOSURE | Waves 9, 39-40 | Promises/payoffs, climax architecture, exit velocity |
| MARKET | Wave 62 | Agent-readiness final assessment |

---

## 7. Evaluation output schema

Every full evaluation artifact must serialize the following envelope. The shape below is normative even if the underlying storage uses jsonb.

```json
{
  "manuscript_id": "uuid-or-bigint",
  "evaluation_version": "VOL-II-A-1.0",
  "criteria_scores": [
    {
      "criterion_key": "CONCEPT",
      "score": 8,
      "band": "Strong with minor gaps",
      "evidence_summary": "...",
      "priority": "HIGH|MED|LOW"
    }
  ],
  "weighted_composite_score": 7.9,
  "eligibility_gate": "PASS|BLOCK",
  "readiness_state": "FOUNDATIONAL|DEVELOPING|REFINEMENT_ELIGIBLE|AGENT_READY",
  "priority_repairs": ["..."],
  "wave_routing_targets": ["W31-40", "W45-55"],
  "audit": {
    "ai_systems_used": 2,
    "convergence_state": "AGREE|DIVERGE",
    "generated_at": "ISO-8601"
  }
}
```

---

## 8. Supabase persistence model

- Authoritative manuscript records live in manuscripts.
- Chunk-level processing records live in manuscript_chunks when long-form evaluation requires staged chunking.
- High-level evaluation records live in evaluations.
- Governed output artifacts live in evaluation_artifacts as jsonb envelopes conforming to this specification.
- No artifact should be written if fewer than 13 criteria are present or if any criterion key is invalid.

---

## 9. AI pipeline contract

- AI System 1 may generate candidate criterion judgments, evidence summaries, and issue flags.
- AI System 2 must audit, challenge, or converge those judgments before final artifact write.
- No AI may invent criterion keys, weight values, eligibility thresholds, or routing maps not defined in this schema.
- Divergence between AI systems must be logged into the audit envelope as a judgment zone, not silently collapsed.

---

## 10. Implementation invariants

- Exactly 13 canonical criteria must be present in every full evaluation.
- Weighted composite scoring must be deterministic for identical inputs.
- Eligibility gate decisions must be explainable from stored criterion values and thresholds.
- WAVE may not run when eligibility_gate = BLOCK.
- Any schema change requires a version bump in this document and a matching registry / code update.

---

## X. Versioning and migration

All schema changes require:
- schema_version increment
- Migration scripts
- Backward compatibility check
- Audit log entry

No breaking change may be deployed without migration.

---

## XI. System invariants

1. The pipeline is hierarchical and artifact-driven.
2. No stage may skip required prior stages.
3. All outputs must be persisted before advancing.
4. Final results require governance approval.
5. Coverage truth must never be hidden or inferred.

---

## Addendum: Narrative Diagnostic Grid

The Narrative Diagnostic Grid evaluates each scene across the core narrative forces that govern reader engagement. Rather than evaluating prose in isolation, the grid analyzes whether the scene contributes to the operating narrative system.

The grid measures: Authority, Energy, Motion, Pressure, Consequence, Orientation, Information Flow.

| Narrative Force | Diagnostic Question | Scene Signal |
|-----------------|--------------------|--------------|
| Authority | Does the narrative voice demonstrate control and clarity? | Precise language, confident tone |
| Energy | Does the scene sustain curiosity or tension? | Questions raised, conflict signals |
| Motion | Does the scene move the story forward? | Plot advancement, character change |
| Pressure | Is the character under meaningful pressure? | Stakes, constraints, urgency |
| Consequence | Do actions produce outcomes that matter? | Cause-effect chains, irreversibility |
| Orientation | Does the reader know where they are? | Grounding, spatial/temporal clarity |
| Information Flow | Is information revealed at the right pace? | Withholding, reveals, dramatic irony |

---

## Retry policy

Allowed:
- Chunk evaluation retries (max 2)
- Transient API failures

NOT allowed:
- Silent retries after governance failure
- Partial overwrite of artifacts

All retries MUST be logged in pipeline_events.

---

*This operational schema is authoritative for all backend, API, and database implementations.*