---
benchmark-schema: long-form-evaluation-v1
evaluation-mode: long_form_evaluation
title: The Awakening Long-Form Public-Domain Calibration
manuscript: The Awakening
author: Kate Chopin
source-publication: 1899
public-domain-status: pre-1928-us-copyright-expiration
commercial-use-permitted: true
scope: full-manuscript
route: LONG_FORM
output-mode: standard_long_form
benchmark-role: public-domain-calibration
benchmark-tier: public-domain-calibration
runtime-authority: false
manual-reference: true
wave-applied: true
source-text: corpus/public-domain/clean/story-of-an-hour.txt
source-text-note: The current repo text file is a Kate Chopin collection beginning with The Awakening. A standalone the-awakening.txt extraction should be created before freezing a golden eval artifact.
---

# The Awakening — Long-Form Public-Domain Calibration

## Governance notice

This file is a public-domain calibration benchmark, not a RevisionGrade-native runtime authority file.

Its purpose is to teach RevisionGrade how to evaluate a compact literary novel whose primary engine is interior pressure, social constraint, gendered expectation, symbolic environment, and irreversible self-recognition. It must not replace RevisionGrade-native required gold standards such as `froggin-noggin-dream.md`, `cartel-babies-dream.md`, or `let-the-river-decide-dream.md`.

Governing mode contract:

```text
docs/governance/evaluation-output-mode-contract.md
```

Product-facing template:

```text
docs/templates/evaluation/long-form-evaluation-template.md
```

---

## Calibration posture

*The Awakening* is a standard long-form calibration text, not a default long-form multi-layer benchmark. It should teach the evaluator to recognize that a novel can have relatively quiet external plotting while still carrying strong narrative pressure through interior awakening, social enclosure, symbolic recurrence, and escalating incompatibility between selfhood and imposed role.

Required detection:

- interiority as plot pressure;
- social role constraint as antagonistic pressure;
- marriage, motherhood, property, reputation, and gender expectation as structural systems;
- sea / water / music / sleep / birds as symbolic pressure systems;
- desire and self-recognition as narrative escalation, not merely theme;
- the distinction between deliberate ambiguity and weak closure;
- the ending as a major interpretive and ethical stress test.

Do not use this benchmark to force modern commercial pacing, external antagonist structure, or conventional plot escalation onto a literary novel whose pressure system is largely psychological, social, and symbolic.

---

## Expected evaluation mode

```yaml
evaluation-mode: long_form_evaluation
route: LONG_FORM
output-mode: standard_long_form
runtime-authority: false
```

A later governance decision may add a governed-ledger addendum if the team wants *The Awakening* to become a multi-layer calibration standard. Until then, its default role is standard long-form calibration for interiority, symbolic pressure, gendered constraint, and closure ambiguity.

---

## Score calibration guide

| Criterion | Calibration expectation | Notes |
|---|---|---|
| Concept & Core Premise | High | The premise is not high-concept in a commercial sense, but the identity/constraint engine is powerful and coherent. |
| Narrative Drive & Momentum | Moderate to High | External event density is restrained; internal escalation and social pressure must be recognized as movement. |
| Character Depth & Psychological Coherence | High | Edna's self-recognition arc must be read as the central structural movement. |
| Point of View & Voice Control | High | Close psychological narration and symbolic modulation should be treated as craft assets. |
| Scene Construction & Function | Moderate to High | Domestic, social, musical, and seaside scenes often function as pressure chambers rather than plot events. |
| Dialogue Authenticity & Subtext | Moderate to High | Dialogue often encodes role, propriety, distance, and social control. |
| Thematic Integration | High | Autonomy, embodiment, art, motherhood, marriage, and social constraint are integrated into character pressure. |
| World-Building & Environmental Logic | High | Social world, domestic space, and Gulf setting are structural, not decorative. |
| Pacing & Structural Balance | Moderate | Modern readers may experience drift; evaluator should distinguish purposeful interior pacing from avoidable slack. |
| Prose Control & Line-Level Craft | High | Symbolic prose and controlled restraint are major strengths. |
| Tonal Authority & Consistency | High | Tonal restraint, melancholy, sensuality, and social compression are highly controlled. |
| Narrative Closure & Promises Kept | Moderate to High | Ending is deliberately ambiguous and ethically difficult; it should not be marked weak merely because it refuses comfort. |
| Professional Readiness & Market Positioning | High for literary calibration | Strong literary craft benchmark, but not a modern commercial pacing template. |

---

## Criterion opportunity expectation

When this benchmark is used to evaluate report quality, criterion opportunities should follow the six-part diagnostic contract where applicable:

1. Evidence.
2. Symptom.
3. Cause.
4. Fix direction.
5. Reader effect.
6. Mistake-proofing.

Example calibration concern:

- **Evidence:** A scene where external action appears quiet while Edna's perception shifts.
- **Symptom:** A weak evaluator may under-score narrative drive because plot movement is internal rather than externally eventful.
- **Cause:** The evaluator mistakes subtle interior escalation for stasis.
- **Fix direction:** Identify what changed in Edna's self-perception, social compliance, desire, or refusal.
- **Reader effect:** The report honors the novel's actual pressure system instead of imposing genre-action expectations.
- **Mistake-proofing:** Do not convert literary interiority into a demand for artificial external incident.

---

## Calibration warning

This benchmark should improve evaluator sensitivity to gendered social pressure, symbolic environment, and ambiguous closure. It must not be used as a style imitation target for modern manuscripts and must not become runtime authority for ordinary evaluations.
