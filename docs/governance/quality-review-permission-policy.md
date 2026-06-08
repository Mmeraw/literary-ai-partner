# Quality Review Permission Policy

**Scope:** Evaluation Reports, Revise Queue, TrustedPath, Final Review, support review, quality review, and admin diagnostics.  
**Related issue:** #1024  
**Status:** Policy authority for future implementation.

## Purpose

RevisionGrade needs one clear permission model for when authorized personnel may inspect manuscript-related artifacts.

The product should not scatter separate toggles across Evaluation, Revise Queue, TrustedPath, or Final Review. It should use one account-level setting: **Quality Review Permission**.

## Core rule

Quality Review Permission is the single user-controlled setting for support and quality review access to manuscript-related artifacts.

It governs:

- uploaded manuscript content,
- Evaluation Reports,
- evaluation artifacts,
- Revise Queue artifacts,
- blocked-card diagnostics,
- TrustedPath artifacts,
- Final Review artifacts,
- support investigations,
- quality assurance investigations,
- governance audits.

## Permission off

When Quality Review Permission is off:

- authorized personnel cannot inspect manuscript prose through normal admin/support tooling;
- authorized personnel cannot inspect revision candidate prose through normal admin/support tooling;
- blocked-card diagnostics should remain reason-code and count based;
- telemetry should remain content-free;
- support investigations that require content review must ask the author to enable permission or provide explicit case-specific authorization.

## Permission on

When Quality Review Permission is on:

Authorized personnel may inspect relevant evaluation and revision artifacts for:

- support,
- quality assurance,
- system reliability,
- product debugging,
- governance auditing.

This permission does not transfer ownership of manuscript content. The author remains the owner and final authority.

## User-facing placement

### Account Settings

Account Settings is the only place where the permission should be changed.

Recommended path:

`Account Settings → Privacy → Quality Review Permission`

Recommended toggle label:

`Allow RevisionGrade personnel to review my evaluation and revision artifacts for support, quality assurance, and system reliability.`

### Evaluation Report

Evaluation Reports should display permission status only.

They should not contain a separate toggle.

Recommended status copy when off:

`Quality Review Permission: Off. RevisionGrade personnel cannot inspect this evaluation unless you enable permission or request support requiring access.`

Recommended status copy when on:

`Quality Review Permission: On. Authorized RevisionGrade personnel may review this evaluation and related artifacts for support, quality assurance, and system reliability.`

### Revise Queue

Revise Queue should display permission status only.

It should not contain a separate toggle.

Recommended status copy when off:

`Quality Review Permission: Off. RevisionGrade personnel cannot inspect this Revise Queue unless you enable permission or request support requiring access.`

Recommended status copy when on:

`Quality Review Permission: On. Authorized RevisionGrade personnel may review this Revise Queue and related revision artifacts for support, quality assurance, and system reliability.`

## Prohibited Revise Queue framing

The Revise Queue should not ask authors to help train the model.

Avoid phrases such as:

- `Help train the model`
- `Allow AI training`
- `Improve our AI with your manuscript`
- `Share your manuscript for training`

The Revise Queue should feel premium, private, and author-controlled.

## Admin/support behavior

Admin/support tooling should check Quality Review Permission before displaying manuscript prose, revision candidate prose, anchor text, surrounding manuscript context, or rationale text.

When permission is off, admin/support tooling may show only privacy-safe diagnostics such as:

- reason codes,
- counts,
- gate statuses,
- operation names,
- model version,
- prompt version,
- timestamps,
- cost fields.

## Telemetry behavior

Telemetry is content-free by default.

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
- revision candidate prose,
- anchor prose,
- rationale prose,
- surrounding manuscript context.

## Revocation

Authors may turn Quality Review Permission off at any time.

After revocation:

- future admin/support access should return to content-free diagnostics;
- normal product operation should continue;
- author ownership and manuscript rights remain unchanged.

## Acceptance criteria for implementation

A future runtime PR implementing this policy must prove:

1. the permission is managed in one account-level location;
2. Evaluation Report and Revise Queue display status only;
3. admin/support prose access checks the permission;
4. telemetry remains content-free by default;
5. no Revise Queue copy implies model training on the author's manuscript;
6. turning permission off does not affect the author's ability to use the product.
