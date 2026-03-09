# VOLUME III — TOOLS & IMPLEMENTATION SYSTEMS

Status: CANONICAL — ACTIVE  
Version: 1.0  
Authority: Mike Meraw  
Depends on: Volume I, Volume II, Volume III (Platform Governance), Volume IV  
Canon ID: VOL-III-TOOLS-1.0  
Governance: Doctrine Registry + Assembly Matrix  
Last Updated: 2026-03-09

---

## INTRODUCTION

Volume III (Tools & Implementation Systems) defines the schemas, prompts, adapters, evaluators, and integration contracts that implement the RevisionGrade canon in software. This is the bridge between governance (what the platform must do) and code (how it does it).

Every tool, prompt, schema, and adapter described here must conform to the canon. If implementation diverges from canon, the implementation is wrong—not the canon.

---

## PART 1 — SCHEMA ARCHITECTURE

### 1.1 Core Schemas

**Manuscript Schema**
- manuscript_id: unique identifier
- title: string
- author_id: reference to user
- genre: enum (from approved genre list)
- word_count: integer
- submission_date: timestamp
- status: enum (submitted, processing, evaluated, revision_in_progress)
- version: integer (increments on resubmission)

**Evaluation Schema**
- evaluation_id: unique identifier
- manuscript_id: reference
- wave_results: array of 62 wave diagnostic objects
- tsunami_results: array of 6 tsunami aggregation objects
- criteria_scores: array of 13 criterion score objects
- overall_score: computed float
- eligibility_gates: computed gate status object
- generated_at: timestamp
- ai_model_version: string
- confidence_flags: array of low-confidence markers

**Wave Result Schema**
- wave_id: W-01 through W-62
- wave_name: string
- score: float (1.0–10.0)
- justification: text (minimum 50 words)
- evidence_references: array of manuscript location references
- confidence: enum (high, medium, low)
- flags: array of diagnostic flags

**Criterion Score Schema**
- criterion_id: C-01 through C-13
- criterion_name: string
- score: float (1.0–10.0)
- justification: text (minimum 100 words)
- supporting_waves: array of wave_id references
- supporting_tsunamis: array of tsunami_id references
- confidence: enum (high, medium, low)

### 1.2 Schema Governance

- All schemas are versioned
- Schema changes require Doctrine Registry review
- Backward compatibility is required for all schema modifications
- No field may be removed—only deprecated and marked inactive

---

## PART 2 — PROMPT ARCHITECTURE

### 2.1 Prompt Categories

**Diagnostic Prompts (Wave-Level)**
Each of the 62 waves has a dedicated diagnostic prompt that:
- Defines exactly what the wave measures
- Specifies the scoring rubric
- Requires evidence citations from the manuscript
- Enforces justification minimum length
- Includes confidence self-assessment

**Aggregation Prompts (Tsunami-Level)**
Each tsunami has an aggregation prompt that:
- Takes wave results as input
- Identifies systemic patterns
- Produces aggregated scores and recommendations
- Cross-references wave findings for consistency

**Evaluation Prompts (Criterion-Level)**
Each criterion has an evaluation prompt that:
- Takes relevant wave and tsunami data as input
- Produces the final criterion score
- Generates detailed justification
- Computes eligibility gate implications

### 2.2 Prompt Governance

- All prompts are version-controlled
- Prompt modifications require canon review
- No prompt may contradict the canon definitions in Volumes I or II
- Prompts must be tested against calibration manuscripts before deployment
- Prompt engineering is subject to Volume IV AI governance constraints

---

## PART 3 — ADAPTER AND EVALUATOR SYSTEMS

### 3.1 Adapters

Adapters are the translation layer between external systems and the canonical evaluation pipeline:

**Input Adapters**
- Manuscript format converter (DOCX, PDF, TXT to internal format)
- Genre classifier
- Word count validator
- Submission integrity checker

**Output Adapters**
- Report generator (canonical evaluation to user-facing report)
- Export adapter (evaluation data to PDF, JSON, CSV)
- API adapter (evaluation data to external integrations)
- Delta report adapter (comparison between submission versions)

### 3.2 Evaluators

Evaluators are the processing units that execute canonical evaluation logic:

**Wave Evaluator**
- Executes individual wave diagnostics
- Enforces wave sequence
- Validates wave output against schema
- Logs all execution metadata

**Tsunami Evaluator**
- Aggregates wave results into tsunami assessments
- Validates aggregation logic
- Produces systemic pattern reports

**Criteria Evaluator**
- Computes criterion scores from wave and tsunami data
- Enforces scoring rules from Volume II
- Computes eligibility gates
- Generates final evaluation report

---

## PART 4 — INTEGRATION CONTRACTS

### 4.1 AI Model Contract

Any AI model used by RevisionGrade must:
- Accept canonical prompts without modification
- Produce output conforming to canonical schemas
- Include confidence assessments in all outputs
- Flag uncertainty per Volume IV requirements
- Not access or retain manuscript data beyond the evaluation session
- Be versioned and logged for audit purposes

### 4.2 Database Contract

The database layer must:
- Store all evaluation data per canonical schemas
- Maintain complete audit trails
- Support version history for manuscripts and evaluations
- Enforce data retention policies
- Support data export and deletion per user rights

### 4.3 API Contract

All API endpoints must:
- Validate input against canonical schemas
- Return output conforming to canonical schemas
- Include appropriate error handling and status codes
- Log all requests for audit purposes
- Enforce authentication and authorization

---

## PART 5 — IMPLEMENTATION DOCTRINES

### Doctrine: Canon Conformity
All implementation must conform to the canon. When implementation and canon diverge, the implementation must be corrected.

### Doctrine: Schema Immutability
No schema field may be deleted. Fields may only be deprecated and marked inactive.

### Doctrine: Prompt Traceability
Every prompt must be version-controlled and traceable to its canonical source definition.

### Doctrine: Adapter Neutrality
Adapters must translate faithfully without modifying, filtering, or interpreting canonical data.

### Doctrine: Evaluator Integrity
Evaluators must execute canonical logic exactly as defined. No shortcuts, approximations, or optimizations that alter evaluation outcomes.

---

*End of Volume III — Tools & Implementation Systems*
