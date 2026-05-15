# Public Domain Corpus

This directory is the governed substrate for public-domain fiction used by RevisionGrade calibration and benchmark harnesses.

## Purpose

The corpus exists to support offline evaluation proof, not production prompt injection.

Allowed first uses:

- pipeline smoke fixtures
- long-form routing and chunking proof
- score drift checks
- QualityGate fidelity checks
- golden expected-behavior calibration

## Non-goals

This substrate must not change user-facing evaluation behavior by itself.

- No `runPipeline` changes
- No prompt changes
- No scoring changes
- No QualityGate changes
- No runtime RAG
- No model fine-tuning
- No production bundle dependency

## Directory contract

```text
corpus/public-domain/
  manifest.public-domain.json
  README.md
  raw/.gitkeep
  clean/.gitkeep
  metadata/.gitkeep
```

`raw/` is for downloaded source text before cleanup.

`clean/` is for story/manuscript text only, after source boilerplate, license headers, footers, transcription notes, and modern editorial material are removed.

`metadata/` may hold per-work provenance notes when a manifest row is not enough.

## Provenance rule

Every usable work must appear in `manifest.public-domain.json` with:

- stable id
- title
- author
- first publication year
- source name
- source URL
- jurisdiction basis
- raw text path
- clean text path
- allowed uses
- cleaning status

## Runtime guardrail

Do not import corpus text into production evaluation code. The first integration should be through scripts and tests only.
