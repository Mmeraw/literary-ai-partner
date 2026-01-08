# INDUSTRY_ENTITIES_v1.0.0.md

**Canon Spec — Industry Entities + DTO Contracts (v1.0.0)**

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2026-01-08  
**Depends on:** EVALUATION_METHOD_CANON.md (v1.0.0), WORK_TYPE_POLICY_ROUTING_SPEC.md (v1.0.0), INDUSTRY_PORTAL_SPEC_v1.0.0.md (v1.0.0)

---

## Purpose

Define the minimal entity layer and data contracts required to implement the Industry Portal/Agent Dashboard with strict author/industry separation and testable non-leakage guarantees.

---

## 1. Entities (Schemas)

### 1.1 AgencyOrg

**Fields**
- `id` (uuid)
- `name` (string)
- `slug` (string, unique)
- `settings` (json)
  - `sharedQueueEnabled` (bool)
  - `sharedDecisionsEnabled` (bool)
  - `defaultVisibility` ("ORG" | "INDIVIDUAL")
  - `allowAssignment` (bool)
- `createdAt` (datetime)
- `updatedAt` (datetime)

---

### 1.2 OrgMembership

**Fields**
- `id` (uuid)
- `agencyOrgId` (uuid, fk)
- `industryUserId` (uuid, fk)
- `role` ("REP" | "ADMIN")
- `isActive` (bool)
- `createdAt` (datetime)
- `updatedAt` (datetime)

---

### 1.3 IndustryDecision (Append-Only)

**Purpose:** Immutable decision events for a submission. Supports audit trails and "latest decision" resolution.

**Fields**
- `id` (uuid)
- `storygateSubmissionId` (uuid, fk)
- `industryUserId` (uuid, fk)
- `agencyOrgId` (uuid, fk, nullable)
- `decisionScope` ("USER" | "ORG")
- `status` (enum)
  - NEW
  - IN_REVIEW
  - REQUESTED_MATERIALS
  - HOLD
  - PASSED
  - REPLIED
  - CLOSED
- `reasonCode` (string enum, optional)
- `internalNotes` (text, private)
- `internalTags` (string[], private)
- `assignedToIndustryUserId` (uuid, nullable)
- `decisionedAt` (datetime, immutable)
- `supersedesDecisionId` (uuid, nullable)
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Resolution Rule (Latest Decision)**

For Inbox: select latest decision by:
- (storygateSubmissionId, decisionScope, agencyOrgId or industryUserId) and MAX(decisionedAt)

---

### 1.4 IndustryMessage

**Fields**
- `id` (uuid)
- `storygateSubmissionId` (uuid, fk)
- `fromIndustryUserId` (uuid, fk)
- `toAuthorUserId` (uuid, fk)
- `templateId` (uuid, nullable)
- `subject` (string)
- `body` (text)
- `sentAt` (datetime)
- `deliveryStatus` ("QUEUED" | "SENT" | "FAILED")

---

### 1.5 ResponseTemplate (Global / Org / User Overrides)

**Fields**
- `id` (uuid)
- `agencyOrgId` (uuid, nullable) // null => global
- `industryUserId` (uuid, nullable) // null => not user-specific
- `name` (string)
- `type` ("PASS" | "RNR" | "REQUEST_FULL" | "REQUEST_PARTIAL" | "INTEREST")
- `subject` (string)
- `body` (text)
- `isActive` (bool)
- `createdAt` (datetime)
- `updatedAt` (datetime)

**Template Resolution Order**
1. User (industryUserId = current user)
2. Org (agencyOrgId = org, industryUserId null)
3. Global (agencyOrgId null, industryUserId null)

---

## 2. DTO Contracts (JSON-ish)

### 2.1 Agent Inbox Row DTO

```json
{
  "submissionId": "uuid",
  "projectId": "uuid",
  "projectTitle": "string",
  "authorDisplayName": "string",
  "workTypeUi": "Flash / Micro | Novel / Manuscript | Screenplay | ...",
  "genre": "string",
  "length": { "wordCount": 82000, "scriptPages": 108 },
  "submittedAt": "datetime",
  "pipelineStatus": "NEW | IN_REVIEW | REQUESTED_MATERIALS | HOLD | PASSED | REPLIED | CLOSED",
  "internalTags": ["string"],
  "keySignalBadge": "CRAFT_ONLY | AGENT_REALITY",
  "assignedTo": { "industryUserId": "uuid", "displayName": "string" }
}
```

---

### 2.2 Submission Detail Drawer DTO (Agent-visible)

```json
{
  "submissionId": "uuid",
  "project": {
    "title": "string",
    "authorDisplayName": "string",
    "workTypeUi": "string",
    "genre": "string",
    "length": { "wordCount": 0, "scriptPages": 0 }
  },
  "materials": {
    "queryLetter": "string",
    "synopsis": "string",
    "sampleLink": "url",
    "fullLink": "url",
    "attachments": [{ "name": "string", "type": "pdf", "url": "url" }]
  },
  "evaluationIntelligence": {
    "enabled": true,
    "policyFamily": "MICRO_POLICY | MANUSCRIPT_POLICY | SCREENPLAY_POLICY | NEUTRAL_POLICY",
    "badge": "CRAFT_ONLY | AGENT_REALITY",
    "scoreSummary": {
      "readinessScore": 8.3,
      "scale": "0-10",
      "explanation": "string"
    },
    "strengths": ["string"],
    "concerns": ["string"]
  },
  "history": [
    { "at": "datetime", "event": "RECEIVED|OPENED|DECISIONED|MESSAGED", "by": "industryUserId" }
  ],
  "internal": {
    "internalNotes": "text",
    "internalTags": ["string"],
    "reasonCode": "string",
    "assignedToIndustryUserId": "uuid"
  }
}
```

