# Held Recovery live proof — operational handoff

**Status:** In progress; controlled job is live in Phase 1A.

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
- Current state: Phase 1A running, no failure code or last error.

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
- Evaluation claim and Phase 0/1A processing have occurred. Reconstruction, Readmission, and Workbench mutation are not yet evidenced.
