# Runtime Conformance Audit — SIPOC/FIPOC vs Runtime

> **Status:** first-pass static audit  
> **Date:** 2026-06-11  
> **Scope:** Evaluation, Revise, Agent Readiness, Storygate  
> **Purpose:** identify where runtime behavior is proven, partial, missing-critical, or not yet proven against executable governance registries.

---

## Audit Method

This audit compares the executable registries against current runtime/code surfaces.

Sources:

- `lib/evaluation/fipocRegistry.ts`
- `lib/revision/reviseRegistry.ts`
- `lib/agent-readiness/agentReadinessRegistry.ts`
- `lib/storygate/storygateRegistry.ts`
- App Router surfaces under `app/**`
- Runtime libraries under `lib/**`
- Generated CSV mirrors under `docs/registries/**`

This is a **static conformance audit**, not a live integration test. A `PASS` here means the registry marks the stage proven/ok and a current runtime/code surface exists. Full production certification still requires runtime tests with real persistence, validators, state transitions, and failure paths.

Classification:

| Status | Meaning |
|--------|---------|
| `PASS` | Runtime/code surface exists and registry marks stage proven/ok. |
| `PARTIAL` | Runtime/code surface exists, but conformance is incomplete, emerging, or gap-marked. |
| `MISSING_CRITICAL` | Runtime, persistence, validation, or enforcement is missing or explicitly critical. |
| `NOT_PROVEN` | Surface exists or is referenced, but conformance evidence is insufficient. |

---

## Executive Summary

| Factory | Governance Structure | Runtime Conformance Summary | Highest Risk |
|---------|----------------------|-----------------------------|--------------|
| Evaluation | Registry-described with executable FIPOC | Strongest runtime footprint, but several high-risk/critical seams remain around synthesis, normalization, author exposure, renderer parity, and adjacent long-form governance. | Author exposure and EvaluationResultV2/runtime renderer parity. |
| Revise | Registry-described with executable SIPOC/FIPOC | Core queue/generation/ledger surfaces exist; completion certification remains missing-critical. | RS08 completion certification. |
| Agent Readiness | Registry-described with executable SIPOC/FIPOC | Generation and quality gate are strong; persistence/approval/completeness/history are critical gaps. | Approval persistence and export/completeness enforcement. |
| Storygate | Registry-described with executable SIPOC/FIPOC | Public preparation/eligibility surfaces exist; current-canon submission, access, verification, controlled viewing, and audit runtime are mostly missing-critical. | Runtime does not yet enforce Storygate access-control doctrine. |

---

## Evaluation Runtime Conformance Matrix

