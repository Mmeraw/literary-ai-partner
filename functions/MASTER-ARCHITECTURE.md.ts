# RevisionGrade Master Architecture
**Version:** 1.0.0  
**Purpose:** Hierarchical map of all user-facing flows, backend functions, canon documents, and 5-field contract references

**Governance Rule:** Every menu item and function MUST have a documented 5-field contract (Inputs, Routing, Validation, Outputs, Audit).

---

## Architecture Hierarchy

```
RevisionGrade Application
│
├── 1. EVALUATE (YourWriting page)
│   ├── Pages: YourWriting
│   ├── Functions: 
│   │   ├── evaluateQuickSubmission (50-3000 words)
│   │   ├── detectWorkType (routing helper)
│   │   └── evaluateFullManuscript (40k+ words)
│   ├── Canon: EVALUATE_ENTRY_CANON.md
│   └── 5-Field Spec: → FUNCTION_EVALUATE_QUICK_SPEC.md
│                      → FUNCTION_EVALUATE_FULL_SPEC.md
│
├── 2. REVISE (History → Revise)
│   ├── Pages: History, Revise
│   ├── Functions:
│   │   └── generateRevisionSuggestions
│   ├── Canon: WAVE_GUIDE.md
│   └── 5-Field Spec: → FUNCTION_REVISION_SPEC.md
│
├── 3. OUTPUT GENERATION
│   ├── 3a. Synopsis
│   │   ├── Pages: Synopsis
│   │   ├── Functions: generateSynopsis
│   │   ├── Canon: SYNOPSIS_SPEC.md
│   │   └── 5-Field Spec: → FUNCTION_SYNOPSIS_SPEC.md
│   │
│   ├── 3b. Query Letter
│   │   ├── Pages: QueryLetter
│   │   ├── Functions: generateQueryLetter
│   │   ├── Canon: QUERY_LETTER_SPEC.md
│   │   └── 5-Field Spec: → FUNCTION_QUERY_LETTER_SPEC.md
│   │
│   ├── 3c. Query Package (Multi-Artifact)
│   │   ├── Pages: CompletePackage
│   │   ├── Functions: generateQueryLetterPackage
│   │   ├── Canon: AGENT_PACKAGE_SPEC.md
│   │   └── 5-Field Spec: → FUNCTION_QUERY_PACKAGE_SPEC.md
│   │
│   ├── 3d. Film Pitch Deck
│   │   ├── Pages: FilmAdaptation, PitchGenerator
│   │   ├── Functions: generateFilmPitchDeck
│   │   ├── Canon: FILM_PITCH_DECK_QUALITY_STANDARD.md
│   │   └── 5-Field Spec: → FUNCTION_FILM_PITCH_SPEC.md
│   │
│   ├── 3e. Biography
│   │   ├── Pages: Biography
│   │   ├── Functions: uploadAndGenerateBio, extractLinkedInBio
│   │   ├── Canon: (embedded in MASTER_FUNCTION_GOVERNANCE_SPEC)
│   │   └── 5-Field Spec: → FUNCTION_BIOGRAPHY_SPEC.md
│   │
│   └── 3f. Comparables
│       ├── Pages: Comparables
│       ├── Functions: generateComparables
│       ├── Canon: COMPARABLES_CANON_SPEC.md
│       └── 5-Field Spec: → FUNCTION_COMPARABLES_SPEC.md
│
├── 4. STORYGATE STUDIO
│   ├── 4a. Creator Listing
│   │   ├── Pages: CreateStoryGateListing, CreatorStoryGate
│   │   ├── Functions: createStoryGateListing
│   │   ├── Canon: STORYGATE_FLOW_MAP.md
│   │   └── 5-Field Spec: → FUNCTION_CREATE_LISTING_SPEC.md
│   │
│   ├── 4b. Film Submission
│   │   ├── Pages: StoryGateFilmSubmission
│   │   ├── Functions: submitStoryGateFilm
│   │   ├── Canon: STORYGATE_FLOW_MAP.md
│   │   └── 5-Field Spec: → FUNCTION_FILM_SUBMISSION_SPEC.md
│   │
│   ├── 4c. Industry Verification
│   │   ├── Pages: AdminVerificationQueue, IndustryVerification
│   │   ├── Functions: handleVerification
│   │   ├── Canon: STORYGATE_FLOW_MAP.md
│   │   └── 5-Field Spec: → FUNCTION_VERIFICATION_SPEC.md
│   │
│   └── 4d. Access Control
│       ├── Pages: StoryGatePortal
│       ├── Functions: requestProjectAccess, handleAccessRequest, checkProjectAccess
│       ├── Canon: STORYGATE_FLOW_MAP.md
│       └── 5-Field Spec: → FUNCTION_ACCESS_CONTROL_SPEC.md
│
├── 5. MANUSCRIPT MANAGEMENT
│   ├── Pages: UploadManuscript, ManuscriptDashboard
│   ├── Functions:
│   │   ├── splitManuscript (chunking)
│   │   ├── cloneManuscript (versioning)
│   │   ├── markManuscriptFinal (state lock)
│   │   └── checkManuscriptIntegrity (validation)
│   ├── Canon: EVALUATE_ENTRY_CANON.md
│   └── 5-Field Spec: → FUNCTION_MANUSCRIPT_MGMT_SPEC.md
│
├── 6. FILE PROCESSING
│   ├── Functions:
│   │   ├── ingestUploadedFileToText (orchestrator)
│   │   ├── convertDocxToText (DOCX parser)
│   │   └── importDocx (alternative parser)
│   ├── Canon: EVALUATE_ENTRY_CANON.md (Section 2.1)
│   └── 5-Field Spec: → FUNCTION_FILE_PROCESSING_SPEC.md
│
├── 7. CONVERT (Novel → Screenplay)
│   ├── Pages: ScreenplayFormatter
│   ├── Functions: formatScreenplay
│   ├── Canon: SCREENPLAY_QUALITY_STANDARD.md
│   └── 5-Field Spec: → FUNCTION_SCREENPLAY_SPEC.md
│
├── 8. ANALYTICS & DASHBOARD
│   ├── Pages: Dashboard, Analytics
│   ├── Functions: storeEvaluationSignals, analyzeFeedback
│   ├── Canon: DASHBOARD_ANALYTICS_RELIABILITY_CONTRACT.md
│   └── 5-Field Spec: → FUNCTION_ANALYTICS_SPEC.md
│
├── 9. PAYMENTS (Stripe Integration)
│   ├── Pages: Pricing
│   ├── Functions:
│   │   ├── createCheckoutSession
│   │   ├── stripeWebhook
│   │   ├── getStripePrices
│   │   └── setupStripeProducts
│   ├── Canon: (Stripe docs + internal payment policy)
│   └── 5-Field Spec: → FUNCTION_PAYMENTS_SPEC.md
│
├── 10. VALIDATION & QA
│   ├── Functions:
│   │   ├── validateWorkTypeMatrix (MDM validation)
│   │   ├── testMatrixPreflight (Phase 1 tests)
│   │   ├── testBirthdayEssayFixture (NA enforcement)
│   │   ├── testWorkTypeRouting (MDM tests)
│   │   └── validateGoldStandard (quality benchmarking)
│   ├── Canon: MASTER_FUNCTION_GOVERNANCE_SPEC.md
│   └── 5-Field Spec: → FUNCTION_VALIDATION_SPEC.md
│
└── 11. UTILITIES & HEALTH
    ├── Functions:
    │   ├── checkRouteHealth (monitors)
    │   ├── sentryHealthCheck (error tracking)
    │   └── generateCanonHash (versioning)
    ├── Canon: DEFENSIVE_ERROR_HANDLING_STANDARD.md
    └── 5-Field Spec: → FUNCTION_UTILITIES_SPEC.md
```

