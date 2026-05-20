# Public-domain calibration corpus

This directory is for public-domain benchmark fixtures used by RevisionGrade QA. These works are calibration substrate, not runtime authority.

## Canon policy

Public-domain novels may be used for:

- deterministic text-integrity validation;
- long-form evaluation regression;
- score sanity calibration;
- genre-aware diagnostic QA;
- optional user-facing benchmark comparison mode.

Public-domain novels must not be used for:

- wholesale insertion into ordinary user-evaluation prompts;
- replacement of RevisionGrade-native gold standards;
- style imitation targets for modern manuscripts;
- automatic score control for live user submissions.

## Active seed set

The current public-domain long-form calibration seed is declared in:

```text
corpus/public-domain/registry.json
```

Current works:

| Work | Calibration role |
|---|---|
| Pride and Prejudice | Dialogue, voice, POV control, social tension, character interaction, scene economy. |
| Dracula | Epistolary structure, suspense escalation, atmosphere, multi-document narration, revelation pacing, genre tension. |
| Great Expectations | Retrospective first-person voice, character arc, social pressure, motif recurrence, emotional architecture, closure. |

## Directory contract

```text
corpus/public-domain/clean/          canonical cleaned source texts
corpus/public-domain/golden-evals/   frozen evaluation outputs after verified runs
corpus/public-domain/registry.json   metadata, policy, expected integrity constraints
```

## Verification

Run:

```bash
node scripts/verify-public-domain-corpus.mjs
```

The verifier checks source-text presence, word-count bounds, apostrophe preservation floors, forbidden publisher/printer/Gutenberg/illustration artifacts, chapter count, and continuous Roman-numeral chapter sequence when configured.

If this verifier fails, do not use the affected text as a benchmark fixture until the clean source text or registry expectation is corrected.
