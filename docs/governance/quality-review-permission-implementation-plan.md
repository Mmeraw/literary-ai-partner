# Quality Review Permission — Runtime Implementation Plan

**Policy authority:** `docs/governance/quality-review-permission-policy.md`  
**Related issue:** #1024  
**Purpose:** Convert the Quality Review Permission policy into a concrete implementation checklist.

## Goal

Implement one account-level Quality Review Permission setting and use it consistently across Evaluation, Revise Queue, TrustedPath, Final Review, admin/support review, and telemetry.

This document is an implementation plan only. It does not change runtime behavior.

## Required product behavior

Quality Review Permission must be managed in one place:

`Account Settings → Privacy → Quality Review Permission`

Evaluation and Revise pages should display status only. They should not create separate toggles.

## Implementation lane 1 — Data model

Add or confirm a durable account/user setting for Quality Review Permission.

Suggested field names:

- `quality_review_permission_enabled`
- `quality_review_permission_updated_at`
- `quality_review_permission_source`

The exact storage location should follow the existing user/account settings pattern in the repo.

## Implementation lane 2 — Account Settings UI

Add a Privacy section if one does not already exist.

Required control:

- label: `Quality Review Permission`
- type: toggle or checkbox
- default: off
- save behavior: explicit and auditable

Recommended copy:

`Allow RevisionGrade personnel to review my evaluation and revision artifacts for support, quality assurance, and system reliability.`

## Implementation lane 3 — Evaluation status display

Evaluation Report pages should display permission status only.

When off:

`Quality Review Permission: Off. RevisionGrade personnel cannot inspect this evaluation unless you enable permission or request support requiring access.`

When on:

`Quality Review Permission: On. Authorized RevisionGrade personnel may review this evaluation and related artifacts for support, quality assurance, and system reliability.`

## Implementation lane 4 — Revise Queue status display

Revise Queue pages should display permission status only.

When off:

`Quality Review Permission: Off. RevisionGrade personnel cannot inspect this Revise Queue unless you enable permission or request support requiring access.`

When on:

`Quality Review Permission: On. Authorized RevisionGrade personnel may review this Revise Queue and related revision artifacts for support, quality assurance, and system reliability.`

Do not add a Revise Queue toggle.

## Implementation lane 5 — Admin/support access guard

Any admin/support view that attempts to display manuscript prose, candidate prose, anchor prose, rationale prose, or surrounding context must check the permission before rendering content.

When permission is off, admin/support views may show only:

- reason codes,
- counts,
- gate statuses,
- operation names,
- model version,
- prompt version,
- timestamps,
- cost fields.

## Implementation lane 6 — Telemetry safety

Telemetry should remain content-free by default.

Allowed by default:

- reason codes,
- counts,
- gate statuses,
- operation names,
- model version,
- prompt version,
- timing,
- cost fields.

Not allowed by default:

- manuscript prose,
- candidate prose,
- anchor prose,
- rationale prose,
- surrounding manuscript context.

## Implementation lane 7 — Copy guard

Revise Queue must not use training-framed copy.

Forbidden phrases include:

- `Help train the model`
- `Allow AI training`
- `Improve our AI with your manuscript`
- `Share your manuscript for training`

## Acceptance tests

A runtime PR should prove:

1. the setting can be read and updated from Account Settings;
2. Evaluation pages display status only;
3. Revise Queue displays status only;
4. admin/support content access is gated;
5. telemetry remains content-free by default;
6. turning permission off does not block normal product use;
7. Revise Queue contains no training-framed copy.

## Suggested validation

Run targeted tests for settings, evaluation display, Revise Queue display, and admin/support guards, plus:

```bash
npx tsc --noEmit
```

## Non-goal

This plan does not implement the admin repair panel for hidden blocked Revise cards. That should remain a separate PR stream.
