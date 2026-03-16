# VOLUME III — OPERATIONAL SPECIFICATION

Status: CANONICAL — ACTIVE  
Version: 1.0  
Authority: Mike Meraw  
Depends on: Volume I, Volume II, Volume III (Platform Governance, Tools)  
Canon ID: VOL-III-OPS-1.0  
Governance: Doctrine Registry + Assembly Matrix  
Last Updated: 2026-03-09

---

## INTRODUCTION

Volume III (Operational Specification) defines the gates, thresholds, routing rules, and operational triggers that govern when and how canonical rules fire inside the RevisionGrade platform. This is the runtime specification—it answers the question: when does each rule actually execute?

This document bridges the gap between what the canon requires (Volumes I–II) and how it is implemented (Volume III Tools). It defines the operational behavior of the system.

---

## PART 1 — GATES AND THRESHOLDS

### 1.1 Submission Gates

**Gate S-1: Format Validation**
- Trigger: Manuscript upload
- Rule: Manuscript must be in accepted format (DOCX, PDF, TXT)
- Failure action: Reject with format error message
- No override permitted

**Gate S-2: Word Count Validation**
- Trigger: Post-format validation
- Rule: Manuscript must be between 20,000 and 200,000 words
- Failure action: Reject with word count error
- Override: Admin can expand range for specific genres

**Gate S-3: Genre Classification**
- Trigger: Post-word count validation
- Rule: System must classify manuscript genre
- Failure action: Queue for manual genre assignment
- Human review required if confidence below 70%

### 1.2 Evaluation Gates

**Gate E-1: Wave Sequence Integrity**
- Trigger: Before each wave execution
- Rule: Previous wave must be complete before next begins
- Failure action: Halt evaluation, log error
- No override permitted

**Gate E-2: Wave Output Validation**
- Trigger: After each wave produces output
- Rule: Output must conform to Wave Result Schema
- Failure action: Re-execute wave (max 2 retries)
- Escalate to human review after 2 failures

**Gate E-3: Confidence Threshold**
- Trigger: After each wave and criterion score
- Rule: If confidence is LOW, flag for human review
- Failure action: Score is provisional until human confirms
- Per Volume IV governance

**Gate E-4: Tsunami Aggregation Readiness**
- Trigger: Before tsunami computation
- Rule: All component waves must be complete with valid output
- Failure action: Cannot proceed to tsunami; escalate

**Gate E-5: Criteria Computation Readiness**
- Trigger: Before criterion scoring
- Rule: All required waves and tsunamis must be complete
- Failure action: Cannot proceed to criterion scoring; escalate

### 1.3 Output Gates

**Gate O-1: Report Completeness**
- Trigger: Before delivering evaluation report
- Rule: All 13 criteria must have scores and justifications
- Failure action: Hold report, flag for review

**Gate O-2: Eligibility Gate Computation**
- Trigger: After all criteria scores computed
- Rule: Compute eligibility gates per Volume II rules
- Automatic—no human intervention required

**Gate O-3: Delivery Authorization**
- Trigger: Before report delivered to user
- Rule: Report must pass completeness check
- Failure action: Queue for manual review

---

## PART 2 — ROUTING RULES

### 2.1 Standard Routing

Normal manuscript flow:
Submission → S-1 → S-2 → S-3 → WAVE Execution (W-01 through W-62) → Tsunami Aggregation (T-1 through T-6) → Criteria Scoring (C-01 through C-13) → Report Generation → Delivery

### 2.2 Exception Routing

**Low Confidence Path:**
When any score has LOW confidence → Flag for human review → Human confirms or adjusts → Resume standard routing

**Wave Failure Path:**
When wave fails validation → Retry (max 2) → If still failing → Escalate to human → Manual wave assessment or skip with documentation

**Resubmission Path:**
When author resubmits revised manuscript → Full re-evaluation → Delta report generation comparing versions

### 2.3 Priority Routing

- Standard: First-in, first-out queue
- Priority available for premium tier (future feature)
- Priority does not change evaluation methodology—only queue position
- No evaluation shortcuts for priority routing

---

## PART 3 — OPERATIONAL TRIGGERS

### 3.1 Automatic Triggers

- Manuscript upload triggers submission gates
- Successful submission triggers WAVE execution
- Wave completion triggers next wave
- All waves complete triggers tsunami aggregation
- All tsunamis complete triggers criteria scoring
- All criteria scored triggers report generation
- Report complete triggers delivery

### 3.2 Manual Triggers

- Admin can trigger re-evaluation of a manuscript
- Admin can trigger manual review of flagged scores
- User can trigger resubmission (new version)
- Admin can halt evaluation pipeline for a specific manuscript

### 3.3 Scheduled Triggers

- Daily: Audit log review
- Weekly: Confidence calibration check
- Monthly: Model performance review
- Quarterly: Canon compliance audit

---

## PART 4 — OPERATIONAL DOCTRINES

### Doctrine: Gate Integrity
No gate may be bypassed, skipped, or overridden except through documented exception paths. Every gate failure must be logged.

### Doctrine: Sequential Execution
The evaluation pipeline is strictly sequential. No parallel execution of waves. No out-of-order processing.

### Doctrine: Routing Transparency
Every routing decision must be logged with the rule that triggered it. Users can request their evaluation routing history.

### Doctrine: Trigger Immutability
Automatic triggers cannot be modified at runtime. Changes to trigger logic require canon revision.

### Doctrine: Exception Documentation
Every exception path execution must be documented with the reason, the resolution, and the impact on the evaluation.

---

*End of Volume III — Operational Specification*
