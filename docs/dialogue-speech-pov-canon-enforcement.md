# Dialogue, Speech, and POV Canon Enforcement Plan

Status: Draft PR planning artifact.

## Purpose

This PR exists to design a dedicated, auditable reinforcement lane for dialogue, speech, voice, and POV governance.

It is intentionally separate from worker/SLA PRs, LLR false-positive fixes, and latency/ops work.

## Doctrine

Dialogue and speech enforcement must protect authorial intent, character identity, register, class, era, culture, rhythm, and point-of-view integrity.

The system must not mechanically “naturalize” dialogue by flattening formality, stripping fillers, forcing contractions, or homogenizing character voices.

## Include POV thoughts?

Yes.

POV belongs in this PR because dialogue, interiority, free indirect style, psychic distance, and attribution all interact. The PR should cover:

- spoken dialogue
- reported speech
- direct thought
- interior monologue
- free indirect discourse
- POV/voice contamination
- narrative authority shifts
- psychic distance consistency

## Proposed scope

### Files likely involved

- `lib/evaluation/pipeline/mechanismMarkers.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- Pass 3 synthesis prompt/test surfaces
- dialogue / POV diagnostic tests
- governance fixtures for positive and negative cases

### Canon categories

- speaker attribution clarity
- turn-taking clarity
- action beats and dialogue tags
- quoted speech vs reported speech
- subtext and implication
- character-specific speech rhythm
- register and formality preservation
- dialect / idiom caution
- compression without flattening voice
- interiority and thought rendering
- free indirect discourse protection
- POV boundary / psychic distance
- narrative authority transfer

## Enforcement targets

The PR should add or strengthen gates that catch:

- generic dialogue rationale without mechanism language
- unattributed or ambiguous speaker turns
- dialogue critique that ignores rendering/attribution mechanics
- speech homogenization across characters
- false “naturalization” that forces contractions or casual phrasing
- over-compression that removes voice or subtext
- POV contamination in dialogue or interior thought
- unmarked narrative authority shifts

## False-positive protection

The PR must prove it does not incorrectly fail:

- sparse / minimalist dialogue
- intentionally formal speech
- period or stylized dialogue
- character-specific stiffness or awkwardness
- reported speech
- free indirect discourse
- interior monologue
- dialect/idiolect used with control

## Non-goals

- No worker/SLA changes
- No job lifecycle changes
- No status enum changes
- No broad prompt tuning outside dialogue/POV surfaces
- No mechanical rewrite rules
- No automatic contraction insertion
- No blanket filler deletion

## Acceptance bar

This PR is not complete until each canon category maps to at least one of:

1. mechanism marker,
2. quality gate condition,
3. Pass 3 requirement,
4. positive regression test,
5. negative false-positive test.

If it is not enforced, it is not real.
