# PR #817 Conflict-Resolution Checklist (Strict 1–7 Format)

Purpose: manual conflict repair for `#817` from current `main`, with **no scope expansion**.

Allowed scope only:
- canonical nine-layer key list
- `STORY_LAYER_COUNT`
- schema/envelope/test alignment
- removal of hardcoded 8-layer assumptions

Preserve already-merged behavior:
- #823 Story Ledger Visibility Gate
- #820 Canonical Identity Hygiene
- #821 Revise Admission Gate

---

## File 1
1. **File path:** `.github/pr-bodies/PR-817.md`
2. **#817 intended change:** Add PR body summary/validation text for nine-layer contract alignment.
3. **Current `main` baseline after #823/#820/#821:** Runtime unaffected; these PRs are merged and now baseline constraints.
4. **Keep from current `main`:** Existing PR governance formatting and no-regression wording conventions.
5. **Re-apply from #817:** Nine-layer contract summary and targeted validation command references.
6. **Must not change:** Any wording implying visibility/admission semantics change in #817.
7. **Focused safety test:** PR Body Guardian check + manual body review (`gh pr view 817 --json body`).

## File 2
1. **File path:** `__tests__/components/ledger/storyLayerMetadata.test.ts`
2. **#817 intended change:** New test to enforce metadata registry alignment with canonical layer keys and eliminate local duplicate copy maps.
3. **Current `main` baseline after #823/#820/#821:** #823 visibility filtering is active; this test must not force removal of visibility props/flow.
4. **Keep from current `main`:** Any assertions/usage patterns needed for visibility-aware shell rendering.
5. **Re-apply from #817:** Key alignment assertion (`Object.keys(STORY_LAYER_METADATA) === STORY_LAYER_KEYS`) and shared metadata usage checks.
6. **Must not change:** No test expectations that reintroduce or remove `isAdminViewer`, `visibleLayerKeys`, `withheldLayerKeys` behavior.
7. **Focused safety test:** `npx jest --runInBand __tests__/components/ledger/storyLayerMetadata.test.ts __tests__/lib/ledger/storyLedgerVisibility.test.ts`.

