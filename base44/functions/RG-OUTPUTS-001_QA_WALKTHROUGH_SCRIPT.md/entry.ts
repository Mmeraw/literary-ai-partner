# RG-OUTPUTS-001 — QA WALKTHROUGH SCRIPT (FUNCTION TEST #7)

**Epic:** RG-OUTPUTS-001  
**Purpose:** Determine VERIFIED / PARTIALLY VERIFIED / FAILED status for Outputs surfaces  
**Execution Date:** [To be scheduled after Phase 4 complete, targeting 2026-02-09]  
**QA Lead:** [Name]  
**Witnesses:** [Names]

---

## Pre-Test Conditions (MANDATORY)

**Before any test execution:**

- [ ] **No code changes during walkthrough** — This is observational runtime behavior only
- [ ] All Phase 4 tickets marked DONE
- [ ] Test environment matches production configuration
- [ ] Test account prepared (authenticated user with evaluated manuscript)
- [ ] Test inputs documented
- [ ] Expected behavior defined
- [ ] Evidence capture tools ready (screenshots, logs, audit queries)

**If any pre-condition fails → halt test, remediate, reschedule**

---

## Test Inputs

### Input G1 — Valid Governed Output Generation
- Use evaluated manuscript with complete baseline (spine + 13 criteria + WAVE)
- Generate multiple output types: Synopsis, Query Letter, Pitch, Biography, Comparables, Film Adaptation, Complete Package
- **Verify:** Governed entry, validators, audit, SLA, provenance

### Input G2 — Output with Missing Prerequisites (Negative Path)
- Attempt to generate output from unevaluated manuscript
- Attempt to generate output from partial evaluation (missing spine or criteria)
- **Verify:** Blocks with validator failure, user-visible error, audit event

### Input G3 — Export Workflow (PDF, DOCX, ZIP)
- Generate output (from G1)
- Export to PDF, DOCX, TXT formats
- **Verify:** Export provenance, format validation, audit, SLA

### Input G4 — Tampered State (Negative Path)
- Attempt to generate output with invalid source reference
- Attempt to export with missing source evaluation
- **Verify:** Blocks with validator failure, audit event

---

## Evidence Requirements (MUST CAPTURE FOR EACH INPUT)

For **EACH test input**, QA must collect:

### 1. UI Screenshots
- [ ] Before generation (form state, source selection)
- [ ] During generation (loading/processing state)
- [ ] After generation (output displayed or error shown)
- [ ] Export actions (download buttons, export confirmation)

### 2. Function Traces (With Timestamps)
- [ ] Which functions executed
- [ ] Execution order
- [ ] Timestamps (start, end)
- [ ] Parameters passed (source IDs, output types, export formats)
- [ ] Return values

### 3. Validator Evidence
- [ ] Which validators ran
- [ ] Validator outcomes (pass / soft / hard)
- [ ] Failure codes (if any)
- [ ] Validator execution logged in audit

### 4. Audit Records (Structured)
- [ ] Query audit entity after each action
- [ ] Verify structured event exists (not free-text logs)
- [ ] All required fields populated
- [ ] `request_id` correlates related events

### 5. SLA Timing Metrics
- [ ] `start_ms`, `end_ms`, `elapsed_ms` present
- [ ] Operations array populated (where applicable)
- [ ] Timing written to audit record (not console logs)

---

## Test Execution — Input G1 (Valid Governed Output Generation)

### Step G1-1: Generate Synopsis

**Action:**
1. Sign in with account that has evaluated manuscript (spine + 13 criteria + WAVE complete)
2. Navigate to Synopsis page
3. Select manuscript
4. Select synopsis type (query | standard | extended)
5. Click "Generate Synopsis"

**Expected Behavior:**
- ✅ Synopsis generated successfully
- ✅ **Governed entry executed** (before generation)
- ✅ **Validators executed** (OUTPUT_ELIGIBILITY_CHECK, OUTPUT_SOURCE_PROVENANCE, OUTPUT_COMPLETENESS)
- ✅ **Audit event created** (action_type=generate_output, output_type=synopsis)
- ✅ **SLA timing captured**
- ✅ **Provenance recorded** (input_source_ids includes manuscript ID)

