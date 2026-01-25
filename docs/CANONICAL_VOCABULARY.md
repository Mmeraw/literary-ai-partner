# Canonical Vocabulary Governance (CANON)

## Principle
One concept = one canonical key name in storage. All other variants are banned aliases.

## Canonical Terms Map

| Domain | Canonical Key | Banned Aliases | Enforcement Scope |
| :--- | :--- | :--- | :--- |
| **Ownership** | `user_id` | `owner_id`, `created_by` (if same), `author_id` | DB, RLS, Types |
| **Job Status** | `status` | `state`, `stage`, `job_state` | DB, UI (succeeded) |
| **Job Phase** | `phase` | `stage`, `p1`, `p2`, `phase1`, `phase2` | DB, TS Enums |
| **Phase Status** | `phase_status` | `status`, `complete`, `done`, `error` | DB, Progress JSON |
| **Manuscript** | `manuscript_id` | `document_id`, `work_id`, `doc_id` | DB, FKs |
| **Chunk Index** | `chunk_index` | `index`, `chunk_number`, `chunkNo` | DB, Functions |
| **Time (Start)** | `started_at` | `start_time`, `time_started` | DB, Heartbeat |
| **Time (End)** | `completed_at` | `finished_at`, `end_time`, `done_at` | DB, Succeeded |

## Storage vs Display Rules
- **Storage (DB/TS):** Must use Canonical Key.
- **Display (UI/Logs):** May use labels (e.g., "Done", "Phase 1"), but must map 1:1 to Canonical Key.

## RLS Contract
- All user-owned tables MUST use `user_id` (UUID).
- RLS policies MUST reference `auth.uid() = user_id`.

## Verification Gate
- CI scripts must grep for Banned Aliases and fail on match.
