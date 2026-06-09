# English Variant Prompt Propagation

## Problem

The evaluation UI captures an `english_variant` value, such as Canadian English, but the evaluation pipeline prompts do not currently receive that setting. As a result, the model may evaluate or generate report language without respecting the writer's selected English variant.

## Required behavior

When a user selects an English variant during manuscript evaluation, that value must be carried from the saved evaluation/job/manuscript input into every prompt-building layer that can affect author-facing language.

The selected variant should reach at least:

- Pass 1 craft/diagnostic prompts
- Pass 2 editorial prompts
- Pass 3 synthesis/report prompts
- Pass 4 governance/cross-check prompts where author-facing wording or language-style validation is relevant
- Any downstream Revise/Workbench prompt that generates author-facing recommendation text

## Prompt instruction contract

Prompt builders should receive a normalized instruction such as:

> Use Canadian English spelling, grammar, punctuation, idiom, and editorial conventions unless directly quoting the manuscript.

For other supported variants, substitute the selected convention:

- Canadian English
- American English
- British English
- Australian English
- New Zealand English
- Other supported variants in the UI contract

## Implementation notes

1. Load `english_variant` from the persisted evaluation source of truth.
2. Add it to the shared pipeline context rather than passing it ad hoc through individual functions.
3. Normalize the value once into a stable prompt instruction.
4. Inject the instruction into prompt headers near genre, audience, evaluation mode, testimony mode, and voice-preservation settings.
5. Preserve manuscript quotes exactly; variant normalization applies to generated editorial language, not quoted source text.
6. Add tests proving selected Canadian English reaches prompt construction.

## Acceptance criteria

- Selecting Canadian English in the UI results in Pass 1, Pass 2, Pass 3, and relevant Pass 4 prompt text containing a Canadian English instruction.
- The instruction is absent only when no English variant was selected and the default behavior is intentionally used.
- Tests fail if `english_variant` is stored but not passed into prompt construction.
- Generated evaluation copy and recommendation text are governed by the selected variant.

## Non-goals

This change does not rewrite manuscript text into a different English variant. It governs only RevisionGrade-generated editorial/report language unless a future explicit rewrite/polish action requests otherwise.