**Evidence to Capture:**
- [ ] Screenshot: synopsis generation form (before generate)
- [ ] Screenshot: generated synopsis (after generation)
- [ ] Function trace: `generateSynopsis` executed with timestamp
- [ ] Function trace: `governedEvaluateEntry` called FIRST (new)
- [ ] Validator log: OUTPUT_ELIGIBILITY_CHECK = pass, OUTPUT_SOURCE_PROVENANCE = pass, OUTPUT_COMPLETENESS = pass
- [ ] Audit record query: action_type=generate_output, output_type=synopsis, input_source_ids=[manuscript_id], validators_run=[list]
- [ ] SLA metrics: start_ms, end_ms, elapsed_ms

**PASS Criteria:**
- Synopsis generated AND governed entry + validators + audit + SLA + provenance all present

**FAIL Criteria:**
- Any governance hook missing OR provenance missing

---

### Step G1-2: Generate Query Letter

**Action:**
1. Navigate to QueryLetter page
2. Select manuscript or upload mode
3. Generate query letter

**Expected Behavior:**
- ✅ Query letter generated
- ✅ **Governed entry executed**
- ✅ **Validators executed** (OUTPUT_ELIGIBILITY_CHECK, OUTPUT_SOURCE_PROVENANCE)
- ✅ **Audit event created** (action_type=generate_output, output_type=query_letter)
- ✅ **SLA timing captured**
- ✅ **Provenance recorded**

**Evidence to Capture:**
- [ ] Screenshot: query letter generation (before/after)
- [ ] Function trace: `generateQueryLetter` or `generateQueryLetterPackage` executed
- [ ] Function trace: `governedEvaluateEntry` called FIRST
- [ ] Validator log: validators executed and passed
- [ ] Audit record: complete with provenance
- [ ] SLA metrics: timing present

**PASS Criteria:**
- Query letter generated AND all governance hooks present

**FAIL Criteria:**
- Missing governance evidence

---

### Step G1-3: Generate Pitches

**Action:**
1. Navigate to PitchGenerator page
2. Select source (manuscript or text input)
3. Generate pitches

**Expected Behavior:**
- ✅ Pitches generated
- ✅ **Governed entry executed**
- ✅ **Validators executed**
- ✅ **Audit event created** (output_type=pitch)
- ✅ **SLA timing captured**
- ✅ **Provenance recorded**

**Evidence to Capture:**
- [ ] Screenshot: pitch generation
- [ ] Function trace: `generateQueryPitches` executed
- [ ] Function trace: `governedEvaluateEntry` called FIRST
- [ ] Validator log: validators executed
- [ ] Audit record: complete
- [ ] SLA metrics: present

**Repeat for:** Biography, Comparables, Film Adaptation, Complete Package

---

## Test Execution — Input G2 (Missing Prerequisites — Negative Path)

### Step G2-1: Generate Output Without Evaluation

**Action:**
1. Upload manuscript but DO NOT evaluate (skip spine/criteria/WAVE)
2. Navigate to Synopsis page
3. Select unevaluated manuscript
4. Attempt to generate synopsis

**Expected Behavior:**
- ❌ Generation BLOCKED (400 Bad Request or similar)
- ✅ User-visible error message: "Evaluation incomplete. Run Spine + 13 Criteria + WAVE before generating synopsis."
- ✅ **Governed entry executed** (validates prerequisites)
- ✅ **Validators fail** (OUTPUT_ELIGIBILITY_CHECK)
- ✅ **Audit event created** (action_type=generate_output_failed, failure_codes=[MISSING_EVALUATION])
- ✅ **SLA timing captured** (even for failed requests)

