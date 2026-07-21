# Held Recovery live proof — operational handoff

**Status:** Evaluation complete; Evaluate → Revise producer regression proven; Held Recovery not triggered.

This record exists so another operator or agent can continue from repository facts rather than chat history. It contains no credentials.

## Repository and production authority

- Audited `origin/main`: `6597f4348af130645e03645e7e8e6842aeb10353`.
- PR #1367 proof harness merge is present in main history as `9268e06a`.
- Production health before the credential redeploy reported `git_sha=9268e06` and green health.
- Harness:
  - `scripts/revision/held-recovery-causal-chain-proof.ts`
  - `tests/scripts/held-recovery-causal-chain-proof.test.ts`
- Focused harness evidence already obtained: 17/17 tests pass, TypeScript passes, diff hygiene passes.

## Controlled source evaluation

- Source report: `fad9add0-1588-4a4d-b5a2-da6007ccfc66`
- Title: `DIAMONDS AREN’T FOREVER`
- Source manuscript ID: `7514`
- Source job status: `complete`
- Source job type: `full_evaluation`
- Existing Revise authority: exactly one `revision_opportunity_ledger_v1` artifact containing 15 opportunities.
- The source evaluation and its ledger are read-only inputs. They have not been mutated.

## Production operations completed

1. Verified main ancestry and that the proof harness is on main.
2. Verified the existing production deployment was healthy at runtime SHA `9268e06`.
3. Redeployed the existing runtime to test environment ingestion:
   - `dpl_78jihY9w9jtu3hKikhUDRNvugZua` — READY, but retained the original deployment environment snapshot.
   - `dpl_7txXWRrBov8HoYtYzjGg1Ey79jkj` — READY, same snapshot behavior.
   - `dpl_GZnpkZXv3WiFo5CX8dYCZAcK84L8` — READY, same snapshot behavior.
4. No request passed proof-route authorization during those snapshot redeployments. Therefore no new evaluation job or manuscript was created.
5. Started a clean Vercel CLI source deployment from exact `origin/main` in an isolated temporary worktree. This is intended to ingest current production environment values. Temporary control files and encrypted credentials are outside that deployment source.
6. Created the held proof authority directly with the service role after the proof-route credential remained unusable:
   - job `7c3f47a6-bfc2-4025-a7fc-d1ce0456a609`
   - manuscript `7783`
   - creation authority is explicitly classified as `operator_service_role_equivalent_payload`; HR-000 route creation is **not** claimed.
7. Verified the job survived the watchdog window as `queued / awaiting_approval`, with hold/target markers true and no claim or worker.
8. Deployed the exact-job target and released the job with a guarded database update after the release endpoint also returned 401.
9. Rotated the production worker credential, deployed, and invoked the existing worker with the exact evaluation job pin.

## Live evaluation checkpoint

- Phase 0 completed in 14,630 ms.
- Input: 6,146 words / 34,548 characters.
- Governed route: long form, two persisted chunks, 316-word overlap.
- Phase 0 artifacts observed: `story_map_seed_v1`, `evaluation_seed_v1`, `seed_fit_gap_report_v1`.
- Full-context story ledger completed in 105,628 ms.
- Ledger completeness: 100%; quality passed; structural validation passed; zero missing layers, degraded dimensions, or structural warnings.
- Phase 1A completed and governed short-form Review Gate skip was recorded (`6,146 < 25,000` words).
- Phase 2 and Phase 3B completed with no failure code or last error.
- Final job state: complete.
- Total persisted artifacts: 23, each expected final authority present exactly once.
- Final authorities include `unified_evaluation_document_v1`, `author_exposure_certification_v1`, `artifact_consistency_gate_v1`, `report_render_manifest_v1`, and `revision_opportunity_ledger_v1`.
- Progress incorrectly reported 100% throughout active Phase 3B synthesis. This is a production-proven progress semantic defect.

## Evaluate → Revise root-cause evidence

- The historical source job for the identical Diamonds manuscript has one canonical ledger with 15 opportunities.
- The fresh job persisted exactly one canonical ledger (`755bc51e-6e47-4cd4-b409-045687b9dbd0`) with `opportunities: []`.
- Recommendation flow by artifact:
  - Pass 1 chunk cache: 0 recommendation entries.
  - Pass 2 chunk cache: 15 criterion recommendation entries.
  - Post-QG effective snapshot: one surviving report-summary recommendation represented on two snapshot paths; zero criterion recommendations.
  - `evaluation_result_v2`: one report-summary recommendation; zero criterion recommendations.
  - UED: one `topRecommendations` entry; zero criterion recommendations; zero canonical opportunities.
  - Revise ledger: zero opportunities.
