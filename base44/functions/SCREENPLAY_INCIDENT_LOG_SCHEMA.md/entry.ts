# INCIDENT LOG SCHEMA — SCREENPLAY MODE

**Status:** QA + AUDIT + LEARNING SYSTEM

**Purpose:** Record violations, capture root cause, prevent repeat failures, create accountability without blame.

Base44 must:
- Log every violation
- Never silently "fix and ship"
- Use incidents to harden the system

This stops the same bad screenplay from happening again in 3 weeks.

---

## INCIDENT LOG STRUCTURE

### Core Identifiers

```json
{
  "incident_id": "unique-uuid",
  "timestamp": "2026-01-03T10:45:23Z",
  "user_request_id": "req_abc123",
  "model_version": "gpt-4o",
  "formatter_version": "formatScreenplay-v2.1",
  "mode": "screenplay | prose-adaptation"
}
```

### Location Reference

```json
{
  "scene_reference": "EXT. HIGHWAY – DAY",
  "page_reference": 12,
  "line_number": 45
}
```

### Violation Classification

```json
{
  "violation_type": "#slugline-format | #char-intro-missed | #action-bloat | #emdash-wrong | #sound-inconsistent | #dialogue-spacing | #hyphen-glitch | #titlepage-embedded | #mode-mismatch",
  "severity": "HARD_FAIL | SOFT_WARN"
}
```

### Detection Context

```json
{
  "trigger": "pre-generation-validator | post-generation-validator | qa-manual-review | user-report",
  "validator_name": "sluglineRegexCheck",
  "validation_pass": false
}
```

### Violation Details

```json
{
  "description": "Slugline missing INT./EXT. prefix",
  "expected": "EXT. HIGHWAY – DAY",
  "actual": "HIGHWAY – DAY",
  "excerpt": "...surrounding text context..."
}
```

### Root Cause Analysis

```json
{
  "root_cause": "mode-routing-error | formatter-regression | model-hallucination | validator-gap | human-override",
  "explanation": "Model generated prose-style paragraph breaks in screenplay mode"
}
```

### Resolution

```json
{
  "resolution_action": "auto-corrected | blocked-output | manual-fix | validator-updated",
  "resolution_timestamp": "2026-01-03T11:00:00Z",
  "corrected_output": "EXT. HIGHWAY – DAY"
}
```

### Preventive Action

```json
{
  "preventive_action": "Added pre-generation mode lock to prevent prose formatting in screenplay tasks",
  "guardrail_updated": "sluglineValidator-v1.1",
  "deployment_date": "2026-01-03"
}
```

### Status Tracking

```json
{
  "status": "open | resolved | closed",
  "owner": "engineering | qa | product",
  "assigned_to": "jane.doe@base44.com"
}
```

---

## CANONICAL VIOLATION TYPES

| Incident Code | Description | Severity |
|---------------|-------------|----------|
| `#titlepage-embedded` | Title page inside script body | HARD_FAIL |
| `#slugline-format` | Incorrect slugline format | HARD_FAIL |
| `#char-intro-missed` | Character not capped on first appearance | HARD_FAIL |
| `#action-bloat` | Action paragraphs exceed 5 lines | SOFT_WARN |
| `#emdash-wrong` | Em dash has spaces or wrong character | SOFT_WARN |
| `#sound-inconsistent` | Multiple sound cue styles used | HARD_FAIL |
| `#dialogue-spacing` | Blank line between name and dialogue | HARD_FAIL |
| `#hyphen-glitch` | Non-standard hyphen breaks export | SOFT_WARN |
| `#mode-mismatch` | Prose formatting in screenplay mode | HARD_FAIL |

---

## USAGE EXAMPLES

### Example 1: Slugline Format Violation

```json
{
  "incident_id": "inc_001",
  "timestamp": "2026-01-03T10:45:23Z",
  "violation_type": "#slugline-format",
  "severity": "HARD_FAIL",
  "trigger": "post-generation-validator",
  "expected": "EXT. HIGHWAY – DAY",
  "actual": "HIGHWAY - DAY",
  "root_cause": "model-hallucination",
  "resolution_action": "blocked-output",
  "status": "resolved"
}
```

### Example 2: Action Bloat Warning

```json
{
  "incident_id": "inc_002",
  "timestamp": "2026-01-03T11:15:00Z",
  "violation_type": "#action-bloat",
  "severity": "SOFT_WARN",
  "trigger": "post-generation-validator",
  "description": "Action paragraph 8 lines long",
  "root_cause": "formatter-regression",
  "resolution_action": "manual-fix",
  "preventive_action": "Added paragraph length validator to pre-generation",
  "status": "closed"
}
```

---

## ESCALATION RULES

1. **HARD_FAIL incidents** must be resolved before delivery
2. **SOFT_WARN incidents** can be delivered if logged
3. **Repeated SOFT_WARN** (3+ same type) escalates to HARD_FAIL
4. **Unresolved incidents** block deployment

---

## REPORTING

Incident logs feed into:
- Weekly QA review meetings
- Monthly engineering retrospectives
- Validator improvement roadmap
- Model fine-tuning datasets

---

**Version:** 1.0  
**Status:** BINDING QA + AUDIT STANDARD  
**Authority:** All violations must be logged; no silent fixes