**Evidence to Capture:**
- [ ] Screenshot: error state (generation blocked)
- [ ] Function trace: generation function returns 400 or error
- [ ] Function trace: `governedEvaluateEntry` called, returns error
- [ ] Validator log: OUTPUT_ELIGIBILITY_CHECK = fail, failure_code=MISSING_EVALUATION
- [ ] Audit record query: action_type=generate_output_failed, failure_codes=[MISSING_EVALUATION]
- [ ] SLA metrics: timing captured for failed request

**PASS Criteria:**
- Generation blocked AND error visible AND validator failure + audit event present

**FAIL Criteria:**
- Generation succeeds OR no validator/audit evidence → **FAILED (Data Integrity Risk)**

---

### Step G2-2: Generate Output with Partial Evaluation

**Action:**
1. Upload manuscript and run Spine evaluation only (skip 13 criteria and WAVE)
2. Attempt to generate Synopsis

**Expected Behavior:**
- ❌ Generation BLOCKED
- ✅ Error: "Incomplete evaluation. Missing: 13 Criteria, WAVE Flags."
- ✅ **Validators fail** (OUTPUT_ELIGIBILITY_CHECK)
- ✅ **Audit event created** (failure_codes=[INCOMPLETE_EVALUATION])

**Evidence to Capture:**
- [ ] Screenshot: error state
- [ ] Validator log: OUTPUT_ELIGIBILITY_CHECK = fail, failure_code=INCOMPLETE_EVALUATION
- [ ] Audit record: failure_codes populated

**PASS Criteria:**
- Blocked with validator + audit evidence

**FAIL Criteria:**
- Partial evaluation allows generation → **FAILED**

---

## Test Execution — Input G3 (Export Workflow)

### Step G3-1: Export Synopsis to PDF

**Action:**
1. Generate Synopsis (from G1)
2. Click "Export to PDF" button
3. Download PDF file

**Expected Behavior:**
- ✅ PDF generated successfully
- ✅ **Governed entry executed** (before export)
- ✅ **Validators executed** (OUTPUT_EXPORT_FORMAT)
- ✅ **Audit event created** (action_type=export_output, export_format=pdf, input_source_ids=[synopsis_id, manuscript_id])
- ✅ **SLA timing captured**
- ✅ **Provenance traceable** (PDF references source evaluation)

**Evidence to Capture:**
- [ ] Screenshot: export button click
- [ ] Screenshot: PDF download confirmation
- [ ] Downloaded PDF file (verify contents)
- [ ] Function trace: export function executed
- [ ] Function trace: `governedEvaluateEntry` called FIRST
- [ ] Validator log: OUTPUT_EXPORT_FORMAT = pass
- [ ] Audit record: action_type=export_output, export_format=pdf, input_source_ids=[list]
- [ ] SLA metrics: timing present

**PASS Criteria:**
- PDF exported AND provenance + validators + audit + SLA all present

**FAIL Criteria:**
- Export succeeds without provenance → **FAILED**

---

### Step G3-2: Export Complete Package to ZIP

**Action:**
1. Generate Complete Package (from G1)
2. Export to ZIP format
3. Download and inspect ZIP contents

**Expected Behavior:**
- ✅ ZIP generated with all artifacts (synopsis, query, pitches, bio)
- ✅ **Governed entry executed**
- ✅ **Validators executed** (OUTPUT_EXPORT_FORMAT, OUTPUT_COMPLETENESS)
- ✅ **Audit event created** (action_type=export_output, export_format=zip)
- ✅ **Provenance recorded** (all source IDs included)

**Evidence to Capture:**
- [ ] Screenshot: export action
- [ ] Downloaded ZIP file (verify structure and contents)
- [ ] Function trace: export function executed
- [ ] Validator log: validators executed
- [ ] Audit record: complete with all source IDs
- [ ] SLA metrics: present

**Repeat for:** DOCX, TXT exports

---

## Test Execution — Input G4 (Tampered State — Negative Path)

### Step G4-1: Generate Output with Invalid Source Reference

