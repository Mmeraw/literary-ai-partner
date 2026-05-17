# RevisionGrade — Deferred Backlog (post-PR-E)

Items intentionally parked while PR-E (#519/#520) ships. Do NOT pull any of these into PR-E.

## Cosmetic / display bugs

### 1. Score Ledger normalized-scale display bug
- **Symptom:** Report footer shows `Raw 5.67 / 10, Normalized 5.67 / 100` — should be ~56.7/100
- **Where:** Pass 3 synthesis output or report-rendering code
- **Note:** "Overall Score 53.00" is correctly computed; only the ledger label is wrong
- **Severity:** Cosmetic, low

### 2. Pass 3 summary truncation
- **Symptom:** Overall Summary in cb200799 report ends mid-word: `"A targeted structural an."`
- **Where:** Pass 3 synthesis prompt output or character cap before render
- **Severity:** Cosmetic, medium (degrades report polish)

### 3. UI status double-signal
- **Symptom:** Failed jobs surface both "In progress" and "Needs attention"
- **Severity:** Cosmetic, low

## Functional issues to revisit after PR-E

### 4. Narrative Closure comparison packet missing
- **Symptom:** "Comparison packet detail for closure was not provided" in long-form report
- **Hypothesis:** May be downstream consequence of inflated source corrupting Pass 4 evidence selection. **Possibly self-resolves after PR-E.**
- **Action:** Re-test after PR-E + cleanup; only investigate further if still missing
- **Related:** closed PR #502 was about long-form Pass 4 evidence

### 5. PR-B — Pass 1 detectedSignals / doctrineTrace minItems:1
- **Symptom:** `gpt_signals_cnt = 0` across all 13 criteria in earlier failure-mode runs
- **Status:** Downgraded; tonight's run completed without it
- **Action:** Re-test post-PR-E. If signals are still empty when synthesis runs on uncorrupted source, surface PR-B from backlog

## Open PRs to triage post-PR-E

- **#507** corpus substrate — HOLD as fallback
- **#513** corpus seed texts (181k additions) — HOLD pending corpus governance
- **#494, #487, #486, #482** — DEFER, re-check after PR-E merges

## Discovered tonight, not yet filed
- The `current_session_context` evaluation pipeline appears to have NO regression test for "manuscript word count from `manuscripts.word_count` matches report word count." Consider adding a smoke test after PR-E.
- `evaluation_artifacts` table has no persisted artifacts for failed jobs — possibly intentional, but limits forensics. Worth confirming.
