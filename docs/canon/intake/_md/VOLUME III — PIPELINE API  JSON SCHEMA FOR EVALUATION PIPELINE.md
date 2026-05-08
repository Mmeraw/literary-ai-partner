**VOLUME III — PIPELINE API / JSON SCHEMA FOR EVALUATION PIPELINE**

**RevisionGrade Canon — v1.0**

**III.API.1 — Purpose**

This schema defines the machine-operational structure for the RevisionGrade evaluation pipeline.

It allows the system to:

* track manuscript state
* validate transitions
* store pass outputs
* enforce WAVE eligibility
* block invalid progression
* preserve audit integrity

This schema is implementation-facing, but canon-bound.

**III.API.2 — Canonical Pipeline States**

{
 "pipelineStates": [
 "draft",
 "pass1\_complete",
 "pass2\_complete",
 "converged",
 "wave\_eligible",
 "wave\_executed",
 "revised\_output",
 "validated",
 "rejected"
 ]
}

**III.API.3 — Manuscript Pipeline Record**

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "revisiongrade.pipeline.record.schema.json",
 "title": "RevisionGrade Pipeline Record",
 "type": "object",
 "required": [
 "manuscriptId",
 "chapterId",
 "currentState",
 "executionMode",
 "createdAt",
 "updatedAt",
 "passes",
 "governance"
 ],
 "properties": {
 "manuscriptId": {
 "type": "string",
 "minLength": 1
 },
 "chapterId": {
 "type": "string",
 "minLength": 1
 },
 "currentState": {
 "type": "string",
 "enum": [
 "draft",
 "pass1\_complete",
 "pass2\_complete",
 "converged",
 "wave\_eligible",
 "wave\_executed",
 "revised\_output",
 "validated",
 "rejected"
 ]
 },
 "executionMode": {
 "type": "string",
 "enum": ["trusted\_path", "studio"]
 },
 "createdAt": {
 "type": "string",
 "format": "date-time"
 },
 "updatedAt": {
 "type": "string",
 "format": "date-time"
 },
 "passes": {
 "type": "object",
 "required": ["pass1", "pass2", "pass3"],
 "properties": {
 "pass1": { "$ref": "#/$defs/passRecord" },
 "pass2": { "$ref": "#/$defs/passRecord" },
 "pass3": { "$ref": "#/$defs/passRecord" }
 }
 },
 "waveExecution": {
 "$ref": "#/$defs/waveExecutionRecord"
 },
 "validation": {
 "$ref": "#/$defs/validationRecord"
 },
 "governance": {
 "$ref": "#/$defs/governanceRecord"
 },
 "audit": {
 "$ref": "#/$defs/auditRecord"
 }
 },
 "$defs": {
 "passRecord": {
 "type": "object",
 "required": ["status", "completed", "criteriaEvaluated"],
 "properties": {
 "status": {
 "type": "string",
 "enum": ["not\_started", "in\_progress", "complete", "failed", "invalid"]
 },
 "completed": {
 "type": "boolean"
 },
 "criteriaEvaluated": {
 "type": "array",
 "items": { "type": "string" }
 },
 "outputId": {
 "type": "string"
 },
 "checklistPassed": {
 "type": "boolean"
 },
 "notes": {
 "type": "string"
 }
 }
 },
 "waveExecutionRecord": {
 "type": "object",
 "properties": {
 "eligible": {
 "type": "boolean"
 },
 "invoked": {
 "type": "boolean"
 },
 "completed": {
 "type": "boolean"
 },
 "wavesRun": {
 "type": "array",
 "items": { "type": "integer", "minimum": 1, "maximum": 62 }
 },
 "outputId": {
 "type": "string"
 }
 }
 },
 "validationRecord": {
 "type": "object",
 "properties": {
 "checklistVersion": {
 "type": "string"
 },
 "allChecksPassed": {
 "type": "boolean"
 },
 "failedChecks": {
 "type": "array",
 "items": { "type": "string" }
 },
 "validatedAt": {
 "type": "string",
 "format": "date-time"
 }
 }
 },
 "governanceRecord": {
 "type": "object",
 "required": ["blocked", "reasons"],
 "properties": {
 "blocked": {
 "type": "boolean"
 },
 "reasons": {
 "type": "array",
 "items": { "type": "string" }
 },
 "lastDecision": {
 "type": "string",
 "enum": ["allow", "block", "reject", "require\_revision"]
 }
 }
 },
 "auditRecord": {
 "type": "object",
 "properties": {
 "artifactIds": {
 "type": "array",
 "items": { "type": "string" }
 },
 "sourceHash": {
 "type": "string"
 },
 "normalizedHash": {
 "type": "string"
 },
 "history": {
 "type": "array",
 "items": { "$ref": "#/$defs/historyEntry" }
 }
 }
 },
 "historyEntry": {
 "type": "object",
 "required": ["timestamp", "state", "action"],
 "properties": {
 "timestamp": {
 "type": "string",
 "format": "date-time"
 },
 "state": {
 "type": "string"
 },
 "action": {
 "type": "string"
 },
 "actor": {
 "type": "string"
 }
 }
 }
 }
}