| Registry Stage | Runtime Route / Code | Persistence | Validation | Status | Notes |
|----------------|----------------------|-------------|------------|--------|-------|
| `ADJACENT_PHASE_0` Phase 0 Authority Binding | `lib/evaluation/phase-architecture-v2/phase0AuthorityProof.ts` | Not proven | Declared/library-level | `PARTIAL` | Governance authority proof exists, but runtime enforcement remains emerging/gap. |
| `ADJACENT_PHASE_0_5A` Story Seeds and Full Context Story Ledger | `lib/evaluation/phase-architecture-v2/phase05aStoryMapSeed.ts`, `lib/evaluation/seed/semanticSeedGenerator.ts` | Not proven | Declared/library-level | `PARTIAL` | Seed generation surfaces exist; full persisted conformance not proven. |
| `ADJACENT_PHASE_0_5B` Revise Opportunity Seed | `lib/evaluation/phase-architecture-v2/phase05bReviseOpportunitySeed.ts` | Not proven | Declared/library-level | `PARTIAL` | Runtime library exists; downstream handoff proof remains partial. |
| `ADJACENT_SEED_COMPLETENESS_GATE` Seed Completeness Gate | `lib/evaluation/seed/seedCompletenessGuard.ts`, `lib/evaluation/seed/phase1aSeedRuntimeGate.ts` | Not applicable / not proven | Evidence | `PARTIAL` | Guard code exists; registry still marks emerging/gap. |
| `S01_INTAKE` Intake | `app/api/jobs/route.ts`, `app/api/evaluate/route.ts` | Evidence | Evidence | `PARTIAL` | Intake routes create jobs/manuscripts but registry remains partial/gap. |
| `S02_QUEUE` Queue | `lib/jobs/store.ts`, `lib/jobs/jobStore.supabase.ts` | Evidence | Evidence | `PASS` | Registry marks proven/ok. |
| `S03_CLAIM` Atomic Claim | `app/api/workers/process-evaluations/route.ts`, `lib/jobs/jobStore.supabase.ts` | Evidence | Evidence | `PASS` | Registry marks proven/ok; atomic claim has runtime surface. |
| `S04_ROUTING_CHUNKING` Routing and Chunking | `lib/manuscripts/chunking.ts`, `lib/evaluation/processor.ts` | Not proven | Evidence | `PARTIAL` | Runtime exists but registry remains emerging/gap. |
| `S05_PASS1` Pass 1 Extraction | `lib/evaluation/pipeline/runPipeline.ts`, `lib/evaluation/pipeline/runPass1.ts` | Not proven | Evidence | `PARTIAL` | Runtime exists; pass conformance not fully proven. |
| `ADJACENT_SEMANTIC_GATE` Story Layer Quality Gate | `lib/evaluation/phase1a/buildLedgerQualityReport.ts` | Not proven | Evidence | `MISSING_CRITICAL` | Registry marks critical. |
| `ADJACENT_REVIEW_GATE` Review Gate | `lib/evaluation/processor.ts`, `lib/evaluation/review-gate/storyLedgerApprovalNormalizer.ts` | Not proven | Evidence | `MISSING_CRITICAL` | Registry marks critical. |
| `S06_PASS2` Pass 2 Craft Diagnosis | `lib/evaluation/pipeline/runPipeline.ts`, `lib/evaluation/pipeline/runPass2.ts`, `lib/evaluation/pipeline/pass2IndependenceGuard.ts` | Not proven | Evidence | `PARTIAL` | Runtime and independence guard exist; still partial/gap. |
| `S06b_HANDOFF_GATE` Pass 1/2 Handoff Gate | `lib/evaluation/pipeline/pass12HandoffGate.ts` | Not proven | Evidence | `PARTIAL` | Guard exists; conformance emerging/gap. |
| `S07_PASS3` Pass 3 Synthesis | `lib/evaluation/pipeline/runPipeline.ts`, `lib/evaluation/pipeline/runPass3Synthesis.ts` | Not proven | Evidence | `MISSING_CRITICAL` | Registry marks high_risk/critical. |
| `S08_ER2_NORMALIZATION` EvaluationResultV2 Normalization | `lib/evaluation/pipeline/runPipeline.ts`, `schemas/evaluation-result-v2.ts` | Not proven | Evidence | `MISSING_CRITICAL` | Schema exists; registry marks high_risk/critical. |
| `S09_QUALITYGATEV2` QualityGateV2 | `lib/evaluation/pipeline/qualityGate.ts` | Not applicable / not proven | Evidence | `PARTIAL` | Runtime gate exists; registry partial/gap. |
| `S10_PERSISTENCE` Atomic Evaluation Persistence | `lib/evaluation/persistEvaluationResultV2.ts` | Evidence | Evidence | `PARTIAL` | Persistence surface exists but registry partial/gap. |
| `ADJACENT_WAVE` WAVE Revision Planning | `lib/evaluation/waveRevision.ts`, `lib/revision/wavePlanner.ts`, `lib/revision/waveRegistry.ts` | Not proven | Evidence | `PARTIAL` | Active partial/gap. |
| `ADJACENT_CANON_GOVERNANCE` Gate 15 / Canon Metadata | `lib/evaluation/canonGovernanceRunner.ts`, `lib/evaluation/gate15/**`, `lib/evaluation/goldenSpine/**`, `lib/evaluation/dialogueCanon/**` | Not proven | Evidence | `MISSING_CRITICAL` | Active partial/critical. |
| `ADJACENT_DREAM` DREAM Long-Form Synthesis | `app/api/workers/process-dream/route.ts`, `lib/evaluation/pipeline/runPass3bLongform.ts` | Evidence | Evidence | `MISSING_CRITICAL` | Active partial/critical. |
| `ADJACENT_FINAL_EXTERNAL_AUDIT` Final External Audit | `lib/evaluation/pipeline/finalExternalAudit.ts`, `app/api/workers/process-dream/route.ts` | Not proven | Evidence | `MISSING_CRITICAL` | Active partial/critical. |
| `S10b_PHASE5_AUTHOR_EXPOSURE_GATE` Phase 5 Author Exposure Gate | planned: `lib/evaluation/authorExposureCertification.ts` | Missing | Missing | `MISSING_CRITICAL` | Planned-only critical gate. |
| `S11a_RENDERER_WEBPAGE` Webpage Renderer | `app/reports/[jobId]/page.tsx`, `app/evaluate/[jobId]/page.tsx` | Evidence/read path | Not fully proven | `MISSING_CRITICAL` | Renderer exists but registry marks partial/critical. |
| `S11b_DOWNLOAD_PIPELINE` Download Pipeline | `app/api/reports/[jobId]/download/route.ts`, sanitizer/parity gate libs | Evidence/read path | Evidence | `PARTIAL` | Emerging/gap. |
| `ADJACENT_REVISION_LEDGER` Revision Opportunity Ledger | `lib/revision/opportunityLedger.ts`, `lib/evaluation/processor.ts` | Evidence/not fully proven | Evidence | `PARTIAL` | Emerging/gap. |
| `ADJACENT_REVISE` Revise Queue Admission | Revise Queue admission handler | Not proven | Not proven | `PARTIAL` | Handler not concretely mapped in registry extraction. |