**Action:**
1. Manually construct request with invalid manuscript ID (non-existent or not owned by user)
2. Attempt to generate output

**Expected Behavior:**
- ❌ Generation BLOCKED (404 or 403)
- ✅ Error: "Source not found" or "Access denied"
- ✅ **Governed entry executed**
- ✅ **Validators fail** (OUTPUT_SOURCE_PROVENANCE)
- ✅ **Audit event created** (failure_codes=[INVALID_SOURCE])

**Evidence to Capture:**
- [ ] Function trace: validation rejects invalid source
- [ ] Validator log: OUTPUT_SOURCE_PROVENANCE = fail, failure_code=INVALID_SOURCE
- [ ] Audit record: failure_codes=[INVALID_SOURCE]

**PASS Criteria:**
- Blocked with validator + audit evidence

**FAIL Criteria:**
- Tampered source allows generation → **FAILED (Security Risk)**

---

### Step G4-2: Export Without Source Evaluation

**Action:**
1. Attempt to export output that was not generated through governed flow (e.g., manually created record)
2. Trigger export function directly

**Expected Behavior:**
- ❌ Export BLOCKED
- ✅ Error: "Export requires governed source"
- ✅ **Validators fail** (OUTPUT_SOURCE_PROVENANCE)
- ✅ **Audit event created** (failure_codes=[UNGOVERNED_SOURCE])

**Evidence to Capture:**
- [ ] Function trace: export rejected
- [ ] Validator log: OUTPUT_SOURCE_PROVENANCE = fail
- [ ] Audit record: failure_codes=[UNGOVERNED_SOURCE]

**PASS Criteria:**
- Export blocked with evidence

**FAIL Criteria:**
- Ungoverned export succeeds → **FAILED (Data Integrity Risk)**

---

## Governance Evidence Checklist (MANDATORY FOR VERIFIED)

### A. Governed Entry
- [ ] Governed entry executed FIRST for all output generation actions
- [ ] Governed entry executed FIRST for all export actions
- [ ] QA checklist enforced
- [ ] Halt-on-fail behavior demonstrated
- [ ] Evidence: traces show `governedEvaluateEntry` before processing

**If unchecked → FAILED**

### B. Validators
- [ ] OUTPUT_ELIGIBILITY_CHECK validator executed
- [ ] OUTPUT_SOURCE_PROVENANCE validator executed
- [ ] OUTPUT_COMPLETENESS validator executed
- [ ] OUTPUT_EXPORT_FORMAT validator executed
- [ ] Validator outcomes recorded (pass / soft / hard)
- [ ] Failure codes populated when validators fail

**If any validator missing → UNVERIFIED**

### C. Routing & Detection
- [ ] `action_type` explicit for all events (generate_output | export_output)
- [ ] `output_type` explicit (synopsis | query_letter | pitch | etc.)
- [ ] `export_format` explicit (pdf | docx | txt | zip)
- [ ] No silent heuristics or inference

**If routing implicit → FAILED**

### D. Audit Record (Mandatory)
- [ ] Structured audit event exists for ALL output generation actions (not logs)
- [ ] Structured audit event exists for ALL export actions
- [ ] `event_id` present
- [ ] `request_id` present
- [ ] `timestamp_utc` present
- [ ] `action_type` correct
- [ ] `output_type` present
- [ ] `export_format` present (for exports)
- [ ] `input_source_ids` populated
- [ ] `validators_run` populated
- [ ] `failure_codes` populated (if applicable)
- [ ] `user_email` present (actor context)

**If audit missing or incomplete → FAILED**

### E. SLA Timing
- [ ] `start_ms` present
- [ ] `end_ms` present
- [ ] `elapsed_ms` present
- [ ] Operations array populated (generation phase, validation phase, export phase)

**If missing → PARTIALLY VERIFIED**

### F. Export Provenance
- [ ] All exports include `input_source_ids` in audit
- [ ] Source IDs traceable to evaluated manuscripts
- [ ] Ungoverned sources block export (validator failure)
- [ ] Tampered sources detected and blocked

