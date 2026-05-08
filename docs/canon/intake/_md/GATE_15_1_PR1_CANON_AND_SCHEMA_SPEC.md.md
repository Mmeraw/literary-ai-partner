**GATE\_15\_1\_PR1\_CANON\_AND\_SCHEMA\_SPEC.md**

**RevisionGrade — PR1 Canon & Schema Specification**

**Scope:** PR1 only (foundation layer)
**Purpose:** Establish canonical definitions, thresholds, vocabulary register, and schema contracts for Gate 15.1 before any validator or governance logic is implemented.

**Gate 15 1 Pr1 Canon And Schema Spec**

**1. Objective**

PR1 creates the **immutable foundation layer** for Gate 15.1.

This includes:

* Canon definition (Gate 15.1 structure)
* Controlled Vocabulary Register (Appendix A)
* Threshold constants
* Schema contracts for all downstream components

No execution logic is implemented in PR1.

**2. Deliverables**

PR1 must include:

**Canon**

* /packages/canon/gate15.ts
* /packages/canon/controlled-vocabulary-register.ts
* /packages/canon/thresholds.ts

**Schemas**

* /packages/schemas/gate15.schema.ts
* /packages/schemas/governance.schema.ts
* /packages/schemas/chapter-state.schema.ts
* /packages/schemas/exception.schema.ts
* /packages/schemas/evidence.schema.ts

**Shared Types**

* /packages/shared/types.ts

**3. Canon Definition**

**File: /packages/canon/gate15.ts**

export const GATE\_15\_1 = {

id: "15.1",

name: "Dialogue & Attribution Purity Gate",

position: {

afterWave: 15,

beforeWave: 16

},

type: "PRE\_EVALUATION\_GATE",

blocking: true,

layers: {

layer1: "QUANTITATIVE\_DETECTION",

layer2: "STRUCTURAL\_VALIDATION"

},

failureHandling: {

blockScoring: true,

returnToRevision: true,

requireJustification: true,

overrideAllowed: false

}

} as const;

**4. Controlled Vocabulary Register**

**File: /packages/canon/controlled-vocabulary-register.ts**

export const CONTROLLED\_VOCABULARY = {

attributionTags: [

"said","asked","replied","answered","responded","called","stated","declared","announced","added",

"continued","began","started","finished","repeated","insisted","demanded","suggested","offered",

"countered","confirmed","admitted","explained","noted","observed","remarked","commented","mentioned",

"urged","cautioned","warned","promised","agreed","objected","protested","argued","snapped","barked",

"growled","groaned","moaned","gasped","cried","screamed","shouted","yelled","exclaimed"

],

softTags: [

"whispered","murmured","muttered","breathed","hissed","mouthed","mused","intoned","lilted",

"purred","cooed","rasped","croaked","stammered","stuttered","sputtered","whimpered","whined",

"pleaded","begged"

],

thoughtVerbs: [

"thought","believed","pondered","considered","wondered","realized","decided","figured",

"supposed","assumed","imagined","remembered","recalled","recognized","understood","knew",

"felt","sensed","suspected","feared","hoped","wished","prayed",

"told himself","reminded himself","reassured himself"

],

physiologicalFillers: [

"swallowed","exhaled","inhaled","nodded","shrugged","sighed","blinked","winced","flinched",

"stiffened","tensed","clenched","unclenched","straightened","shifted","squirmed","fidgeted",

"trembled","shuddered","steadied","braced","froze","paused","hesitated",

"swallowed hard","licked his lips","bit his lip","chewed his lip","set his jaw","gritted his teeth",

"cleared his throat","held his breath","let out a breath","drew a breath","took a breath",

"sucked in a breath","released a breath"

]

} as const;

**5. Thresholds**

**File: /packages/canon/thresholds.ts**

export const GATE15\_THRESHOLDS = {

attributionPer1000: 4,

softTagsPerChapter: 2,

thoughtVerbsPerChapter: 0,

physiologicalFillersPerChapter: 3

} as const;

**6. Core Schema — Gate 15.1**

**File: /packages/schemas/gate15.schema.ts**

export type PassFail = "PASS" | "FAIL";

export interface FlaggedInstance {

lineNumber: number;

matchedText: string;

category: string;

context: string;

justificationRequired: boolean;

}

export interface Layer1Metric {

count: number;

threshold?: number;

per1000?: number;

status: PassFail;

instances: FlaggedInstance[];

}

export interface Layer2Result {

status: PassFail;

rationale: string;

reviewerType: "AI" | "HUMAN";

}

export interface Gate15Result {

chapterId: string;

wordCount: number;

overallStatus: PassFail;

blocking: boolean;

layer1: {

attributionDensity: Layer1Metric;

softTags: Layer1Metric;

thoughtVerbs: Layer1Metric;

physiologicalFillers: Layer1Metric;

boundaryTest: Layer1Metric;

};

layer2?: {

attributionIndependence: Layer2Result;

voiceDifferentiationIntegrity: Layer2Result;

rhythmIntegrity: Layer2Result;

};

}

**7. Governance Schema**

**File: /packages/schemas/governance.schema.ts**

export interface GovernanceLog {

chapterId: string;

gate: string;

status: "PASS" | "FAIL";

blocking: boolean;

reason: string;

timestamp: string;

}

**8. Chapter State Schema**

**File: /packages/schemas/chapter-state.schema.ts**

export type ChapterState =

| "uploaded"

| "wave15\_complete"

| "gate15\_failed"

| "blocked\_in\_revision"

| "eligible\_for\_wave16";

**9. Exception Schema**

**File: /packages/schemas/exception.schema.ts**

export interface ExceptionLogEntry {

chapterId: string;

gate: "15.1";

lineNumber: number;

matchedText: string;

justification: string;

timestamp: string;

}

**10. Evidence Schema**

**File: /packages/schemas/evidence.schema.ts**

export interface EvidencePack {

chapterId: string;

validatorOutput: string;

governanceLog: string;

exceptions?: string;

}

**11. Done Definition (PR1)**

PR1 is complete when:

* Canon files compile and export correctly
* Vocabulary register is fully populated
* Thresholds are centralized and immutable
* All schemas compile and validate
* No execution logic exists yet
* Repo builds cleanly

**12. Next Step**

Proceed to:

👉 **PR2 — Layer 1 Validator Implementation**

This PR should only begin after PR1 is merged and locked.

*Done. It’s now in canvas as a clean, repo-ready .md spec.*