---

## Revise Runtime Conformance Matrix

| Registry Stage | Runtime Route / Code | Persistence | Validation | Status | Notes |
|----------------|----------------------|-------------|------------|--------|-------|
| `RS01_LEDGER_ASSEMBLY` Revision Opportunity Ledger Assembly | `lib/revision/opportunityLedger.ts`, `lib/revision/revisionOpportunityLedgerArtifact.ts`, `lib/revision/normalizeFindings.ts` | Evidence/not fully proven | Evidence | `PARTIAL` | Runtime exists; registry partial/gap. |
| `RS02_QUEUE_ADMISSION` Queue Admission Gate | `lib/revision/reviseAdmissionGate.ts`, `lib/revision/reviseCardContract.ts`, candidate/canon/voice gates | Not proven | Evidence | `PARTIAL` | Admission validators exist; registry partial/emerging. |
| `RS03_QUEUE_PRIORITIZATION` Queue Prioritization and Assembly | `lib/revision/workbenchQueue.ts`, `app/revise/page.tsx`, `app/api/revise/reset-queue/route.ts` | Evidence/not fully proven | Evidence/declared | `PARTIAL` | Runtime exists; emerging. |
| `RS04_WORKBENCH_LOAD` Workbench Evidence Load | `lib/revision/workbenchQueue.ts`, `lib/revision/revisionPackage.ts`, `app/revise/page.tsx` | Evidence/read path | Evidence/declared | `PARTIAL` | Runtime exists; emerging. |
| `RS05_CANDIDATE_GENERATION` A/B/C Candidate Generation | `app/api/revise/generate-rewrite/route.ts`, `lib/revision/run-revision-pipeline.ts`, orchestrator/proposal libs | Evidence/not fully proven | Evidence | `PARTIAL` | Runtime exists; partial/emerging. |
| `RS06_AUTHOR_DECISION` Author Decision Capture | `app/revise/page.tsx`, `lib/revision/ledger.ts` | Evidence/not fully proven | Evidence/declared | `PARTIAL` | Runtime exists; persistence semantics need conformance tests. |
| `RS07_LEDGER_SYNC` Revision Ledger Sync | `lib/revision/ledger.ts`, `lib/revision/logRevisionEvent.ts`, `lib/revision/persistence/log-governance-event.ts` | Evidence | Evidence/declared | `PARTIAL` | Runtime exists; registry partial/gap. |
| `RS08_COMPLETION` Revision Completion Certification | planned: `lib/revision/completionCertification.ts`, `lib/revision/engine.ts` | Missing/partial | Missing | `MISSING_CRITICAL` | Explicit missing-critical completion certification seam. |
| `RS09_CROSSCHECK_VERIFICATION` Repair Cross-Check Verification | `lib/revision/repairCrossCheck.ts`, `lib/revision/trustedPath.ts` | Evidence | Evidence | `PARTIAL` | Runtime exists; partial/emerging. |
| `RS10_TRUSTEDPATH` TrustedPath Auto-Apply | `lib/revision/trustedPath.ts`, `lib/revision/repairCrossCheck.ts`, `app/api/revise/trusted-path/route.ts` | Evidence | Evidence | `PARTIAL` | Runtime exists; partial/emerging. |

