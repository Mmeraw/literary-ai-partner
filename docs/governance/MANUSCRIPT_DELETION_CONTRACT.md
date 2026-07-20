# Manuscript Deletion Contract

This document is the authoritative contract for `public.delete_manuscripts_permanently(p_user_id, p_manuscript_ids)` and the server code that invokes it.

## Boundary

- **Delete permanently**: all content owned by the manuscript and its operational derivatives (versions, chunks, evaluation jobs/artifacts, revision workbench, held-recovery data, generated document events, exports, project listings, etc.).
- **Preserve/anonymize**: billing, revenue, cost accounting, security/audit logs, and fraud-evidence records. These lose direct manuscript and job linkage where possible, but the financial/audit/fraud history remains.

## Contract

The RPC must:

1. Verify every supplied `manuscript_id` belongs to `p_user_id`.
2. Lock the selected `manuscripts` rows for the transaction.
3. Anonymize or delete dependent records in the order below.
4. Delete the `manuscripts` rows.
5. Return the exact ids deleted and per-table counts.
6. Roll back everything if any step fails (single transaction).
7. Be idempotent for already-deleted or unknown ids.

## Dependency / Retention Matrix

| Table | Parent / FK | FK Action | Classification | Deletion Strategy |
|---|---|---|---|---|
| `manuscripts` | — | — | **Delete** | Delete selected rows last. |
| `manuscript_versions` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`. |
| `manuscript_chunks` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts` or `evaluation_jobs` (also `job_id` CASCADE). |
| `evaluations` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`. |
| `evaluation_jobs` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Explicitly deleted before `manuscripts`; cascades to most job-owned tables. |
| `evaluation_projects` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`; cascades to `evaluation_stage_runs` and `evaluation_events`. |
| `evaluation_stage_runs` | `evaluation_projects(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_projects`. |
| `evaluation_events` | `evaluation_projects(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_projects`. |
| `evaluation_artifacts` | `manuscripts(id)` / `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts` or `evaluation_jobs`. |
| `evaluation_provider_calls` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `pipeline_logs` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `diagnostic_findings` | `evaluation_jobs(id)` / `manuscript_versions(id)` | `ON DELETE CASCADE` / `SET NULL` | Delete | Cascade from `evaluation_jobs`. |
| `chunk_evidence` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `revision_sessions` | `evaluation_jobs(id)` / `manuscript_versions(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `change_proposals` | `revision_sessions(id)` | `ON DELETE CASCADE` | Delete | Cascade from `revision_sessions`. |
| `final_review_apply_runs` | `manuscripts(id)` / `evaluation_jobs(id)` / `manuscript_versions(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`, `evaluation_jobs`, or `manuscript_versions`. |
| `revision_ledger_decisions` | `manuscripts(id)` / `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts` or `evaluation_jobs`. |
| `agent_readiness_sections` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `agent_readiness_author_review_decisions` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`. |
| `agent_readiness_packages` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`; cascades to exports/approvals. |
| `agent_readiness_package_exports` | `agent_readiness_packages(id)` | `ON DELETE CASCADE` | Delete | Cascade from `agent_readiness_packages`. |
| `agent_readiness_creator_approvals` | `agent_readiness_packages(id)` | `ON DELETE CASCADE` | Delete | Cascade from `agent_readiness_packages`. |
| `storygate_submissions` | `evaluation_jobs(id)` | `ON DELETE CASCADE` | Delete | Cascade from `evaluation_jobs`; cascades to listings. |
| `storygate_project_listings` | `storygate_submissions(id)` | `ON DELETE CASCADE` | Delete | Cascade from `storygate_submissions`; cascades to access requests/grants. |
| `storygate_access_requests` | `storygate_project_listings(id)` | `ON DELETE CASCADE` | Delete | Cascade from `storygate_project_listings`. |
| `storygate_access_grants` | `storygate_project_listings(id)` | `ON DELETE CASCADE` | Delete | Cascade from `storygate_project_listings`. |
| `storygate_access_audit_events` | `storygate_project_listings(id)` | `ON DELETE SET NULL` | Preserve / anonymize | `listing_id` is set to NULL when listing deleted; audit row remains. |
| `held_recovery_attempts` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`. |
| `held_recovery_reconstructed_anchors` | `manuscripts(id)` | `ON DELETE CASCADE` | Delete | Cascade from `manuscripts`. |
| `held_recovery_queue_items` | none (loose `manuscript_id` text column) | n/a | Delete | Explicitly delete by `manuscript_id::text` before `manuscripts`; cascades to `held_recovery_queue_transition_events`. |
| `held_recovery_queue_transition_events` | `held_recovery_queue_items(held_item_id)` | `ON DELETE CASCADE` | Delete | Cascade from `held_recovery_queue_items`. |
| `held_recovery_reconstruction_work_items` | `held_recovery_attempts(id)` (RESTRICT) | `ON DELETE RESTRICT` | Delete | Explicitly delete by `manuscript_id::text` before `held_recovery_attempts` are deleted. |
| `held_recovery_retry_schedules` | none (loose `attempt_id` text column) | n/a | Delete | Explicitly delete by `attempt_id` (text) before `held_recovery_attempts` are cascade-deleted. |
| `revision_events` | `manuscripts(id)` / `revision_sessions(id)` / `change_proposals(id)` / `evaluation_jobs(id)` | `SET NULL` / `CASCADE` | Delete | Explicitly delete by `manuscript_id` to avoid orphan rows (manuscript FK is `SET NULL`). |
| `document_generation_events` | none (`job_id` uuid column) | n/a | Delete | Explicitly delete by `job_id` before `evaluation_jobs` are deleted. |
| `llm_cost_events` | none (`manuscript_id` bigint / `evaluation_job_id` uuid) | n/a | Preserve / anonymize | Set `manuscript_id` and `evaluation_job_id` to NULL. |
| `revenue_events` | none (`manuscript_id` uuid / `job_id` uuid) | n/a | Preserve / anonymize | Set `manuscript_id` and `job_id` to NULL. |
| `free_diagnostic_claims` | `evaluation_jobs(id)` (`SET NULL`) / loose `manuscript_id` text | `ON DELETE SET NULL` | Preserve / anonymize | Set `manuscript_id` and `job_id` to NULL (keeps email/IP-hash fraud guard). |
| `audit_entries` | none (`job_id` uuid, nullable) | n/a | Preserve / anonymize | Set `job_id` to NULL. |
| `admin_actions` | `evaluation_jobs(id)` | `ON DELETE CASCADE` (column made nullable by migration) | Preserve / anonymize | Set `job_id` to NULL before deleting jobs. |
| `evaluation_support_access_log` | `evaluation_jobs(id)` | `ON DELETE CASCADE` (column made nullable by migration) | Preserve / anonymize | Set `evaluation_job_id` to NULL before deleting jobs. |

## Execution order inside the RPC

1. Anonymize financial/audit/fraud ledgers:
   - `llm_cost_events`
   - `revenue_events`
   - `audit_entries`
   - `admin_actions`
   - `evaluation_support_access_log`
   - `free_diagnostic_claims`
2. Delete operational generation events:
   - `document_generation_events`
3. Delete held-recovery children before their parents:
   - `held_recovery_reconstruction_work_items`
   - `held_recovery_retry_schedules`
   - `held_recovery_queue_items`
4. Delete revision events (manuscript `SET NULL` would orphan them):
   - `revision_events`
5. Delete evaluation jobs (cascades to most job-owned tables):
   - `evaluation_jobs`
6. Delete the manuscripts (cascades to remaining direct children):
   - `manuscripts`

## Notes

- `admin_actions` and `evaluation_support_access_log` columns were altered in the same migration to drop `NOT NULL` on the job reference. The FK action remains `CASCADE` for other callers; this RPC sets the reference to NULL before deleting the job, which preserves the audit row.
- `storygate_access_audit_events` already uses `SET NULL` on `listing_id`, so it survives listing deletion automatically.
- No table references `manuscripts` with `ON DELETE RESTRICT` or `NO ACTION` except `held_recovery_reconstruction_work_items` referencing `held_recovery_attempts`.
- Storage objects are removed best-effort after the DB transaction succeeds; storage cleanup is not atomic with the DB deletion.
