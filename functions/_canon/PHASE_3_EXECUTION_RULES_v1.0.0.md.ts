# PHASE 3 EXECUTION RULES v1.0.0

## Canonical Location
All Phase 3 canonical specifications reside in `functions/_canon/`.

## Exception Log

### 2026-01-08: Initial Canon Directory Creation
**Reason:** The `_canon/` directory did not exist prior to Phase 3 Function #1 implementation.

**Actions Taken:**
- Created `functions/_canon/` directory
- Migrated three canonical documents from `functions/canon/` to `functions/_canon/`:
  - `AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0.md`
  - `INDUSTRY_ENTITIES_v1.0.0.md`
  - `AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md`
- Retired old copies in `functions/canon/` (no longer authoritative)

**Justification:** This was necessary to establish a canonical location for Phase 3 specifications. Future canon modifications must follow the CCR (Canon Change Request) protocol.

---

## Change Control Rules

1. **No new canon documents** may be created without explicit CCR approval
2. **All canon modifications** require CCR entry with date, reason, and approval
3. **Canon retirement** must be logged with migration path documented
4. **Phase 3 functions** must reference canon versions in header comments