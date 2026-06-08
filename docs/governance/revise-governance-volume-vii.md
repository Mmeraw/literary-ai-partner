# Volume VII — Revision Governance Authority

**Authority:** Revision Governance Volume VII  
**Scope:** Revision generation, revision admission, revision presentation, TrustedPath execution, Final Review, revision exports, and revision telemetry.  
**Binding rule:** RevisionGrade shall never present a revision opportunity to a user unless the opportunity satisfies this authority and all subordinate Revise standards.

Revision quality is judged by evidence, manuscript context, continuity preservation, voice preservation, canon preservation, and execution readiness. Revision opportunities are recommendations for improvement, not commands. Final authority remains with the author.

## RG-VII-1 Author Sovereignty
RevisionGrade may recommend changes. RevisionGrade may never overwrite manuscript content, force revisions, silently alter manuscript text, modify author voice without permission, or modify canon without permission.

## RG-VII-2 No Unsupported Revision Doctrine
A revision opportunity may not be shown unless sufficient evidence exists.

Minimum requirements:
- Source evidence located
- Target passage identified
- Revision objective identified
- Context established

Failure code: `UNSUPPORTED_REVISION`  
Outcome: blocked and hidden from normal users.

## RG-VII-3 Context Sufficiency Doctrine
Every revision opportunity must include enough manuscript context to support intelligent revision generation.

Required:
- Anchor
- Surrounding context
- Criterion
- Revision objective

Failure code: `CONTEXT_INSUFFICIENT`  
Outcome: blocked.

## RG-VII-4 Voice Preservation Doctrine
RevisionGrade must preserve narrative voice, POV, tense, character knowledge, character vocabulary, speech pattern, and narrative rhythm. A revision may improve clarity. It may never replace author identity with model identity.

Failure code: `VOICE_DRIFT`  
Outcome: blocked.

## RG-VII-5 Canon Preservation Doctrine
RevisionGrade must preserve character identity, timeline, location, relationships, world rules, and established facts.

Failure code: `CANON_DRIFT`  
Outcome: blocked.

## RG-VII-6 Revision Quality Doctrine
A revision must satisfy relevance, context awareness, continuity, voice fidelity, and execution readiness.

Failure code: `REVISION_QUALITY_FAILED`  
Outcome: blocked.

## RG-VII-7 Anti-Generic Prose Doctrine
RevisionGrade shall reject prose that demonstrates generic literary filler patterns, including but not limited to:
- the silence stretched
- the air grew heavy
- something shifted
- the room seemed smaller
- the moment settled
- he looked away first
- the moment claimed its price

Failure code: `GENERIC_PROSE`  
Outcome: blocked.

## RG-VII-8 Anti-Summary Doctrine
Revision opportunities must generate manuscript prose. They must not generate criticism, analysis, editorial commentary, writing advice, explanations, or summaries masquerading as prose.

Failure code: `NON_EXECUTABLE_PROSE`  
Outcome: blocked.

## RG-VII-9 Executability Doctrine
A revision candidate must be copy-paste ready. The user must be capable of inserting the candidate into the manuscript immediately.

Failure code: `NOT_EXECUTABLE`  
Outcome: blocked.

## RG-VII-10 TrustedPath Doctrine
TrustedPath may consume only opportunities that are supported, context sufficient, voice-preserved, canon-preserved, quality-passed, and executable.

## RG-VII-11 Final Review Doctrine
Final Review shall evaluate only revision opportunities eligible for author adoption. Blocked opportunities shall not participate.

## RG-VII-12 User Visibility Doctrine
Normal users shall never see rejected opportunities, blocked opportunities, unsupported opportunities, internal diagnostics, hydration failures, prompt failures, or model failures. Users shall see only supported revision opportunities.

## RG-VII-13 Administrative Review Doctrine
Administrative review exists solely for quality improvement, model evaluation, system diagnostics, and governance auditing. It is not author-facing and must respect privacy permissions.

## RG-VII-14 Telemetry Doctrine
Telemetry may store reason codes, criterion, severity, operation, quality scores, failure counts, model version, and prompt version. Telemetry shall not store manuscript content unless explicit permission exists.

## RG-VII-15 Regeneration Doctrine
When a revision candidate fails, RevisionGrade must attempt controlled regeneration, validate the regenerated candidates, and re-score them. If all attempts fail, the opportunity is withheld. Poor-quality revisions must never be surfaced merely to preserve card counts.

## RG-VII-16 Premium Standard Doctrine
RevisionGrade prioritizes revision quality over revision quantity. Seven excellent revisions are superior to seventy mediocre revisions. No revision shall be surfaced solely because a recommendation existed in the evaluation; the revision must independently earn admission.
