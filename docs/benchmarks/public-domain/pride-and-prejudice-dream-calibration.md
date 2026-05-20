---
benchmark-schema: dream-longform-v2-governed-ledgers
title: Pride and Prejudice DREAM Long-Form Public-Domain Calibration
manuscript: Pride and Prejudice
author: Jane Austen
source-publication: 1813
public-domain-status: pre-1928-us-copyright-expiration
commercial-use-permitted: true
scope: full-manuscript
route: LONG_FORM
output-mode: multi_layer_long_form
benchmark-role: public-domain-calibration
benchmark-tier: public-domain-calibration
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
runtime-authority: false
manual-reference: true
wave-applied: true
source-text: corpus/public-domain/clean/pride-and-prejudice.txt
---

# Pride and Prejudice — DREAM Long-Form Public-Domain Calibration

## Governance notice

This file is a public-domain DREAM calibration benchmark, not a RevisionGrade-native runtime authority file.

Its purpose is to teach DREAM evaluators how to detect social-pressure plotting, dialogue subtext, free indirect discourse, courtship economics, point-of-view irony, character misjudgment, and scene economy in an external public-domain long novel. It must not replace RevisionGrade-native required gold standards such as `froggin-noggin-dream.md` or `cartel-babies-dream.md`.

Governing spec:

```text
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
```

Governed ledger specs:

```text
docs/governance/dream-ledgers/
```

---

## Executive verdict

*Pride and Prejudice* is a benchmark long-form social novel because its plot engine is almost entirely conversational, social, and interpretive. The novel converts etiquette, family pressure, money, rank, rumor, pride, first impressions, and marriage economics into a high-precision system of misreading and correction.

The novel's greatest achievement is not simply the Elizabeth/Darcy romance; it is the way Austen turns dialogue, manners, and free indirect discourse into narrative propulsion. Scenes that appear domestic or conversational are doing major structural work: exposing social hierarchy, testing intelligence, revealing vanity, staging economic vulnerability, and forcing Elizabeth to revise her own interpretive confidence.

Its principal weakness, from a modern long-form evaluation standpoint, is that some social subplot movement can feel narrow or repetitive if evaluated only by external action. A DREAM evaluator must not mistake low physical spectacle for low narrative drive. The drive is carried by pressure, misinterpretation, disclosure, social consequence, and emotional recalibration.

Current calibration posture: canonical public-domain DREAM calibration text. It should teach RevisionGrade to detect dialogue-as-action, social stakes, irony-governed POV, character misjudgment, family-system pressure, and compact scene function.

---

## Scores

| Criterion | Score | Confidence | Summary finding |
|---|---:|---|---|
| Concept & Core Premise | **9.0 / 10** | High | A durable social-romantic premise: intelligence, pride, family pressure, class, money, and first impressions collide inside a marriage market. |
| Narrative Drive & Momentum | **8.5 / 10** | High | The novel generates propulsion through visits, dances, letters, proposals, rumor, family disgrace, and social reversals rather than spectacle. |
| Character Depth & Psychological Coherence | **9.5 / 10** | High | Elizabeth, Darcy, Jane, Bingley, Mr. Bennet, Mrs. Bennet, Lydia, Wickham, Charlotte, and Lady Catherine each operate from coherent pressure systems. |
| Point of View & Voice Control | **10 / 10** | High | Free indirect discourse, irony, and focal restraint are world-class; the narrator lets judgment form and then be revised. |
| Scene Construction & Function | **9.0 / 10** | High | Social scenes perform multiple functions: status display, courtship pressure, comic exposure, misconception, reversal, and later payoff. |
| Dialogue Authenticity & Subtext | **10 / 10** | High | Dialogue is action: wit, evasion, social performance, accusation, proposal, humiliation, and class pressure are all carried through speech. |
| Thematic Integration | **9.5 / 10** | High | Pride, prejudice, rank, money, marriage, family reputation, self-knowledge, and moral perception interlock tightly. |
| World-Building & Environmental Logic | **8.5 / 10** | High | The social geography of estates, assemblies, visits, family homes, and reputation networks is coherent and consequence-bearing. |
| Pacing & Structural Balance | **8.5 / 10** | High | The structure is exceptionally controlled, though modern readers may experience some social repetition as low external event density. |
| Prose Control & Line-Level Craft | **9.5 / 10** | High | Precise, ironic, economical prose with strong tonal command and subtle character-filtered narration. |
| Tonal Authority & Consistency | **9.5 / 10** | High | Satire, romance, moral correction, embarrassment, and familial comedy remain governed throughout. |
| Narrative Closure & Promises Kept | **9.0 / 10** | High | Major interpretive, romantic, familial, and social ledgers close with strong promise/payoff integrity. |
| Professional Readiness & Market Positioning | **10 / 10** | High | Canonical, culturally durable, structurally teachable social novel and benchmark for dialogue, irony, and courtship architecture. |

**Overall DREAM quality score:** **91 / 100**  
**Calibration readiness score:** **96 / 100**  
**Primary causal weakness:** Low external spectacle can obscure the strength of its social-pressure engine.  
**Primary calibration value:** A DREAM evaluator must detect dialogue, irony, and social interpretation as plot machinery.

---

## Calibration requirements

A valid DREAM evaluation of *Pride and Prejudice* must detect:

- Dialogue as the principal vehicle of action and subtext.
- Elizabeth's misreading and self-correction as a structural arc, not merely romance development.
- Darcy's arc from pride and social reserve toward moral action.
- Wickham as charm, misinformation, and reputation-risk engine.
- Charlotte's marriage decision as social-economic realism, not romantic failure alone.
- Lydia's elopement as family-system and reputation crisis.
- Lady Catherine as class-pressure embodiment and late-stage catalytic force.
- Free indirect discourse and irony as formal control systems.

---

## Public-domain corpus policy

This benchmark may be used for calibration, regression, score sanity, genre-aware QA, and optional benchmark comparison. It must not be injected wholesale into ordinary user-evaluation prompts or used as a style imitation target.
