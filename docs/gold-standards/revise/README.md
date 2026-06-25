# Revise Gold Standard Fixture Suite

Status: gold-standard fixture suite v1  
Audience: Revise Queue, Revise Workbench, A/B/C candidate generator, Revise Admission Gate, Phase 4B Final External Audit, Agent Readiness Package  
Runtime role: benchmark-quality examples for author-facing revision cards and repair candidates.

## Purpose

The evaluation benchmark family teaches what excellent evaluation looks like. This fixture suite teaches what excellent Revise output looks like.

Revise quality must not depend only on prompts or general benchmark awareness. The Workbench needs concrete examples of:

- a perfect six-part diagnostic;
- a perfect evidence chain;
- a perfect A/B/C repair set;
- a perfect acceptance test;
- effort / impact / risk scoring;
- author-facing clarity;
- refusal to produce generic, unsupported, or manuscript-detached cards.

## Canonical Revise card shape

Each gold-standard Revise card must expose:

1. `source_evidence` — exact or near-exact manuscript anchor.
2. `diagnostic` — six-part diagnosis:
   - evidence;
   - symptom;
   - cause;
   - fix direction;
   - reader effect;
   - mistake-proofing.
3. `repair_goal` — what the repair must accomplish.
4. `candidate_a` — conservative repair.
5. `candidate_b` — balanced repair.
6. `candidate_c` — bold repair.
7. `acceptance_criteria` — verifiable conditions.
8. `risk_notes` — what not to break.
9. `effort_score` — low / medium / high.
10. `impact_score` — low / medium / high.
11. `risk_score` — low / medium / high.
12. `admission_gate_expectation` — pass / withhold / repair-before-display.

## Hard rules

- Benchmark prose may calibrate opportunity quality but must never replace manuscript evidence.
- A Revise card without evidence must be withheld.
- A Revise card without specific action must be withheld.
- A Revise card that repeats a generic evaluation recommendation must be withheld.
- A/B/C candidates must be materially different repair strategies, not the same sentence paraphrased three ways.
- Candidate repairs must preserve voice, POV, canon, timeline, and accepted Story Ledger authority.
- Acceptance criteria must be testable by a human or deterministic gate.

## Native fixture targets

```text
docs/gold-standards/revise/cartel-babies-revise-gold-standard.md
docs/gold-standards/revise/let-the-river-decide-revise-gold-standard.md
docs/gold-standards/revise/mythoamphibia-revise-gold-standard.md
docs/gold-standards/revise/return-to-the-source-revise-gold-standard.md
```

## Runtime use

Revise Queue / Workbench should use these fixtures as shape and quality calibration only. The fixtures do not create manuscript facts for a new user submission.

Phase 4B may use this suite to block or warn when the revision opportunity ledger is generic, unsupported, repetitive, or not Workbench-ready.