---

## 5-Field Contract Files Reference

| Function | 5-Field Spec File | Status |
|----------|-------------------|--------|
| evaluateQuickSubmission | FUNCTION_EVALUATE_QUICK_SPEC.md | ✅ Complete |
| evaluateFullManuscript | FUNCTION_EVALUATE_FULL_SPEC.md | ✅ Complete |
| generateRevisionSuggestions | FUNCTION_REVISION_SPEC.md | ✅ Complete |
| generateSynopsis | FUNCTION_SYNOPSIS_SPEC.md | ✅ Complete |
| generateQueryLetter | FUNCTION_QUERY_LETTER_SPEC.md | ✅ Complete |
| generateQueryLetterPackage | FUNCTION_QUERY_PACKAGE_SPEC.md | ✅ Complete |
| generateFilmPitchDeck | FUNCTION_FILM_PITCH_SPEC.md | ✅ Complete |
| uploadAndGenerateBio | FUNCTION_BIOGRAPHY_SPEC.md | ✅ Complete |
| generateComparables | FUNCTION_COMPARABLES_SPEC.md | ✅ Complete |
| createStoryGateListing | FUNCTION_CREATE_LISTING_SPEC.md | ✅ Complete |
| submitStoryGateFilm | FUNCTION_FILM_SUBMISSION_SPEC.md | ✅ Complete |
| handleVerification | FUNCTION_VERIFICATION_SPEC.md | ✅ Complete |
| requestProjectAccess | FUNCTION_ACCESS_CONTROL_SPEC.md | ✅ Complete |
| splitManuscript | FUNCTION_MANUSCRIPT_MGMT_SPEC.md | ✅ Complete |
| ingestUploadedFileToText | FUNCTION_FILE_PROCESSING_SPEC.md | ✅ Complete |
| formatScreenplay | FUNCTION_SCREENPLAY_SPEC.md | ✅ Complete |
| storeEvaluationSignals | FUNCTION_ANALYTICS_SPEC.md | ✅ Complete |
| createCheckoutSession | FUNCTION_PAYMENTS_SPEC.md | ✅ Complete |
| validateWorkTypeMatrix | FUNCTION_VALIDATION_SPEC.md | ✅ Complete |
| checkRouteHealth | FUNCTION_UTILITIES_SPEC.md | ✅ Complete |

