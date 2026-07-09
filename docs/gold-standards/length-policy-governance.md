# Length Policy Governance — Cap · Overage · Minimum · No Mid-Sentence Truncation

Status: binding
Source of truth (code): `lib/config/lengthPolicy.ts`

## Principle

Every LLM-generated author-facing text field is bounded by THREE hard integer
values. There are **no percentages** anywhere in this policy — the LLM is never
asked to compute a percentage drift, and no gate multiplies a limit by a ratio.
All tolerances are literal ± counts.

- **MIN (floor)** — users MUST receive at least this much explanation. Below MIN
  is a governance kickback (`INSUFFICIENT_EXPLANATION`): the field is regenerated
  with a "produce more detail" instruction. Content is **never** padded or
  fabricated to reach the floor.
- **BASE (target)** — the length the prompt aims for.
- **OVERAGE** — an allowed overage above BASE, expressed as a hard integer.
- **CAP = BASE + OVERAGE** — a hard ceiling the model may never exceed. LLMs need
  a finite cap; there is no "infinite characters/words".

Invariant: `MIN ≤ measured ≤ CAP`. Overage above BASE is allowed silently up to
CAP — "more is more, not less". We never trim author-facing prose back toward
BASE just to hit a number.

## NO_MIDSENTENCE_TRUNCATION

When (and only when) a field exceeds its CAP, it is trimmed at a **complete
sentence boundary** — never mid-sentence, and never mid-word. Implemented by
`trimAtSentenceBoundary()` in
`lib/evaluation/pipeline/evaluationCertificationGate.ts`. If a single sentence is
itself longer than the CAP (no sentence boundary fits), it falls back to a
word-boundary trim with an ellipsis, which still never cuts mid-word.

This is a **deterministic code-enforced invariant**, not a failure that can occur
at runtime — the trimmer makes a mid-sentence cut impossible. It is registered as
a governance authority (this document) and proven by unit tests, rather than as a
kick-mapped failure code.

## Bounds

### Pipeline synthesis (characters)

| Field | MIN | BASE | +OVERAGE | CAP | Trim |
|---|---|---|---|---|---|
| `one_paragraph_summary` | 300 | 750 | 250 | 1000 | sentence boundary |
| `one_sentence_pitch` | 40 | 180 | 40 | 220 | sentence boundary |
| `one_paragraph_pitch` | 200 | 600 | 150 | 750 | sentence boundary |

### Agent-readiness submission sections (words)

| Section | MIN | BASE | +OVERAGE | CAP |
|---|---|---|---|---|
| query_letter | 200 | 450 | 50 | 500 |
| what_makes_unique | 60 | 150 | 20 | 170 |
| synopsis (short / query) | 100 | 150 | 30 | 180 |
| synopsis (standard) | 250 | 450 | 50 | 500 |
| synopsis (extended) | 500 | 750 | 250 | 1000 |
| query_pitch | 25 | 50 | 25 | 75 |
| comparables | 60 | 200 | 25 | 225 |
| author_bio | 50 | 200 | 25 | 225 |

The three synopsis tiers correspond to the 150 / 450 / 750 word targets.

## Enforcement points

- Prompt: `lengthInstruction()` / synopsis prompt emit hard target/min/cap so the
  model is told the exact numbers (never a percentage).
- Gate: `qualityGate()` in the generate route rejects below-MIN
  (`INSUFFICIENT_EXPLANATION` → `OUTPUT_TOO_THIN`) and above-CAP
  (`WORD_LIMIT_EXCEEDED`), then retries once before a terminal 422.
- Normalizer: `normalizeArtifact()` sentence-trims over-CAP synthesis fields.
