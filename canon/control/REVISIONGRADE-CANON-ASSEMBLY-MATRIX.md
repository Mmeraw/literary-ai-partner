# REVISIONGRADE CANON — ASSEMBLY MATRIX

Status: CANONICAL — ACTIVE  
Version: 1.0  
Authority: Mike Meraw  
Canon ID: CTRL-ASSEMBLY-MTX-1.0  
Governance: Self-governing document  
Last Updated: 2026-03-09

---

## PURPOSE

The Assembly Matrix shows how the canonical components assemble into functional systems. It is the wiring diagram of the canon—it shows which volumes feed which systems, which doctrines govern which operations, and how everything connects.

Where the Doctrine Registry indexes what exists, the Assembly Matrix shows how everything works together.

---

## PART 1 — VOLUME DEPENDENCY MAP

```
Volume I (WAVE) → feeds → Volume II (Criteria)
Volume II (Criteria) → feeds → Volume III-PG (Governance)
Volume III-PG → constrains → Volume III-TI (Tools)
Volume III-TI → implements → Volume III-OS (Ops)
Volume III-OS → executes via → Volume V (Architecture)
Volume IV (AI Gov) → constrains → ALL volumes
Volume V (Architecture) → hosts → ALL volumes
```

### Reading Order for New Users:
1. Volume III-PG (understand what the platform is)
2. Volume I (understand the WAVE methodology)
3. Volume II (understand how manuscripts are evaluated)
4. Volume IV (understand AI governance)
5. Volume III-TI (understand how it’s built)
6. Volume III-OS (understand how it operates)
7. Volume V (understand how it deploys)

---

## PART 2 — EVALUATION PIPELINE ASSEMBLY

### Stage 1: Manuscript Intake
- **Governed by:** Volume III-OS (Gates S-1, S-2, S-3)
- **Implemented by:** Volume III-TI (Input Adapters)
- **Platform rules:** Volume III-PG (User Rights, Submission)
- **AI role:** Genre classification (Volume IV Level 2)

### Stage 2: Wave Execution (W-01 through W-62)
- **Methodology:** Volume I (Wave Groups 1–6)
- **Governed by:** Volume III-OS (Gates E-1, E-2, E-3)
- **Implemented by:** Volume III-TI (Wave Evaluator, Diagnostic Prompts)
- **AI constraints:** Volume IV (Level 1 autonomous, confidence flagging)

### Stage 3: Tsunami Aggregation (T-1 through T-6)
- **Methodology:** Volume I (Tsunami Categories)
- **Governed by:** Volume III-OS (Gate E-4)
- **Implemented by:** Volume III-TI (Tsunami Evaluator, Aggregation Prompts)
- **AI constraints:** Volume IV (Level 1 autonomous)

### Stage 4: Criteria Scoring (C-01 through C-13)
- **Methodology:** Volume II (13 Core Criteria, Scoring Model)
- **Governed by:** Volume III-OS (Gates E-3, E-5)
- **Implemented by:** Volume III-TI (Criteria Evaluator, Evaluation Prompts)
- **AI constraints:** Volume IV (Level 1 for high confidence, Level 2 for low confidence)

### Stage 5: Report Generation
- **Output format:** Volume II (Eligibility Gates)
- **Governed by:** Volume III-OS (Gates O-1, O-2, O-3)
- **Implemented by:** Volume III-TI (Output Adapters, Report Generator)
- **Platform rules:** Volume III-PG (User Rights, Transparency)

---

## PART 3 — DOCTRINE-TO-SYSTEM MAPPING

### Wave System Governance
- D-I-01 (Wave Sequence Immutability) → Wave Evaluator
- D-I-02 (Wave Output Immutability) → Wave Evaluator, Database
- D-I-03 (Score Justification) → All evaluators, All prompts
- D-I-04 (No Manual Override) → UI, API, Admin console
- D-I-05 (Tsunami Dependency) → Tsunami Evaluator, Gate E-4

### Evaluation System Governance
- D-II-01 (Criterion Immutability) → Criteria Evaluator, Schema
- D-II-02 (Score Justification) → Criteria Evaluator, Prompts
- D-II-03 (AI Scoring Limits) → AI integration layer
- D-II-04 (No Criterion Override) → Gate O-2, Eligibility computation

### Platform Governance System
- D-III-01 through D-III-05 → Product decisions, Feature development
- D-III-06 through D-III-10 → Engineering, Architecture decisions
- D-III-11 through D-III-15 → Pipeline implementation, Operations

### AI System Governance
- D-IV-01 through D-IV-06 → All AI-touching systems
- D-IV-04 (Canon Read-Only) → File permissions, Access controls
- D-IV-05 (Session Isolation) → AI session management
- D-IV-06 (Audit Everything) → Logging infrastructure

### Infrastructure Governance
- D-V-01 through D-V-05 → DevOps, Deployment, Monitoring

---

## PART 4 — CONFLICT RESOLUTION MATRIX

When two doctrines appear to conflict, use this resolution hierarchy:

1. **Volume IV (AI Governance)** — overrides all others for AI behavior
2. **Volume III-PG (Platform Governance)** — overrides implementation details
3. **Volume II (Criteria)** — overrides Volume I specifics for scoring
4. **Volume I (WAVE)** — governs wave execution details
5. **Volume III-TI and III-OS** — implementation follows, doesn’t govern
6. **Volume V** — infrastructure follows, doesn’t govern

If genuine conflict exists after applying this hierarchy, escalate to Doctrine Registry for formal resolution and documentation.

---

## PART 5 — CANON CHANGE IMPACT ASSESSMENT

Before any canon modification, assess impact using this matrix:

| Volume Changed | Volumes Affected | Systems Affected |
|---|---|---|
| Volume I | II, III-TI, III-OS | Wave Evaluator, Prompts, Pipeline |
| Volume II | I, III-TI, III-OS | Criteria Evaluator, Prompts, Gates |
| Volume III-PG | All | All platform features |
| Volume III-TI | III-OS, V | Implementation, Deployment |
| Volume III-OS | V | Pipeline, Infrastructure |
| Volume IV | All | All AI-touching systems |
| Volume V | None | Infrastructure only |

---

## REVISION HISTORY

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2026-03-09 | Mike Meraw | Initial matrix creation |

---

*End of Assembly Matrix*
