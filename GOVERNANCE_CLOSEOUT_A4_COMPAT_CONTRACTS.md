# Governance Closeout — A4 Compat Contracts

## Problem statement
CI failures were caused by evolving contracts across migration time (Postgres parameter renames, TypeScript boundary bleed between bundler and node16, and RPC signature ambiguity).

## Root cause
- Migration parameter rename via `CREATE OR REPLACE FUNCTION` (PostgreSQL SQLSTATE 42P13).
- TypeScript bundler vs node16 boundary violation (workers traversing `lib/` sources).
- RPC signature ambiguity under PostgREST named-arg resolution.

## Resolution
- Migrations 000010/000011 fixed to keep stable `c_*` compat parameters.
- Drop+create pattern formalized (000015/000016) for signature changes.
- Worker compilation boundary enforced (workers consume compiled JS; CI skips workers `tsc`).

## Governance rules (canonical)
1. **Fresh Database Rule**: Each migration must run cleanly from an empty DB. Use drop+create for signature changes.
2. **Immutable Public API Rule**: RPC signatures are immutable; use `c_*` compat wrappers + `p_*` canonical functions.
3. **Compilation Boundary Rule**: Workers consume compiled `.js`, not `.ts` sources; do not mix bundler and node16 in one config.
4. **Canonical Vocabulary Rule**: Enforce canonical enums/unions at write boundaries with runtime validation.

## Proof
- PR #9 merged (commit `f4f2b06`).
- PR #19 merged (commit `6ab9557`).
- Supabase-Backed Job Tests: passing.
- Job System Smoke Tests & Invariants: passing.

## Closure
This class of failure is considered resolved. Future violations are governance regressions.