---

### 2.3 Author-visible Submission DTO (Separate and Safe)

```json
{
  "submissionId": "uuid",
  "projectTitle": "string",
  "status": "SUBMITTED | IN_REVIEW | REQUESTED_MATERIALS | CLOSED",
  "messages": [
    { "sentAt": "datetime", "subject": "string", "body": "string" }
  ]
}
```

---

## 3. Security and Leak-Proofing Rules (Testable)

- Author-visible DTOs must not contain: `internalNotes`, `internalTags`, `reasonCode`, `assignedToIndustryUserId`, decision history
- Agent-visible endpoints require INDUSTRY_* roles
- `/agent/*` namespace requires server-side auth guard (no client-only gating)

---

## 4. Visibility Contract (Author vs Industry) — Enforcement Table (v1.0.0)

### Purpose
Provide a single, explicit truth table to drive:
- DTO shaping (author-safe vs industry-rich)
- automated no-leak tests
- UI rendering guards (author UI must never render industry-only fields)

### Legend
- **Author**: Visible to author-facing users and APIs
- **Industry**: Visible to industry-facing users and APIs (`/agent/*`)
- **Internal**: May be stored but must never be exposed to authors

---

### 4.1 Field-Level Visibility (Core Objects)

#### Object: IndustryDecision

| Field | Author | Industry | Notes |
|---|:---:|:---:|---|
| id | N | Y | Industry-only identifier |
| storygateSubmissionId | N | Y | Industry linkage only |
| industryUserId | N | Y | Never expose reviewer identity by default |
| agencyOrgId | N | Y | Industry-only org context |
| decisionScope (USER/ORG) | N | Y | Industry-only |
| status (pipeline) | N | Y | Pipeline status is industry-only |
| reasonCode | N | Y | Internal rationale; never shown to authors |
| internalNotes | N | Y | Hard ban from author DTO |
| internalTags | N | Y | Hard ban from author DTO |
| assignedToIndustryUserId | N | Y | Assignment never exposed |
| decisionedAt | N | Y | Industry audit |
| supersedesDecisionId | N | Y | Industry audit |
| createdAt / updatedAt | N | Y | Industry audit |

---

#### Object: IndustryMessage

| Field | Author | Industry | Notes |
|---|:---:|:---:|---|
| id | N | Y | Industry identifier |
| storygateSubmissionId | Y* | Y | Author may see message under their submission context |
| fromIndustryUserId | N | Y | Do not expose by default |
| toAuthorUserId | N | Y | Author identity implicit; not required in author DTO |
| templateId | N | Y | Never expose templates to authors |
| subject | Y | Y | Authors see subject |
| body | Y | Y | Authors see body |
| sentAt | Y | Y | Authors see sent timestamp |
| deliveryStatus | N | Y | Industry operational field |

*Note: storygateSubmissionId is not typically shown as a field; the author sees the message within their submission view.

---

#### Object: ResponseTemplate

| Field | Author | Industry | Notes |
|---|:---:|:---:|---|
| id | N | Y | Industry-only |
| agencyOrgId | N | Y | Industry-only |
| industryUserId | N | Y | Industry-only |
| name | N | Y | Industry-only |
| type | N | Y | Canon-controlled classification |
| subject | N | Y | Never expose templates |
| body | N | Y | Never expose templates |
| isActive | N | Y | Industry-only |
| createdAt / updatedAt | N | Y | Industry-only |

---

#### Object: Agent Inbox Row DTO

| Field | Author | Industry | Notes |
|---|:---:|:---:|---|
| submissionId | Y | Y | Shared identifier |
| projectTitle | Y | Y | Shared |
| authorDisplayName | Y** | Y | Author sees self; industry sees author |
| workTypeUi | Y | Y | Shared |
| genre | Y | Y | Shared |
| length | Y | Y | Shared |
| submittedAt | Y | Y | Shared |
| pipelineStatus | N | Y | Industry-only |
| authorStatus (mapped) | Y | N | Author-only mapped subset |
| internalTags | N | Y | Hard ban from author |
| keySignalBadge | N*** | Y | Default: industry-only; optionally show generic "Evaluation Type" to author later |
| assignedTo | N | Y | Industry-only |

**Notes:**
- ** authorDisplayName in author UI is "You" contextually; do not expose identity fields beyond normal author profile conventions.
- *** If ever surfaced to authors, must be carefully framed (non-gating, non-predictive) and policy-family safe.

---

### 4.2 Required Automated Tests (Visibility)

- Author endpoints must assert absence of: `internalNotes`, `internalTags`, `reasonCode`, `assignedToIndustryUserId`, `decisionScope`, `pipelineStatus`, `templateId`
- Industry endpoints must require INDUSTRY_* roles and may include the above fields
- DTO shaping must be schema-driven, not UI-driven (server-enforced)