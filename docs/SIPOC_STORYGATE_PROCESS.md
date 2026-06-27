# Storygate Studio SIPOC/FIPOC Process Constitution

> **Status:** Registry-described, partial, not fully SIPOC-enforced  
> **Primary authority:** `docs/storygate/STORYGATE_STUDIO_CANON.md`  
> **Executable registry:** `lib/storygate/storygateRegistry.ts`  
> **CSV mirrors:** `docs/registries/storygate/*.csv`  
> **Last updated:** 2026-06-27

Storygate Studio is the controlled-access layer for readiness-vetted manuscript projects and verified publishing professionals.

This SIPOC/FIPOC is derived from current Storygate Studio canon, not Base44. Base44 Storygate files are legacy reference only and must not be treated as binding authority.

---

## Canonical Rules

1. **Storygate Studio admission threshold is 9.0 / 10.**
2. RevisionGrade readiness and Storygate Studio admission are separate gates.
3. Market Comparables are required in the Storygate package.
4. Market Category is required in the Storygate package.
5. Target Audience and Market Position Statement are required in the Storygate package.
6. Current Storygate scope is manuscript-first and publishing-facing.
7. Film, screen, screenplay, adaptation, deck, treatment, producer-facing, and film-rights-marketplace requirements are excluded from current scope.
8. Access is verified, creator/admin approved, controlled, and append-only logged.
9. Storygate is registry-described, not fully SIPOC-enforced.
10. Storygate downstream package intake may consume certified `agent_readiness_package_v1` or equivalent professional materials only.
11. Storygate must not consume Web/PDF/DOCX/TXT renderer output or `evaluation_report_view_model_v1` as package authority.
12. Storygate must not treat uncertified Agent Readiness output, AR08 export gaps, or AR09 package-history gaps as resolved.

---

## Required Storygate Package

- Query Letter
- Synopsis
- Author Bio
- Elevator Pitch
- Agent Pitch
- Market Comparables
- Market Category
- Target Audience
- Market Position Statement
- Sample Pages
- Rights Declaration

Equivalent professional materials may satisfy package quality. Buying RevisionGrade services is not required. Certified Agent Readiness output may be used as a base, but it must be supplemented with every required Storygate field before Storygate package verification can pass. Storygate must not accept renderer/download output, `evaluation_report_view_model_v1`, uncertified Agent Readiness output, or stale claims that Agent Readiness AR08/AR09 gaps are resolved as package authority.

---

## Process Spine

```text
SG01 Creator Submission
  → SG02 Intake Validation
  → SG03 Internal Screening
  → SG04 Tier Assignment
  → SG05 Package Verification
  → SG06 Readiness Verification
  → SG07 Industry Verification
  → SG08 Listing Activation
  → SG09 Access Request
  → SG10 Creator/Admin Approval
  → SG11 Controlled Access
  → SG12 Access Logging & Revocation
```

Industry verification occurs before access request. Package verification and readiness verification occur before listing activation. Access logging must operate throughout access request, approval, controlled viewing, and revocation.

---

## Stage Summary

| Seq | Stage | Name | Status | Notes |
|-----|-------|------|--------|-------|
| 1 | `SG01_CREATOR_SUBMISSION` | Creator Submission Entry | partial / gap | Current app surfaces describe preparation; durable current-canon submission path not proven |
| 2 | `SG02_INTAKE_VALIDATION` | Submission Intake Validation | partial / gap | Current-canon validator exists; durable submission route/database persistence remains a gap |
| 3 | `SG03_INTERNAL_SCREENING` | Internal Screening | missing-critical | Must enforce current scope and 9.0 threshold |
| 4 | `SG04_TIER_ASSIGNMENT` | Tier Assignment | missing-critical | Persisted tier/audit evidence not proven |
| 5 | `SG05_PACKAGE_VERIFICATION` | Professional Package Verification | partial / gap | Package requires Market Comparables, Market Category, Target Audience, Market Position Statement, and Rights Declaration |
| 6 | `SG06_READINESS_VERIFICATION` | Storygate Readiness Verification | partial / gap | Admission threshold locked to 9.0 / 10 |
| 7 | `SG07_INDUSTRY_VERIFICATION` | Industry Verification Gate | missing-critical | Server-side verification persistence/audit not proven |
| 8 | `SG08_LISTING_ACTIVATION` | Storygate Listing Activation | missing-critical | Current-canon activation route/persistence not proven |
| 9 | `SG09_ACCESS_REQUEST` | Industry Access Request | missing-critical | No concrete current route/persistence proven |
| 10 | `SG10_CREATOR_ADMIN_APPROVAL` | Creator/Admin Access Approval | missing-critical | Core protection; approval persistence not proven |
| 11 | `SG11_CONTROLLED_ACCESS` | Controlled Access and Viewing | missing-critical | Controlled view authorization not proven |
| 12 | `SG12_ACCESS_LOGGING_REVOCATION` | Access Logging, Audit, and Revocation | missing-critical | Structured audit and revocation persistence not proven |

