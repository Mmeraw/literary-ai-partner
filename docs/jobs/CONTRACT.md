# Job System Immutable Contracts

This document outlines the immutable contracts for the job system to prevent "helpful" refactors from breaking async semantics.

## Contracts

- **run-phase1 must be fire-and-forget (no await on worker)**: The phase1 runner should initiate the job without waiting for its completion, allowing asynchronous processing.

- **Status transition rules**: Jobs follow the state machine: `queued` → `running` → `complete` | `failed`. Transitions must adhere to this sequence.

- **Canonical GET response shape**: All GET endpoints for jobs must return an object in the shape `{ job }`.

- **All mutations must go through updateJob**: Any changes to job state or data must be performed via the `updateJob` function to ensure consistency and integrity.

## Mutation Rules

- **No direct job mutation anywhere**: Do not use `job.status =` or similar direct mutations on job objects.
- **Only updateJob may mutate jobs**: All job updates must go through the `updateJob` function.
- **run-phase1 must remain fire-and-forget**: Ensure that phase1 execution does not block and maintains asynchronous behavior.