**III.API.4 — Pass Output Schema**

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "revisiongrade.pass.output.schema.json",
 "title": "Pass Output",
 "type": "object",
 "required": [
 "passType",
 "manuscriptId",
 "chapterId",
 "criteria",
 "summary",
 "completedAt"
 ],
 "properties": {
 "passType": {
 "type": "string",
 "enum": ["pass1", "pass2", "pass3"]
 },
 "manuscriptId": {
 "type": "string"
 },
 "chapterId": {
 "type": "string"
 },
 "criteria": {
 "type": "array",
 "items": { "$ref": "#/$defs/criterionResult" }
 },
 "summary": {
 "$ref": "#/$defs/summaryBlock"
 },
 "completedAt": {
 "type": "string",
 "format": "date-time"
 }
 },
 "$defs": {
 "criterionResult": {
 "type": "object",
 "required": ["criterionName", "finding", "evidence", "impact", "judgment"],
 "properties": {
 "criterionName": { "type": "string" },
 "finding": { "type": "string" },
 "evidence": {
 "type": "array",
 "items": { "type": "string" }
 },
 "impact": { "type": "string" },
 "judgment": {
 "type": "string",
 "enum": ["effective", "ineffective", "mixed"]
 },
 "divergenceStatus": {
 "type": "string",
 "enum": ["confirms", "challenges", "expands"]
 },
 "agreementStatus": {
 "type": "string",
 "enum": ["agreement", "partial\_agreement", "disagreement"]
 },
 "resolutionLogic": {
 "type": "string"
 }
 }
 },
 "summaryBlock": {
 "type": "object",
 "properties": {
 "primaryStrength": { "type": "string" },
 "primaryWeakness": { "type": "string" },
 "dominantPattern": { "type": "string" },
 "divergenceSummary": { "type": "string" },
 "convergenceSummary": { "type": "string" }
 }
 }
 }
}

**III.API.5 — WAVE Execution Schema**

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "revisiongrade.wave.execution.schema.json",
 "title": "WAVE Execution Output",
 "type": "object",
 "required": [
 "manuscriptId",
 "chapterId",
 "eligible",
 "invocationValid",
 "revisionTargets",
 "completedAt"
 ],
 "properties": {
 "manuscriptId": { "type": "string" },
 "chapterId": { "type": "string" },
 "eligible": { "type": "boolean" },
 "invocationValid": { "type": "boolean" },
 "revisionTargets": {
 "type": "array",
 "items": { "$ref": "#/$defs/revisionTarget" }
 },
 "wavesRun": {
 "type": "array",
 "items": { "type": "integer", "minimum": 1, "maximum": 62 }
 },
 "completedAt": {
 "type": "string",
 "format": "date-time"
 }
 },
 "$defs": {
 "revisionTarget": {
 "type": "object",
 "required": ["zone", "issueType", "recommendedWave", "priority"],
 "properties": {
 "zone": { "type": "string" },
 "issueType": { "type": "string" },
 "recommendedWave": {
 "type": "integer",
 "minimum": 1,
 "maximum": 62
 },
 "priority": {
 "type": "string",
 "enum": ["high", "medium", "low"]
 },
 "directive": { "type": "string" }
 }
 }
 }
}