---

## Agent Readiness Runtime Conformance Matrix

| Registry Stage | Runtime Route / Code | Persistence | Validation | Status | Notes |
|----------------|----------------------|-------------|------------|--------|-------|
| `AR01_MANUSCRIPT_ELIGIBILITY` Manuscript Eligibility Gate | `app/agent-readiness/page.tsx`, `lib/dashboard/getDashboardEvaluations.ts` | Evidence/read path | Evidence | `PASS` | Registry proven/ok. |
| `AR02_SECTION_GENERATION` Section Generation (AI) | `app/api/agent-readiness/generate/route.ts`, `app/api/agent-readiness/generate-all/route.ts` | Evidence | Evidence | `PASS` | Registry proven/ok. |
| `AR03_QUALITY_GATE` Section Quality Gate | `app/api/agent-readiness/generate/route.ts` | Not applicable | Evidence | `PASS` | Registry proven/ok. |
| `AR04_SECTION_PERSISTENCE` Section Persistence | `app/api/agent-readiness/generate/route.ts` | Broken/non-fatal DB error path | Evidence | `MISSING_CRITICAL` | Registry documents DB write failure as non-fatal. |
| `AR05_AUTHOR_REVIEW` Author Review & Section Approval | section pages and `AgentReadinessClient.tsx` | Missing approval persistence | UI/client only | `MISSING_CRITICAL` | Approve is not persisted to DB. |
| `AR06_COMPLETENESS_CHECK` Package Completeness Check | `app/agent-readiness/page.tsx`, `AgentReadinessClient.tsx` | Missing/DB cannot prove approval | Client-state only | `MISSING_CRITICAL` | DB-approved path cannot become true because approval is not persisted. |
| `AR07_BATCH_GENERATION` Batch Section Generation | `app/api/agent-readiness/generate-all/route.ts` | Evidence per section | Evidence | `PASS` | Registry proven/ok. |
| `AR08_EXPORT` Package Export | `app/api/agent-readiness/download/route.ts`, `AgentReadinessClient.tsx` | Stateless/no package record | Partial | `PARTIAL` | API does not enforce all sections or approval. |
| `AR09_HISTORY` Package History | `app/agent-readiness/history/page.tsx` | Missing package history persistence | Missing | `MISSING_CRITICAL` | Placeholder/planned-required. |

---

## Storygate Runtime Conformance Matrix

