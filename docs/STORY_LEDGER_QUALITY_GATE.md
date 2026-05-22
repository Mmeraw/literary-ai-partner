# Story Ledger Quality Gate

This document defines the minimum approval bar for the Story Ledger stage before the full manuscript diagnosis can rely on the ledger as accepted grounding.

## Purpose

The Story Ledger must prove that RevisionGrade understands the manuscript's story map before Stage 2 evaluation begins. It is not merely a cast list. It is the grounding layer for character, relationship, object, continuity, POV, and closure-aware evaluation.

A ledger that looks detailed but misses core cast, POV, antagonistic force, high-value objects, or ending accountability is not approval-ready.

## Hard approval blockers

A Story Ledger must be held for repair when any of the following are true:

1. **Identity fragmentation**
   - The same person appears as multiple major/protagonist rows because of name, language, title, narrator-label, surname, or later legal-name variants.
   - Example failure class: `Michael`, `Miguel`, `Michael James Salter`, `Mr. Salter`, `Michael Wagner`, or `Unnamed narrator` appear as separate top-level people when the text identifies them as the same character.

2. **Missing POV structure**
   - The ledger does not identify primary and secondary POV owners.
   - The ledger cannot distinguish a true unnamed narrator from a named character narrating under a temporary label.
   - Each POV entry should include a POV type, narrative share, and section labels.

3. **No antagonists in a threat/power manuscript**
   - If the manuscript clearly contains captors, enforcers, coercive figures, cartel/institutional power, abusers, surveillers, or threat-bearing characters, `Antagonists: None detected` is a hard failure.
   - Moral complexity does not erase antagonistic function.

4. **Major supporting cast omitted**
   - Named recurring or load-bearing figures are absent from the ledger despite driving danger, logistics, moral pressure, or plot movement.
   - Supporting cast must include camp/community/family/institutional figures when they affect the story map.

5. **High-value objects missing**
   - Weapons, discipline tools, surveillance/communication devices, charms, legal documents, escape objects, recurring domestic anchors, and objects that change hands or pay off later must appear in the Object / Symbol Ledger.

6. **Warnings are not actionable**
   - Warnings must be grouped, deduplicated, and tied to an affected character/subject.
   - User-facing warnings should include where the issue was detected using Evidence labels, not internal chunk language.

7. **No ending accountability for major characters**
   - Every primary, major, antagonist, and load-bearing secondary character needs a final state: resolved, transformed, dead, departed, missing, intentionally open, underpaid, or unresolved.
   - The ledger should show last evidence reference and whether the ending state is accountable.

8. **Internal vocabulary leaks into user output**
   - Do not show `chunk` in the author-facing ledger or report.
   - Use `Evidence`, `Evidence span`, `source passage`, or another editorial label.

9. **Coping noise masks real signal**
   - Repeated `rare` tags on every coping item should not be displayed to authors.
   - Frequency is useful only when it distinguishes rare, recurring, and dominant patterns.

## Required ledger sections

A production-grade Story Ledger should include:

- POV Structure
- Character Identity / Alias Ledger
- Character Arc Ledger
- Antagonists / Threat Forces
- Major Secondary Characters
- Relationship Ledger
- Object / Symbol Ledger
- Psychology / Coping Ledger
- Ending Accountability / Terminal Ledger
- Grouped Warnings with Evidence references

## Acceptance checklist

Before a ledger can be approved without admin override:

- [ ] Canonical identities are merged across aliases, spellings, titles, and narrator labels.
- [ ] Primary and secondary POV owners are listed.
- [ ] POV narrative share is bounded to <= 100% across POV owners.
- [ ] Antagonists/threat-bearing roles are present when the manuscript contains obvious coercive force.
- [ ] Major secondary cast is not collapsed into relationship notes or omitted.
- [ ] Object / Symbol Ledger includes weapons, control tools, communication/surveillance objects, charms, and payoff objects.
- [ ] Relationship origin/evolution is not flattened to the first observed relationship label.
- [ ] Warnings are grouped by affected subject and include Evidence references.
- [ ] Major characters have ending accountability.
- [ ] User-facing output uses `Evidence`, not `chunk`.
- [ ] Coping patterns are capitalized and frequency tags are hidden unless meaningful.

## Non-goals for this gate

- This gate does not score manuscript quality.
- This gate does not generate revision advice.
- This gate does not decide marketability.
- This gate only decides whether the story map is trustworthy enough for downstream evaluation.

## Merge sequencing note

This gate should be merged after the base hardening migration chain is green so Flow 1 proof-pack failures do not mask Story Ledger regressions.