**III.API.6 — Transition Rules**

{
 "allowedTransitions": {
 "draft": ["pass1\_complete", "rejected"],
 "pass1\_complete": ["pass2\_complete", "rejected"],
 "pass2\_complete": ["converged", "rejected"],
 "converged": ["wave\_eligible", "rejected"],
 "wave\_eligible": ["wave\_executed", "rejected"],
 "wave\_executed": ["revised\_output", "rejected"],
 "revised\_output": ["validated", "rejected"],
 "validated": [],
 "rejected": []
 }
}

**III.API.7 — Enforcement Rules**

**WAVE Invocation Rule — Machine Form**

{
 "waveInvocationRule": {
 "requires": [
 "pass1.status == complete",
 "pass2.status == complete",
 "pass3.status == complete",
 "currentState == converged",
 "governance.blocked == false"
 ],
 "prohibits": [
 "currentState == draft",
 "currentState == pass1\_complete",
 "currentState == pass2\_complete",
 "currentState == rejected"
 ]
 }
}

**Validation Rule — Machine Form**

{
 "validationRule": {
 "requires": [
 "currentState == revised\_output",
 "validation.allChecksPassed == true",
 "governance.blocked == false"
 ],
 "result": "validated"
 }
}

**III.API.8 — Example Record**

{
 "manuscriptId": "ms\_lost\_world\_04",
 "chapterId": "ch\_04",
 "currentState": "converged",
 "executionMode": "trusted\_path",
 "createdAt": "2026-03-22T18:00:00Z",
 "updatedAt": "2026-03-22T21:10:00Z",
 "passes": {
 "pass1": {
 "status": "complete",
 "completed": true,
 "criteriaEvaluated": ["Concept & Core Premise", "Narrative Drive & Momentum"],
 "outputId": "p1\_ch04\_v1",
 "checklistPassed": true
 },
 "pass2": {
 "status": "complete",
 "completed": true,
 "criteriaEvaluated": ["Concept & Core Premise", "Narrative Drive & Momentum"],
 "outputId": "p2\_ch04\_v1",
 "checklistPassed": true
 },
 "pass3": {
 "status": "complete",
 "completed": true,
 "criteriaEvaluated": ["Concept & Core Premise", "Narrative Drive & Momentum"],
 "outputId": "p3\_ch04\_v1",
 "checklistPassed": true
 }
 },
 "waveExecution": {
 "eligible": true,
 "invoked": false,
 "completed": false,
 "wavesRun": []
 },
 "governance": {
 "blocked": false,
 "reasons": [],
 "lastDecision": "allow"
 },
 "audit": {
 "artifactIds": ["p1\_ch04\_v1", "p2\_ch04\_v1", "p3\_ch04\_v1"],
 "sourceHash": "abc123",
 "normalizedHash": "def456",
 "history": [
 {
 "timestamp": "2026-03-22T18:00:00Z",
 "state": "draft",
 "action": "created",
 "actor": "system"
 },
 {
 "timestamp": "2026-03-22T21:10:00Z",
 "state": "converged",
 "action": "pass3\_complete",
 "actor": "system"
 }
 ]
 }
}

**III.API.9 — Final Doctrine**

The API layer does not define canon.
It enforces canon.

This schema exists so that:

* state is explicit
* progression is blockable
* WAVE is invokable only when valid
* outputs are auditable
* system authority is machine-enforceable

SECTION III.5 — HIERARCHICAL ARTIFACT SCHEMA MODEL (REVISED)

This section defines the canonical artifact model for the hierarchical Evaluation Pipeline.

