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
source-text: corpus/public-domain/clean/the-awakening.txt
---

# The Awakening — Long-Form Public-Domain Calibration

## Governance notice

This file is a public-domain calibration benchmark, not a RevisionGrade-native runtime authority file.

Its purpose is to teach RevisionGrade how to evaluate a compact literary novel whose primary engine is interior pressure, social constraint, symbolic environment, and irreversible character change. It must not replace RevisionGrade-native required gold standards such as `froggin-noggin-dream.md`, `cartel-babies-dream-longform-multilayer-gold-standard.md`, or `let-the-river-decide-dream.md`.

Governing mode contract:

```text
docs/governance/evaluation-output-mode-contract.md
```

Product-facing template:

```text
docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
```

---

## Calibration posture

*The Awakening* is now upgraded by a governed-ledger addendum that preserves this original calibration body while making its benchmark contract more explicit for DREAM v2 interpretation. It should teach the evaluator to recognize that quiet external plotting can still carry strong narrative pressure through interior change, social enclosure, symbolic recurrence, and escalating conflict between selfhood and imposed role.

Required detection:

- interiority as plot pressure;
- social role constraint as antagonistic pressure;
- marriage, motherhood, property, reputation, and gender expectation as structural systems;
- sea / water / music / sleep / birds as symbolic pressure systems;
- desire and self-recognition as narrative escalation, not merely theme;
- the distinction between deliberate ambiguity and weak closure.

Do not use this benchmark to force modern commercial pacing, external antagonist structure, or conventional plot escalation onto a literary novel whose pressure system is largely psychological, social, and symbolic.

---

## Expected evaluation mode

```yaml
evaluation-mode: long_form_evaluation
route: LONG_FORM
output-mode: standard_long_form
runtime-authority: false
```

The governed-ledger addendum is now the current benchmark companion for *The Awakening*; the original body remains the manual calibration reference, and the addendum normalizes it for DREAM v2 multi-layer interpretation without changing the underlying literary judgment.

---

## Criterion opportunity expectation

When this benchmark is used to evaluate report quality, criterion opportunities should follow the six-part diagnostic contract where applicable:

1. Evidence.
2. Symptom.
3. Cause.
4. Fix direction.
5. Reader effect.
6. Mistake-proofing.

---

## Calibration warning

This benchmark should improve evaluator sensitivity to interior pressure, symbolic environment, and ambiguous closure. It must not be used as a style imitation target for modern manuscripts and must not become runtime authority for ordinary evaluations.
