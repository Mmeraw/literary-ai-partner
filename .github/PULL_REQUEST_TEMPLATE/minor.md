<!-- PR Template: Minor Change -->
<!-- pr-type: minor -->
<!-- Use this template for trivial fixes: typos, comment updates, small copy edits, -->
<!-- and other changes that do NOT touch runtime code, the evaluation pipeline,     -->
<!-- scoring, provider calls, or public-facing behavior.                            -->
<!--                                                                                -->
<!-- Enforcement: pr-type:minor is only accepted when ALL changed files fall within  -->
<!-- the minor allowlist (docs, PR templates, markdown, trivial root files).         -->
<!-- If your change touches lib/evaluation/**, app/api/**, supabase/migrations/**,  -->
<!-- prompts, or any pipeline contract, use the code or evaluation template instead. -->

## Summary

<!-- One or two sentences: what changed and why. -->

## Scope

<!-- Which files are touched. What is explicitly NOT touched. -->

## Risk

<!-- Why is this change low-risk? (e.g. typo fix, no runtime path, no scoring change) -->

## Branch Freshness (Never Behind)

<!-- Required: PR head must include current base HEAD. Keep this at 0 before merge/close. -->

Branch-Behind-Base: 0

## Risks & Anomalies

<!-- What could go wrong; how it's mitigated. For truly trivial changes: "Typo-only — no runtime risk." -->

---

No-Pipeline-Impact: Confirmed — this PR does not modify lib/evaluation/**, app/api/workers/**, prompts, or any pipeline contract.

<!-- pr-type: minor -->