These schema contracts are authoritative. All pipeline implementations, persistence layers, APIs, and downstream consumers MUST conform to them.

---

SCHEMA PRINCIPLE

The Evaluation Pipeline is artifact-driven.

Each execution layer produces its own bounded artifact.

Higher layers consume lower-layer artifacts.

No higher-layer artifact may bypass or replace validated lower-layer artifacts.

The canonical artifact hierarchy is:

1. CHUNK SYNTHESIS ARTIFACT

2. SECTION / CHAPTER AGGREGATION ARTIFACT

3. MANUSCRIPT SYNTHESIS ARTIFACT

4. FINAL EVALUATION RESULT

---

I. COMMON METADATA FIELDS

All pipeline artifacts MUST include:

- artifact\_type

- schema\_version

- job\_id

- manuscript\_id

- title

- work\_type

- created\_at

- pipeline\_version

- coverage\_mode

- coverage\_scope

- finality\_eligible

Definitions:

artifact\_type:

- identifies the artifact contract

schema\_version:

- explicit schema version identifier

coverage\_mode:

- "full"

- "partial"

- "sampled"

coverage\_scope:

- describes the unit covered by the artifact

- examples:

- "chunk"

- "chapter"

- "section"

- "manuscript"

finality\_eligible:

- boolean

- true only if the artifact is eligible to support final governed completion at its intended layer

---

II. CHUNK SYNTHESIS ARTIFACT

artifact\_type = "chunk\_synthesis"

Purpose:

- stores the complete local evaluation result for one bounded manuscript unit

Scope:

- exactly one evaluated chunk

- produced after Pass 1, Pass 2, and Pass 3 complete successfully

Required Fields:

{

"artifact\_type": "chunk\_synthesis",

"schema\_version": "v1",

"job\_id": "<string>",

"manuscript\_id": "<string|number>",

"title": "<string>",

"work\_type": "<string>",

"chunk\_id": "<string>",

"chunk\_index": <integer>,

"chunk\_count\_total": <integer>,

"char\_start": <integer>,

"char\_end": <integer>,

"word\_count\_estimate": <integer>,

"coverage\_mode": "full",

"coverage\_scope": "chunk",

"finality\_eligible": true,

"criteria": [

{

"key": "<criterion\_key>",

"craft\_score": <integer 0-10>,

"editorial\_score": <integer 0-10>,

"final\_score\_0\_10": <integer 0-10>,

"score\_delta": <integer>,

"delta\_explanation": "<string, required when score\_delta > 2>",

"final\_rationale": "<string>",

"pressure\_points": ["<string>"],

"decision\_points": ["<string>"],

"consequence\_status": "landed|deferred|dissipated",

"deferred\_consequence\_risk": "<string, required when consequence\_status = deferred>",

"evidence": [

{

"snippet": "<string>",

"char\_start": <integer>,

"char\_end": <integer>

}

],

"recommendations": [

{

"priority": "high|medium|low",

"action": "<string>",

"expected\_impact": "<string>",

"anchor\_snippet": "<string>",

"source\_pass": 1|2|3

}

]

}

],

"agreement\_map": [

{

"key": "<criterion\_key>",

"agreement": "<string>"

}

],

"divergence\_map": [

{

"key": "<criterion\_key>",

"pass1\_position": "<string>",

"pass2\_position": "<string>",

"nature\_of\_divergence": "<string>",

"arbitration\_rationale": "<string>"

}

],

"overall\_local": {

"local\_score\_0\_100": <integer 0-100>,

"local\_summary": "<string>"

},

"metadata": {

"pass1\_model": "<string>",

"pass2\_model": "<string>",

"pass3\_model": "<string>",

"generated\_at": "<ISO-8601>"

}

}

Chunk Artifact Invariants:

1. One chunk artifact corresponds to one chunk only.

2. coverage\_mode MUST be "full" at chunk scope.

3. Every required criterion MUST be present.