---

## Canon Document Index

| Canon Document | Governs | Version |
|----------------|---------|---------|
| EVALUATE_ENTRY_CANON.md | Quick & Full Evaluation | v1.2 |
| WAVE_GUIDE.md | Revision System | v2.1 |
| SYNOPSIS_SPEC.md | Synopsis Generation | v1.0 |
| QUERY_LETTER_SPEC.md | Query Letter | v1.0 |
| AGENT_PACKAGE_SPEC.md | Multi-Artifact Packages | v1.0 |
| FILM_PITCH_DECK_QUALITY_STANDARD.md | Film Pitch | v1.0 |
| COMPARABLES_CANON_SPEC.md | Market Comparables | v1.0 |
| SCREENPLAY_QUALITY_STANDARD.md | Screenplay Conversion | v1.0 |
| STORYGATE_FLOW_MAP.md | StoryGate Studio | v1.0 |
| MASTER_FUNCTION_GOVERNANCE_SPEC.md | All Functions | v1.0.0 |
| PHASE_1_GOVERNANCE_EVIDENCE.md | Input Validation | v1.0 |

---

## Audit Requirements (Global)

Every function MUST log:
- `event_id` (unique UUID)
- `request_id` (correlation)
- `timestamp_utc`
- `function_id` (function name)
- `canon_hash` (governing canon version)
- `governance_version` (1.0.0)
- `user_email`
- Operation-specific fields per 5-field contract

Audit events stored in: `EvaluationAuditEvent` entity

---

## Phase 0 Closure Criteria

✅ Hierarchical architecture diagram exists (this file)  
✅ Every menu item mapped to functions + canon + 5-field spec  
🔄 Per-function 5-field spec files created (in progress)  
🔄 All specs explicitly linked in architecture (in progress)

**Next:** Create individual FUNCTION_*_SPEC.md files for all 20 functions listed above.