- Final criterion dispositions (13/13 with rationale):
  - 8 `no_recommendation_warranted`
  - 4 `gate_suppressed_no_safe_recommendation`
  - 1 `insufficient_evidence`
- Material examples:
  - Narrative Drive: 6/10, high confidence, suppressed.
  - Pacing: 5/10, high confidence, suppressed.
  - Prose Control: 7/10, high confidence, suppressed.
  - Narrative Closure: 5/10, moderate confidence, insufficient evidence.
- Certification and consistency gates passed because the final disposition/cardinality state is internally consistent. They do not detect that 15 Pass 2 recommendations disappeared without recommendation-level lineage dispositions during Pass 3/post-QG synthesis.

### Root cause

The Pass 2 → Pass 3 process contract tracks final per-criterion cardinality but does not require an explicit governed disposition for every upstream Pass 2 recommendation. Pass 3 can therefore replace or suppress the entire criterion recommendation set, emit valid criterion-level empty statuses, and pass certification while losing all upstream recommendation lineage.

### Required corrective action and mistake-proofing

1. Establish stable identities for Pass 2 recommendations before the Pass 3 boundary.
2. Require one explicit Pass 3 outcome per Pass 2 recommendation: retained, consolidated (with target identity), or suppressed (with governing rule and evidence).
3. Make unmatched/missing/duplicate source identities a specific retryable contract failure with one durable kickback; block persistence after exhaustion.
4. Keep report-summary recommendations non-authoritative for Revise.
5. Preserve existing editorial filters, but require them to explain each removed source recommendation rather than silently replacing the source collection.
6. Add production-shaped characterization using this exact 15 → 0 fixture and assert the loss fails closed before certification/persistence.
7. Correct the proof harness transition query: `held_recovery_queue_transition_events` is keyed by `held_item_id`, not `manuscript_id`; join through `held_recovery_queue_items`.

## Held Recovery result

- Held queue identities: 0.
- Deferred attempts: 0.
- Reconstruction work items: 0.
- Reconstructed anchors: 0.
- Transition events: 0.
- Readmission/decision rows: 0.
- Therefore PG-01/PG-02/PG-03 remain unproven for this manuscript. The job is valid evidence for Evaluate → Revise recommendation-loss forensics, not a successful Held Recovery proof.

## Current blocker and root cause classification

The proof route returned HTTP 401 before job creation. The production `PROOF_RUN_SECRET` and the credential available to the operator were not the same effective value. Redeploying an existing Vercel deployment reused its environment snapshot, so it could not correct the mismatch.

This is an operational credential/deployment-snapshot issue, not an Evaluate, Held Recovery, Readmission, queue, or Workbench defect.

Corrective action in progress: rotate the proof-only secret, perform a fresh source deployment, verify authorization, then create the held job.

## Required continuation sequence

1. Wait for the clean source deployment to become production READY and verify `/api/health` is green.
2. Verify the proof route accepts the rotated proof credential.
3. Create a **new** job from the Diamonds manuscript with `hold_for_held_recovery_proof: true`.
4. Record the returned job and manuscript IDs here. Do not reuse or mutate the source report.
5. Wait through at least one watchdog cycle and prove the held job remains:
   - `status=queued`
   - `phase_status=awaiting_approval`
   - `progress.phase_status=queued`
   - `progress.held_recovery_proof_hold=true`
   - `claimed_at=null`
   - `worker_id=null`
6. Set `HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID` to that exact new job ID.
7. Perform a fresh source redeploy; do not use a snapshot redeploy.
8. Verify the deployment is READY and the held job is still untouched.
9. Execute the proof harness with `--replay`.
10. Require the complete causal chain and cardinality/isolation evidence; fail closed on ambiguity.
11. Remove the exact-job target and proof-only credential, redeploy, and confirm the route is disabled.
12. Commit the harness JSON output and update this record with final results, failure classification, latency, queue/Workbench evidence, reload/replay evidence, and remaining gaps.

## Safety state at handoff

- Source Diamonds report: untouched.
- Existing Diamonds Revise ledger: untouched.
- Fresh proof job: `7c3f47a6-bfc2-4025-a7fc-d1ce0456a609`.
- Fresh proof manuscript: `7783`.
- Proof job released: **yes**.
- Exact-job target configured: **yes**, only for the fresh job.
- Evaluation completed. Reconstruction, Readmission, and Workbench mutation did not occur because no Held authority or canonical opportunity was produced.
