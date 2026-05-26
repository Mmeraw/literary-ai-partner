# Agent Readiness Workflow Doctrine

## Purpose

Agent Readiness Package™ is a manuscript-bound submission-preparation workflow. It is not a blank-page generator and it is not a one-click first action.

The author should always understand which manuscript the package belongs to before generating, reviewing, approving, exporting, or submitting any package material.

## Core Rule

**Top = manuscript. Middle = sections. Bottom = final package.**

This rule governs both the user interface and the mental model:

1. **Top: Selected Manuscript** — confirm the manuscript context first.
2. **Middle: Package Sections** — generate, edit, and approve the required materials.
3. **Bottom: Complete Package** — compile/export only after the section workflow is complete.

## Default Manuscript Behavior

When a user opens `/agent-readiness` directly, the page should default to the latest eligible completed manuscript evaluation.

Eligibility rules:

- Include completed/evaluation-ready manuscripts.
- Exclude failed evaluations.
- Exclude running evaluations.
- Exclude queued, canceled, or incomplete evaluations.
- Sort available manuscript choices by latest completed/evaluated date first.

If the user arrives from the dashboard with URL context, that context overrides the default:

```txt
/agent-readiness?manuscriptId=<id>&evaluationJobId=<id>
```

## Selected Manuscript Panel

The top workflow block should show manuscript context, not a package-generation CTA.

Required fields:

- Selected Manuscript
- Manuscript dropdown
- Latest Evaluation status
- Readiness Score, if available
- Package Status
- View Evaluation Report action

Example:

```txt
Selected Manuscript

[ Cartel Babies: Italics Removed ▾ ]

Latest Evaluation: Complete
Readiness Score: 8.4 / 10
Package Status: Not Started

[View Evaluation Report]
```

If no eligible completed manuscript exists, the page should explain that Agent Readiness requires a completed evaluation and should point the user back to Evaluate or Dashboard.

## Package Sections

The required section workflow currently includes:

1. Query Letter
2. What Makes This Novel Unique
3. Synopsis
4. Query Pitch
5. Comparables
6. Author Bio

Each section should be generated, edited, and approved in the context of the selected manuscript.

Section links/actions should carry manuscript context using `manuscriptId` and `evaluationJobId` where possible.

## Final Package Action

The final package action belongs below the required section cards.

Preferred labels:

- Generate Final Package
- Compile Complete Package

Avoid top-of-page language such as `Generate Complete Package` because it implies the first click creates the entire finished submission package before the author has reviewed the component sections.

When prerequisites are missing, the bottom action should be disabled with clear helper text:

```txt
Complete the required sections above before generating the final package.
```

## Export Rules

Export remains downstream of package preparation and approval.

Export actions may include:

- Download Editable DOCX
- Download Professional PDF
- Copy Query Package
- Save Package Version
- Submit to Storygate Studio™ when eligibility rules are satisfied

Export should not imply agent interest, representation, publication, sales, or market outcome.

## Package Status

Package status is manuscript-specific.

Expected states:

- Not Started
- Draft
- Approved
- Exported

Until persistent package records exist, UI may show `Not Started` as a placeholder, but this is a temporary seam. Future persistence should bind status to a package record associated with:

- user_id
- manuscript_id
- evaluation_job_id
- package_id

## Dashboard Entry Points

The dashboard may link users into Agent Readiness from completed evaluations.

Required URL shape:

```txt
/agent-readiness?manuscriptId=<id>&evaluationJobId=<id>
```

Dashboard entry points should not appear for failed, running, queued, canceled, or incomplete evaluations.

## Author Control

Agent Readiness prepares submission materials; it does not seize author control.

The author should be able to:

- confirm or change the selected manuscript
- review each generated section
- edit section content
- approve or defer sections
- decide when to compile/export the final package

Author Bio remains fact-governed: the system may shape author-supplied facts, but it must not invent credentials, awards, publications, education, platform, personal history, or expertise.

## Scope Boundaries

Current Agent Readiness scope is book/manuscript submission preparation.

Allowed current scope:

- manuscripts
- novels
- memoirs/serious nonfiction where supported
- query letters
- synopses
- author bios
- comparables
- manuscript positioning
- package readiness

Out of current public scope until implemented:

- film/TV adaptation packages
- screenplays
- screenplay conversion
- pitch decks
- novel-to-screenplay conversion
- chapter-to-scene conversion
- screen-project submission workflows

## Non-Promises

Agent Readiness does not guarantee:

- agent response
- representation
- publication
- sales
- market timing
- Storygate acceptance
- verified industry interest

It improves clarity, professionalism, package coherence, and submission readiness. It does not control external market response.