| Registry Stage | Runtime Route / Code | Persistence | Validation | Status | Notes |
|----------------|----------------------|-------------|------------|--------|-------|
| `SG01_CREATOR_SUBMISSION` Creator Submission Entry | `app/storygate-studio/page.tsx`, `app/storygate-studio/apply/page.tsx`, `app/storygate-studio/faq/page.tsx` | Missing current-canon submission persistence | Copy-level only | `PARTIAL` | Public preparation surfaces exist; durable submission path not certified. |
| `SG02_INTAKE_VALIDATION` Submission Intake Validation | `app/storygate-studio/apply/page.tsx`, canon docs | Missing centralized validator | Missing | `MISSING_CRITICAL` | Current-canon package validator is required. |
| `SG03_INTERNAL_SCREENING` Internal Screening | canon docs only | Missing | Missing | `MISSING_CRITICAL` | No current-canon screening route/persistence proven. |
| `SG04_TIER_ASSIGNMENT` Tier Assignment | SIPOC docs only | Missing | Missing | `MISSING_CRITICAL` | No persisted tier/audit evidence. |
| `SG05_PACKAGE_VERIFICATION` Professional Package Verification | public Storygate pages | Missing server-side package gate | Copy-level only | `PARTIAL` | 11-field package is locked in governance, but runtime validator remains missing. |
| `SG06_READINESS_VERIFICATION` Storygate Readiness Verification | public Storygate pages | Missing/partial | Copy-level only | `PARTIAL` | 9.0 threshold is stated and guarded, but runtime enforcement is not certified. |
| `SG07_INDUSTRY_VERIFICATION` Industry Verification Gate | `app/storygate-studio/industry/page.tsx`, dashboard shell | Missing/partial | Missing server enforcement | `MISSING_CRITICAL` | Sign-in/request shell exists; verified-state enforcement not proven. |
| `SG08_LISTING_ACTIVATION` Storygate Listing Activation | canon docs only | Missing | Missing | `MISSING_CRITICAL` | No current-canon activation route/persistence certified. |
| `SG09_ACCESS_REQUEST` Industry Access Request | SIPOC docs only | Missing | Missing | `MISSING_CRITICAL` | No concrete route/persistence proven. |
| `SG10_CREATOR_ADMIN_APPROVAL` Creator/Admin Access Approval | SIPOC docs only | Missing | Missing | `MISSING_CRITICAL` | Core protection missing until creator/admin approval persists and gates access. |
| `SG11_CONTROLLED_ACCESS` Controlled Access and Viewing | SIPOC docs only | Missing | Missing | `MISSING_CRITICAL` | No controlled viewing authorization route certified. |
| `SG12_ACCESS_LOGGING_REVOCATION` Access Logging, Audit, and Revocation | SIPOC docs only | Missing | Missing | `MISSING_CRITICAL` | Structured append-only audit/revocation persistence missing. |

---

## Highest-Priority Runtime Conformance Work

1. **Storygate runtime enforcement**
   - Build current-canon submission persistence.
   - Implement centralized 11-field package validator.
   - Implement 9.0/equivalent readiness verification.
   - Implement industry verification, listing activation, access requests, creator/admin approval, controlled viewing, audit, and revocation.

2. **Agent Readiness approval/completeness enforcement**
   - Persist section approval.
   - Require all canonical sections approved before export.
   - Persist package history/export records.
   - Treat DB persistence failure as a 500-class failure rather than returning generated content as if saved.

3. **Revise completion certification**
   - Implement/prove `RS08_COMPLETION` so Revise can certify completion before downstream handoff.

4. **Evaluation author-exposure and renderer parity**
   - Implement/prove `S10b_PHASE5_AUTHOR_EXPOSURE_GATE`.
   - Prove `S11a_RENDERER_WEBPAGE` consumes canonical persisted evaluation artifacts without recalculation or drift.

---

## Conclusion

The four factories now have governance structures. The next risk is not primarily registry drift; it is runtime conformance.

The platform should not claim a factory is SIPOC-enforced until every stage has:

- a concrete runtime surface,
- durable persistence where required,
- explicit validation and backward-kick behavior,
- canonical state transitions,
- test evidence for success and failure paths,
- and no UI simulation standing in for persisted state.