---

## SIPOC / FIPOC Contracts

| Element | Contract |
|---------|----------|
| Suppliers | creator/author, certified Agent Readiness package, equivalent professional package, internal reviewer, publishing professional, creator/admin approver, audit logger |
| Inputs | certified `agent_readiness_package_v1` or equivalent professional manuscript package, readiness evidence, rights declaration, verification request, access request |
| Process | validate package, screen, assign tier, verify package, verify 9.0 readiness, verify professional, activate listing, request access, approve/deny, control access, log/revoke |
| Outputs | submission request, validation result, screening result, tier assignment, package verification result, eligibility result, verification record, listing, access request, access grant, access log, revocation record |
| Customers | creator/author, verified publishing professional, admin/governance reviewer |
| Feedback/Kicks | missing fields, missing Market Comparables, missing market category, missing target audience, missing market position statement, missing rights, invalid package authority, below 9.0 threshold, unverified professional, unauthorized approval, missing grant, artifact outside scope, missing audit |

---

## Authority Sources

| Authority | Level | Use |
|-----------|-------|-----|
| `docs/storygate/STORYGATE_STUDIO_CANON.md` | binding | Primary current Storygate Studio canon |
| `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md` | binding | Authority-order doctrine for certified artifact handoff and renderer/ViewModel boundaries |
| `docs/SIPOC_AGENT_READINESS_PROCESS.md` | binding | Certified Agent Readiness package boundary and unresolved AR08/AR09 gap state |
| `docs/SIPOC_STORYGATE_PROCESS.md` | binding | Process constitution |
| `lib/storygate/storygateRegistry.ts` | binding executable registry | Machine-readable registry |
| `docs/SYSTEM_FACTORY_MAP.md` | secondary | Cross-factory summary |
| `app/storygate-studio/**` | runtime reference | Current public/runtime copy |
| `base44/**` | legacy_reference_only | Historical context only, not binding |
| `archive/base44-export/**` | legacy_reference_only | Historical context only, not binding |

---

## CSV Mirrors

| CSV | Purpose |
|-----|---------|
| `storygate_process_registry.csv` | stage spine, certification, fit/gap status |
| `storygate_artifact_registry.csv` | artifact producer/consumer ownership |
| `storygate_field_registry.csv` | field contracts, enums, validator ownership |
| `storygate_kick_matrix.csv` | blocking failures and remediation |
| `storygate_authority_source_registry.csv` | authority hierarchy and Base44 legacy lock |
| `storygate_renderer_matrix.csv` | app/route consumer surfaces |
| `storygate_certification_gate_registry.csv` | certification gates and missing enforcement |
| `storygate_threshold_registry.csv` | 9.0 Storygate admission contract |

---

## Still-Valid Storygate Documents

Use as current authority:

- `docs/storygate/STORYGATE_STUDIO_CANON.md`
- `docs/SIPOC_ARTIFACT_AUTHORITY_CHAIN.md`
- `docs/SIPOC_AGENT_READINESS_PROCESS.md`
- `docs/SIPOC_STORYGATE_PROCESS.md`
- `lib/storygate/storygateRegistry.ts`
- `docs/registries/storygate/*.csv`
- `__tests__/lib/storygate/storygateRegistry.test.ts`
- `docs/SYSTEM_FACTORY_MAP.md` as a secondary cross-factory summary

Use as runtime/UI reference:

- `app/storygate-studio/**`
- `components/storygate/**`

Do not use as binding authority:

- `base44/**`
- `archive/base44-export/**`

---

## Certification Boundary

Storygate SIPOC/FIPOC is valid governance infrastructure, but Storygate is not production-certified or fully SIPOC-enforced until current runtime implements/proves every missing-critical stage. The package-authority boundary is registry/test-enforced architecture only in this patch; it does not implement missing Storygate runtime behavior or resolve Agent Readiness AR08/AR09 gaps.