4. Evidence spans MUST fall within chunk bounds.

5. Chunk artifacts do not carry manuscript-level verdict authority.

---

III. SECTION / CHAPTER AGGREGATION ARTIFACT

artifact\_type = "chapter\_aggregation"

Purpose:

- aggregates multiple chunk synthesis artifacts into a bounded higher-order structure

Scope:

- chapter or section

- derived from validated chunk synthesis artifacts only

Required Fields:

{

"artifact\_type": "chapter\_aggregation",

"schema\_version": "v1",

"job\_id": "<string>",

"manuscript\_id": "<string|number>",

"title": "<string>",

"work\_type": "<string>",

"aggregation\_unit\_type": "chapter|section",

"aggregation\_unit\_id": "<string>",

"chunk\_ids": ["<string>"],

"chunk\_count": <integer>,

"coverage\_mode": "full|partial",

"coverage\_scope": "chapter|section",

"coverage\_percent": <number 0-100>,

"finality\_eligible": <boolean>,

"criteria\_patterns": [

{

"key": "<criterion\_key>",

"score\_mean\_0\_10": <number>,

"score\_min\_0\_10": <integer>,

"score\_max\_0\_10": <integer>,

"recurrence\_count": <integer>,

"dominant\_strengths": ["<string>"],

"dominant\_weaknesses": ["<string>"],

"pressure\_continuity": "stable|mixed|broken",

"consequence\_pattern": "landed|deferred|dissipated|mixed"

}

],

"global\_signals": {

"repetition\_flags": ["<string>"],

"drift\_flags": ["<string>"],

"density\_flags": ["<string>"],

"continuity\_notes": ["<string>"]

},

"recommendation\_clusters": [

{

"theme": "<string>",

"priority": "high|medium|low",

"supporting\_chunk\_ids": ["<string>"],

"actions": ["<string>"]

}

],

"metadata": {

"aggregation\_method": "deterministic|hybrid",

"generated\_at": "<ISO-8601>"

}

}

Aggregation Artifact Invariants:

1. Aggregation artifacts MUST derive only from chunk synthesis artifacts.

2. No new manuscript evidence may be fabricated at aggregation level.

3. Aggregation may summarize and cluster, but may not overwrite lower-level truth without explicit justification.

4. Aggregation artifacts do not issue final manuscript verdicts.

---

IV. MANUSCRIPT SYNTHESIS ARTIFACT

artifact\_type = "manuscript\_synthesis"

Purpose:

- produces the manuscript-level synthesis grounded in aggregation artifacts

Scope:

- whole manuscript

- generated only after aggregation is complete

Required Fields:

{

"artifact\_type": "manuscript\_synthesis",

"schema\_version": "v1",

"job\_id": "<string>",

"manuscript\_id": "<string|number>",

"title": "<string>",

"work\_type": "<string>",

"coverage\_mode": "full|partial|sampled",

"coverage\_scope": "manuscript",

"coverage\_percent": <number 0-100>,

"input\_word\_count": <integer>,

"supported\_word\_count\_max": 160000,

"finality\_eligible": <boolean>,

"criteria": [

{

"key": "<criterion\_key>",

"global\_score\_0\_10": <integer 0-10>,

"global\_rationale": "<string>",

"systemic\_pattern\_summary": "<string>",

"evidence\_basis": {

"aggregation\_unit\_ids": ["<string>"],

"supporting\_chunk\_ids": ["<string>"]

},

"global\_recommendations": [

{

"priority": "high|medium|low",

"action": "<string>",

"expected\_impact": "<string>"

}

]

}

],

"overall": {

"overall\_score\_0\_100": <integer 0-100>,

"verdict": "pass|revise|fail|non\_final",

"one\_paragraph\_summary": "<string>",

"top\_3\_strengths": ["<string>"],

"top\_3\_risks": ["<string>"]

},

"compression\_intelligence": {

"overwrite\_risk": "low|medium|high",

"density\_pressure\_zones": ["<string>"],

"repetition\_pressure\_zones": ["<string>"],

"cut\_opportunity\_summary": "<string>"

},

"metadata": {

"synthesis\_method": "model\_based|hybrid",

"generated\_at": "<ISO-8601>"

}

}

