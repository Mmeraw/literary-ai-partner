# Revise Blocked-Card Quarantine Policy

**Scope:** Revise Queue, Workbench, TrustedPath, Final Review, admin review, and Revise telemetry.  
**Related issue:** #1024  
**Status:** Policy authority for future implementation.

## Purpose

Blocked Revise cards must never be shown to normal users, but the system also should not destroy all diagnostic evidence needed to understand why candidate prose failed.

This policy defines how RevisionGrade should treat blocked Revise candidates after quality, grounding, canon, voice, hydration, or admission failure.

## Core rule

A blocked Revise card is not user inventory.

A blocked card may be:

- regenerated and re-tested,
- retained in a non-user-facing quarantine state,
- reviewed through an authorized admin/support path,
- or discarded.

It must never be surfaced to preserve queue count.

## User-facing behavior

Normal users may see only cards that pass the user-facing admission contract.

Normal users must not see:

- blocked cards,
- rejected candidates,
- internal reason-code inventories,
- hidden queue counts framed as missing work,
- model or prompt failure details,
- debug state names,
- or raw failed candidate prose.

The user-facing queue should remain supported-only and premium-feeling.

## Quarantine behavior

When a card is blocked, the runtime should distinguish between:

1. user-facing card payload, and
2. internal blocked-card diagnostic record.

The user-facing payload should omit blocked candidate prose.

The internal diagnostic record may retain candidate text only when permitted by the product's access and privacy rules. When text retention is not permitted, the system should retain reason codes, counts, gate statuses, model/prompt version, and operation metadata only.

## Recommended status model

Future implementation should avoid treating empty candidate fields as the only signal that a card is blocked.

Recommended fields or equivalents:

- `candidate_status`: `passed | blocked | quarantined | regenerated | discarded`
- `quarantine_reason_codes`: string array
- `regeneration_attempt_count`: number
- `last_regeneration_status`: `not_attempted | succeeded | failed`
- `admin_review_eligible`: boolean
- `user_visible`: boolean

The exact schema can differ, but the product distinction must remain clear:

- blocked/quarantined is internal,
- admitted/supported is user-facing.

## Admin/support behavior

Admin/support tooling should first show privacy-safe diagnostics:

- criterion,
- severity,
- revision operation,
- gate that failed,
- reason codes,
- candidate pass count,
- regeneration attempt count,
- model version,
- prompt version.

Candidate prose, anchor text, surrounding manuscript context, or rationale text should be shown only through the authorized review path defined by the product privacy model.

## Regeneration behavior

Quarantine should not become a graveyard.

When a blocked card is grounded and context-valid but candidate prose fails quality, the preferred next action is regeneration.

Regenerated cards must pass the same gates as first-generation cards:

- grounding,
- preflight,
- candidate quality,
- voice,
- canon,
- admission.

A regenerated card becomes user-visible only after passing the full admission contract.

## Telemetry behavior

Default telemetry should be content-free.

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

## Acceptance criteria for implementation

A future code PR implementing this policy must prove:

1. normal user payloads cannot include blocked candidate prose;
2. blocked cards retain enough diagnostic signal for root-cause analysis;
3. admin/support views show content only through the authorized review path;
4. regeneration does not bypass quality/admission gates;
5. telemetry remains reason-code based by default;
6. queue counts remain supported-only for normal users.

## Non-goal

This policy does not implement the admin repair UI. It defines the product and data-handling rules that the admin repair UI must obey.