## File 3
1. **File path:** `__tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`
2. **#817 intended change:** Switch from old core key constant usage to canonical `STORY_LAYER_KEYS` and assert count consistency.
3. **Current `main` baseline after #823/#820/#821:** #820/#821 do not alter this file’s intended contract checks.
4. **Keep from current `main`:** Existing artifact writer assertions unrelated to layer-count naming.
5. **Re-apply from #817:** `STORY_LAYER_KEYS` mapping + `STORY_LAYER_COUNT` expectation.
6. **Must not change:** Identity hygiene semantics (#820) or queue admission semantics (#821).
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`.

## File 4
1. **File path:** `__tests__/evaluation/schemas.envelope.test.ts`
2. **#817 intended change:** Enforce nine required story layers via shared constants and required-length check.
3. **Current `main` baseline after #823/#820/#821:** Envelope checks already coexist with merged #820/#821 behavior.
4. **Keep from current `main`:** Existing runtime-envelope required fields and non-layer schema assertions.
5. **Re-apply from #817:** `...STORY_LAYER_KEYS` and `RUNTIME_ENVELOPE_REQUIRED_FIELDS.length + STORY_LAYER_COUNT` check.
6. **Must not change:** Any guard/admission logic assertions unrelated to nine-layer schema contract.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/schemas.envelope.test.ts`.

## File 5
1. **File path:** `components/ledger/StoryLedgerLayers.tsx`
2. **#817 intended change:** Replace local layer description table with shared `STORY_LAYER_METADATA` descriptions.
3. **Current `main` baseline after #823/#820/#821:** Visibility-gated display behavior from #823 must remain intact.
4. **Keep from current `main`:** All filtered-layer rendering behavior and currently merged UI logic.
5. **Re-apply from #817:** Metadata-source unification only (descriptions/titles from shared metadata).
6. **Must not change:** No pronoun-family UI policy additions; no semantic layer repair logic.
7. **Focused safety test:** `npx jest --runInBand __tests__/components/ledger/storyLayerMetadata.test.ts __tests__/lib/ledger/storyLedgerVisibility.test.ts`.

## File 6
1. **File path:** `components/ledger/StoryLedgerShell.tsx`
2. **#817 intended change:** Remove hardcoded layer labels/icons/count copy; use shared keys/metadata and dynamic count text.
3. **Current `main` baseline after #823/#820/#821:** #823 server-filtered layer behavior is critical (`isAdminViewer`, `visibleLayerKeys`, `withheldLayerKeys`, filtered `displayLayerOrder`, withheld-copy behavior).
4. **Keep from current `main`:** Entire #823 visibility path and decision-flow safety logic.
5. **Re-apply from #817:** Contract-only de-hardcoding (shared metadata and non-hardcoded layer count text).
6. **Must not change:** Do not accept stale branch deletions/refactors unrelated to nine-layer contract; do not alter visibility/admission semantics.
7. **Focused safety test:** `npx jest --runInBand __tests__/lib/ledger/storyLedgerVisibility.test.ts __tests__/components/ledger/storyLayerMetadata.test.ts && npx tsc --noEmit`.

## File 7
1. **File path:** `components/ledger/storyLayerMetadata.ts`
2. **#817 intended change:** Add centralized metadata map keyed by canonical story layer keys.
3. **Current `main` baseline after #823/#820/#821:** Metadata should remain pure display config compatible with filtered key usage.
4. **Keep from current `main`:** Current canonical key naming/order from artifact constants.
5. **Re-apply from #817:** Typed metadata registry (`satisfies Record<StoryLayerCoreLayerKey, StoryLayerDisplayMetadata>`).
6. **Must not change:** No gating, identity hygiene, or queue logic in this file.
7. **Focused safety test:** `npx jest --runInBand __tests__/components/ledger/storyLayerMetadata.test.ts`.

## File 8
1. **File path:** `docs/canon/STORY_LAYER_CONTRACT_V1.md`
2. **#817 intended change:** Update contract language/diagram to explicit nine-layer model including `identity_pronoun_layer`.
3. **Current `main` baseline after #823/#820/#821:** #823 server-side gating is authoritative; docs must not imply client-side inference.
4. **Keep from current `main`:** Governance and artifact-flow constraints.
5. **Re-apply from #817:** Nine-layer wording and diagram alignment only.
6. **Must not change:** No semantics outside layer-count contract; no contradiction of #823.
7. **Focused safety test:** Canon/docs checks (`canon-authority`, `Fixture Canon Guard`).

## File 9
1. **File path:** `docs/canon/intake/_md/REVISIONGRADE CANON ADDENDUM Criterion Observability & Signal Sufficiency Model.md`
2. **#817 intended change:** Terminology cleanup from “9-layer implementation checklist” to neutral “layer implementation checklist”.
3. **Current `main` baseline after #823/#820/#821:** Runtime unaffected.
4. **Keep from current `main`:** Existing doctrine content and structure.
5. **Re-apply from #817:** Wording cleanup only.
6. **Must not change:** Doctrinal logic beyond phrasing.
7. **Focused safety test:** Docs/canon checks.

## File 10
1. **File path:** `docs/evaluation/fixtures/froggin-100p/canon_correction_playbook_v1.md`
2. **#817 intended change:** Remove explicit “required 8-layer” phrasing.
3. **Current `main` baseline after #823/#820/#821:** Runtime unaffected.
4. **Keep from current `main`:** Existing fixture-governance flow.
5. **Re-apply from #817:** Contract wording normalization consistent with nine-layer model.
6. **Must not change:** Any scoring/governance semantics unrelated to layer-count language.
7. **Focused safety test:** Docs lint + canon guards.

## File 11
1. **File path:** `lib/evaluation/artifacts/artifactTypes.ts`
2. **#817 intended change:** Standardize canonical exports: `STORY_LAYER_KEYS` and `STORY_LAYER_COUNT`.
3. **Current `main` baseline after #823/#820/#821:** `main` already uses these canonical exports.
4. **Keep from current `main`:** Existing exports/types currently consumed by merged code.
5. **Re-apply from #817:** Only missing naming/count consistency hunks (if conflict introduces regression).
6. **Must not change:** Artifact type registry behavior outside key/count constants.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts __tests__/evaluation/schemas.envelope.test.ts`.

## File 12
1. **File path:** `lib/evaluation/phase1a/buildStoryLayerFromLedger.ts`
2. **#817 intended change:** Comment/text cleanup to reflect canonical layer framing.
3. **Current `main` baseline after #823/#820/#821:** Functional behavior must stay aligned with merged #820 and #823 baseline.
4. **Keep from current `main`:** Existing runtime layer-building logic.
5. **Re-apply from #817:** Non-functional comments/text only.
6. **Must not change:** Any extraction semantics (POV/relationships/symbols/timeline/threat).
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`.

## File 13
1. **File path:** `lib/evaluation/phase1a/storyLayerArtifactWriters.ts`
2. **#817 intended change:** Validate payload strictly against shared canonical key list and count.
3. **Current `main` baseline after #823/#820/#821:** Main already aligned; avoid regression during conflict resolution.
4. **Keep from current `main`:** Current payload validation behavior and error-path handling.
5. **Re-apply from #817:** Shared constant references where conflict reintroduces old names.
6. **Must not change:** Forbidden-key policy/envelope semantics unrelated to layer-count contract.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`.

## File 14
1. **File path:** `lib/evaluation/pipeline/prompts/pass2-editorial.ts`
2. **#817 intended change:** Replace local layer label map with titles from shared metadata.
3. **Current `main` baseline after #823/#820/#821:** Admission/identity behavior is already merged elsewhere and must remain untouched.
4. **Keep from current `main`:** Existing author-corrections generation logic.
5. **Re-apply from #817:** Metadata-sourced labels only.
6. **Must not change:** Editorial semantics/scoring logic/admission logic.
7. **Focused safety test:** Prompt unit coverage (if present) + full CI governance checks.

## File 15
1. **File path:** `lib/evaluation/processor.ts`
2. **#817 intended change:** Comment wording cleanup (“canonical Story Layer payload”).
3. **Current `main` baseline after #823/#820/#821:** #821 admission-gate logic is now canonical and must remain unchanged.
4. **Keep from current `main`:** All runtime control flow including merged #821 behavior.
5. **Re-apply from #817:** Comment-only wording updates, if desired.
6. **Must not change:** Any processor runtime behavior.
7. **Focused safety test:** `npx jest --runInBand __tests__/lib/revision/workbenchQueue.test.ts` + CI processor tests.

## File 16
1. **File path:** `lib/evaluation/stage-machine/hardStopGuards.ts`
2. **#817 intended change:** Use canonical `STORY_LAYER_KEYS`/count checks in guard helpers.
3. **Current `main` baseline after #823/#820/#821:** Main is already aligned with canonical key list usage.
4. **Keep from current `main`:** Existing guard logic and failure messaging behavior.
5. **Re-apply from #817:** Naming/count alignment only where conflicts show regression.
6. **Must not change:** Guard semantics beyond nine-layer contract enforcement.
7. **Focused safety test:** stage-machine guard tests + `__tests__/evaluation/schemas.envelope.test.ts`.

## File 17
1. **File path:** `schemas/evaluation/accepted_story_ledger_v1.schema.json`
2. **#817 intended change:** Add `identity_pronoun_layer` to required/properties.
3. **Current `main` baseline after #823/#820/#821:** Must remain consistent with nine-layer canonical schema set.
4. **Keep from current `main`:** Existing schema structure and non-layer fields.
5. **Re-apply from #817:** Ensure `identity_pronoun_layer` remains in required/properties.
6. **Must not change:** Unrelated schema fields/constraints.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/schemas.envelope.test.ts`.

## File 18
1. **File path:** `schemas/evaluation/ledger_user_feedback_v1.schema.json`
2. **#817 intended change:** Add `identity_pronoun_layer` in allowed layer enum.
3. **Current `main` baseline after #823/#820/#821:** Must remain consistent with canonical nine-layer key list.
4. **Keep from current `main`:** Existing feedback schema structure.
5. **Re-apply from #817:** Keep/restore `identity_pronoun_layer` enum entry.
6. **Must not change:** Any unrelated feedback schema behavior.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/schemas.envelope.test.ts`.

## File 19
1. **File path:** `schemas/evaluation/pass1a_story_layer_v1.schema.json`
2. **#817 intended change:** Add `identity_pronoun_layer` to required and properties.
3. **Current `main` baseline after #823/#820/#821:** Main already includes nine-layer schema; avoid conflicts dropping this key.
4. **Keep from current `main`:** Existing schema envelope and non-layer constraints.
5. **Re-apply from #817:** Retain `identity_pronoun_layer` in required/properties.
6. **Must not change:** Non-layer schema semantics.
7. **Focused safety test:** `npx jest --runInBand __tests__/evaluation/schemas.envelope.test.ts __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts`.

---

## Final merge-gate proof pack (after manual conflict repair)

1. `npx jest --runInBand __tests__/lib/ledger/storyLedgerVisibility.test.ts`
2. `npx jest --runInBand __tests__/lib/evaluation/pipeline/identityNameHygiene.test.ts __tests__/lib/evaluation/pipeline/identityReducerFallback.test.ts`
3. `npx jest --runInBand __tests__/lib/revision/workbenchQueue.test.ts`
4. `npx jest --runInBand __tests__/components/ledger/storyLayerMetadata.test.ts __tests__/evaluation/phase1a.storyLayerArtifactWriters.test.ts __tests__/evaluation/schemas.envelope.test.ts`
5. `npx tsc --noEmit`

Merge block: if conflict resolution introduces dependency blocking, pronoun-family UI policy, relationship repair, timeline/threat repair, Source Integrity aggregation, or Revise UI changes, stop and split to a new PR.