Manuscript Synthesis Invariants:

1. Manuscript synthesis MUST be grounded in aggregation artifacts.

2. Raw manuscript text may be used only as a supporting reference, not as a bypass of lower-level evaluation.

3. coverage\_mode MUST be explicit.

4. If coverage\_mode is "sampled" or "partial", finality\_eligible MUST be false unless governance explicitly promotes eligibility.

5. Manuscript synthesis is not itself the final governed result.

---

V. FINAL EVALUATION RESULT

artifact\_type = "final\_evaluation\_result"

Purpose:

- stores the final governed result after deterministic finality evaluation

Scope:

- whole manuscript

- produced only after governance approval

Required Fields:

{

"artifact\_type": "final\_evaluation\_result",

"schema\_version": "v1",

"job\_id": "<string>",

"manuscript\_id": "<string|number>",

"title": "<string>",

"work\_type": "<string>",

"coverage\_mode": "full|partial|sampled",

"coverage\_scope": "manuscript",

"coverage\_percent": <number 0-100>,

"input\_word\_count": <integer>,

"supported\_word\_count\_max": 160000,

"finality\_eligible": <boolean>,

"confidence\_score": <number 0-1>,

"confidence\_basis": {

"coverage\_completeness": <number 0-1>,

"criteria\_completeness": <number 0-1>,

"evidence\_sufficiency": <number 0-1>,

"contradiction\_penalty": <number 0-1>

},

"result\_status": "completed|partial\_result|failed",

"governance\_decision": {

"approved": <boolean>,

"block\_codes": ["<string>"],

"warnings": ["<string>"],

"limitations": ["<string>"]

},

"manuscript\_synthesis\_ref": "<artifact\_id|string>",

"final\_output": {

"overall\_score\_0\_100": <integer 0-100>,

"verdict": "pass|revise|fail|non\_final",

"summary": "<string>",

"top\_strengths": ["<string>"],

"top\_risks": ["<string>"],

"priority\_actions": ["<string>"]

},

"metadata": {

"governance\_version": "<string>",

"generated\_at": "<ISO-8601>"

}

}

Final Result Invariants:

1. No final\_evaluation\_result may be issued without governance\_decision.

2. completed status requires governance approval.

3. partial\_result status MUST be explicit and user-visible.

4. sampled evaluation cannot produce completed status.

5. confidence\_score MUST be bounded by actual evaluated coverage.

---

VI. COVERAGE TRUTH FIELDS

The following fields are mandatory wherever applicable:

- coverage\_mode

- coverage\_scope

- coverage\_percent

- finality\_eligible

- input\_word\_count

- supported\_word\_count\_max

Canonical Rules:

1. coverage\_mode = "full" only when the declared scope has been completely evaluated.

2. coverage\_mode = "partial" when some but not all required scope has been evaluated.

3. coverage\_mode = "sampled" when representative extraction or windowing was used instead of full coverage.

4. sampled artifacts are advisory unless governance explicitly declares otherwise.

5. finality\_eligible must never be inferred implicitly.

---

VII. WORD-COUNT SUPPORT CONTRACT

At launch:

supported\_word\_count\_max = 160000

Rules:

1. Inputs at or below 160000 words may proceed to full-governance evaluation.

2. Inputs above 160000 words must not receive silent full-final treatment.

3. Inputs above supported maximum must:

- reject, OR

- downgrade explicitly to partial/non-final mode

This field is contractual and must remain visible in runtime and user-facing result metadata.

---

VIII. VERSIONING RULE

Any change to artifact structure, required fields, or canonical invariants requires:

- schema\_version increment

- compatibility review

- governance review

No silent schema drift is permitted.

---

This hierarchical artifact schema model is canonical and binding across evaluation pipeline implementations.