**If provenance missing → FAILED (Data Integrity Risk)**

### G. Negative Path Testing
- [ ] Unevaluated manuscript blocks output (G2-1)
- [ ] Partial evaluation blocks output (G2-2)
- [ ] Invalid source blocks generation (G4-1)
- [ ] Ungoverned source blocks export (G4-2)
- [ ] Errors user-visible
- [ ] Failures auditable (validator evidence + audit event)

**If silent failure or bypass → FAILED**

---

## Promotion Decision Rubric (Mechanical)

### VERIFIED
**All must be present:**
- Output generation works for valid inputs
- Governed entry + validators + audit + SLA + provenance all present
- Negative paths blocked with evidence
- All checkboxes above = ✅

**Action:** Update Webpage Contract Matrix: Outputs = VERIFIED

---

### PARTIALLY VERIFIED
**Functionality correct, but any of:**
- SLA missing
- Audit present but incomplete fields
- Validators not consistently executed
- Provenance tracking incomplete

**Action:** Update Webpage Contract Matrix: Outputs = PARTIALLY VERIFIED  
**Note:** Remaining gaps listed in follow-up ticket

---

### FAILED
**Any of:**
- Output generated without evaluation (missing prerequisites bypass)
- Export without provenance (ungoverned source)
- Governance bypass (no validators/audit)
- Governed entry absent
- Negative paths not blocked

**Action:** Update Webpage Contract Matrix: Outputs = FAILED  
**Impact:** Release-blocking  
**Escalation:** GOVERNANCE_BYPASS incident created

---

## Evidence Packet Submission Format

**QA Lead must compile and attach:**

1. **Evidence Summary Document** (markdown or PDF):
   - Test execution date/time
   - Account used
   - Pass/fail decision for each input
   - Links to all screenshots, logs, audit queries
   - Promotion decision (VERIFIED / PARTIALLY VERIFIED / FAILED)

2. **Screenshots Folder** (organized by test input):
   - G1_valid_output_generation/
   - G2_missing_prerequisites/
   - G3_export_workflow/
   - G4_tampered_state/

3. **Function Traces** (text file or log export):
   - Timestamps for all function executions
   - Parameters passed
   - Return values

4. **Validator Results** (CSV or table):
   - Validator name | Outcome | Failure codes | Action

5. **Audit Record Queries** (JSON export):
   - All audit events created during test
   - Confirm all required fields present

6. **SLA Metrics** (table or JSON):
   - Action | start_ms | end_ms | elapsed_ms

7. **Exported Files** (for provenance verification):
   - PDF, DOCX, TXT, ZIP files generated during test
   - Metadata inspection confirming source references

---

## Final Instruction to QA

**This is not a functional test.**  
**This is a governance audit.**

Your job is to:
1. Execute the test inputs exactly as written
2. Capture ALL evidence (screenshots, traces, validators, audit, SLA, provenance)
3. Apply the promotion rubric mechanically (no judgment calls)
4. Submit evidence packet with clear VERIFIED / PARTIALLY VERIFIED / FAILED decision

**If you cannot point to evidence, the surface is not VERIFIED.**

---

## Post-Test Actions

### If VERIFIED:
- [ ] Update Webpage Contract Matrix: Outputs = VERIFIED
- [ ] Close RG-OUTPUTS-001 Epic
- [ ] Archive evidence packet
- [ ] Proceed to next surface

### If PARTIALLY VERIFIED:
- [ ] Update Webpage Contract Matrix: Outputs = PARTIALLY VERIFIED
- [ ] Document remaining gaps
- [ ] Create follow-up tickets (if needed)
- [ ] Escalate to stakeholders

### If FAILED:
- [ ] Update Webpage Contract Matrix: Outputs = FAILED
- [ ] Create GOVERNANCE_BYPASS incident
- [ ] Escalate to engineering lead
- [ ] Block release until remediated

**QA authority is mechanical, not negotiable.**