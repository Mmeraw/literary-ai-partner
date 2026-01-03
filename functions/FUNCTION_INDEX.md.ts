# FUNCTION INDEX (AUTHORITATIVE REGISTRY)

**Status:** CANON / BINDING  
**Purpose:** Authoritative mapping of platform surfaces to governing documents  
**Enforcement:** CI must fail on unindexed canon files  
**Last Updated:** 2026-01-03

---

## GOVERNANCE RULES

1. **All binding canon MUST be reachable from this index**
2. **If a file is not listed here, it CANNOT direct runtime behavior**
3. **Function bundles are closed sets—nothing else applies**
4. **Platform standards are inherited by all functions**
5. **CI MUST fail builds if canon files exist outside this index**

---

## PLATFORM STANDARDS (INHERITED BY ALL FUNCTIONS)

These apply universally and override function-specific rules when conflicts arise:

- `MULTI_MODEL_GOVERNANCE_STANDARD.md` (status: canon)
- `DEFENSIVE_ENGINEERING_STANDARD.md` (status: canon)
- `DEFENSIVE_ERROR_HANDLING_STANDARD.md` (status: canon)
- `SLUR_GOVERNANCE_DOC.md` (status: canon)
- `PSC_DETECTION_GUIDE.md` (status: canon)
- `VOICE_PRESERVATION_CANON.md` (status: canon)

**Precedence:** Platform standards > Function canon > Governance addenda > Reference

---

## FUNCTION 1: EVALUATE

**Status:** ACTIVE  
**Surface:** YourWriting page, UploadManuscript page  
**Description:** Unified evaluation entry with auto-detection, dual-pipeline routing, and gated revision

### Canon Bundle (CLOSED SET)
- `EVALUATE_ENTRY_CANON.md` (status: canon)
- `EVALUATE_GOVERNANCE_ADDENDUM.md` (status: governance)
- `EVALUATE_RULE_VALIDATOR_SLA_MAP.md` (status: governance)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (status: governance)
- `EVALUATE_QA_CHECKLIST.md` (status: governance)
- `13_STORY_CRITERIA.md` (status: canon)
- `WAVE_GUIDE.md` (status: canon)
- `STORY_ARCHITECTURE_GUIDE.md` (status: canon)
- `TRANSGRESSIVE_MODE_SPEC.md` (status: canon)

### Runtime Touchpoints
- `pages/YourWriting.js`
- `pages/UploadManuscript.js`
- `functions/evaluateQuickSubmission.js`
- `functions/evaluateFullManuscript.js`
- `functions/evaluateThirteenCriteria.js`
- `functions/evaluateSpine.js`
- `functions/evaluateWaveFlags.js`
- `functions/splitManuscript.js`

### Known Gaps
- SLA metrics not yet emitted at runtime
- Validator gates exist in spec but not fully wired end-to-end
- Incident logging schema defined but not universally implemented
- Detection correctness validator not mechanically enforced

---

## FUNCTION 2: SCREENPLAY

**Status:** ACTIVE  
**Surface:** ScreenplayFormatter page  
**Description:** Prose-to-screenplay translation with WriterDuet mode compliance

### Canon Bundle (CLOSED SET)
- `SCREENPLAY_QUALITY_STANDARD_CANON.md` (status: canon)
- `SCREENPLAY_GOVERNANCE_ADDENDUM.md` (status: governance)
- `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md` (status: governance)
- `SCREENPLAY_INCIDENT_LOG_SCHEMA.md` (status: governance)
- `SCREENPLAY_QA_CHECKLIST_WRITERDUET_MODE.md` (status: governance)
- `WRITERDUET_FORMATTING_STANDARD.md` (status: reference)
- `AI_ROUTING_SPEC.md` (status: governance)

### Runtime Touchpoints
- `pages/ScreenplayFormatter.js`
- `functions/formatScreenplay.js`

### Known Gaps
- **CRITICAL:** Current implementation acts as formatter, not translator (canon violation)
- Does not decompose prose into filmable beats (per canon requirement)
- WriterDuet compliance validators exist but not proven end-to-end
- Hard/soft fail taxonomy not enforced at runtime

---

## FUNCTION 3: WAVE

**Status:** ACTIVE  
**Surface:** Integrated into Evaluate pipeline, Revise page  
**Description:** Proprietary three-tier craft analysis and revision system

### Canon Bundle (CLOSED SET)
- `WAVE_GUIDE.md` (status: canon)
- `WAVE_VALIDATION_SUITE.md` (status: governance)
- `WAVE_TEST_CASES.json` (status: governance)
- `VOICE_PRESERVATION_CANON.md` (status: canon) (inherited from platform)
- `VOICE_REGISTER_SCHEMA.json` (status: reference)

### Runtime Touchpoints
- `functions/evaluateWaveFlags.js`
- `functions/validateWaveLabels.js`
- `functions/testWaveValidation.js`
- `functions/voiceGuard.js`
- `pages/Revise.js`
- `components/revision/*`

### Known Gaps
- Voice preservation enforcement not universally validated
- WAVE scores calculated but SLA compliance not measured
- Test-governed revision exists but not CI-enforced

---

## FUNCTION 4: STORYGATE STUDIO

**Status:** ACTIVE  
**Surface:** StoryGate pages, StorygateStudio page, Industry/Creator portals  
**Description:** Marketplace for discovery, verification, and professional access

### Canon Bundle (CLOSED SET)
- `STORYGATE_FLOW_MAP.md` (status: canon)
- `STORYGATE_STUDIO_DESIGN_SYSTEM.md` (status: reference)

### Runtime Touchpoints
- `pages/StoryGate.js`
- `pages/StorygateStudio.js`
- `pages/CreatorStoryGate.js`
- `pages/IndustryVerification.js`
- `pages/AdminVerificationQueue.js`
- `pages/CreateStoryGateListing.js`
- `functions/submitStoryGateFilm.js`
- `functions/createStoryGateListing.js`
- `functions/handleVerification.js`
- `functions/requestProjectAccess.js`
- `functions/checkProjectAccess.js`
- `functions/handleAccessRequest.js`

### Known Gaps
- **CRITICAL:** Missing governance addendum (precedence, validators, incident schema, QA checklist)
- Verification workflow exists but not governed by formal canon
- Access control implemented but not audited against standards
- No SLA map or quality metrics

---

## FUNCTION 5: OUTPUT GENERATION

**Status:** ACTIVE  
**Surface:** Synopsis, Query, Pitch, Bio, Comparables, CompletePackage pages  
**Description:** Professional submission materials generated from evaluated manuscripts

### Canon Bundle (CLOSED SET)
- `SYNOPSIS_SPEC.json` (status: canon)
- `COMPARABLES_CANON_SPEC.md` (status: canon)
- `FILM_PITCH_DECK_QUALITY_STANDARD.md` (status: canon)

### Runtime Touchpoints
- `pages/Synopsis.js`
- `pages/QueryLetter.js`
- `pages/PitchGenerator.js`
- `pages/Biography.js`
- `pages/Comparables.js`
- `pages/CompletePackage.js`
- `pages/FilmAdaptation.js`
- `functions/generateSynopsis.js`
- `functions/runSynopsisQA.js`
- `functions/generateQueryLetter.js`
- `functions/generateQueryLetterPackage.js`
- `functions/generateQueryPitches.js`
- `functions/generateFilmPitchDeck.js`
- `functions/generateComparables.js`
- `functions/generateCompletePackage.js`
- `functions/prefillPackageFields.js`
- `functions/extractPitchFields.js`
- `functions/applyVoiceAnchorAndSchemaToPitch.js`
- `functions/extractLinkedInBio.js`
- `functions/uploadAndGenerateBio.js`

### Known Gaps
- Query letter canon missing (BASE44_QUERY_LETTER_BUG_REPORT.md exists but not canon)
- No unified governance addendum for all outputs
- QA checklist exists per output but not integrated into single standard
- Pitch quality standard exists but not universally enforced

---

## FUNCTION 6: REVISION

**Status:** ACTIVE  
**Surface:** Revise page, History page, RevisionSession workflow  
**Description:** Guided revision with suggestion generation, feedback, and version control

### Canon Bundle (CLOSED SET)
- `WAVE_GUIDE.md` (status: canon) (shared with WAVE function)
- `VOICE_PRESERVATION_CANON.md` (status: canon) (inherited from platform)

### Runtime Touchpoints
- `pages/Revise.js`
- `pages/History.js`
- `functions/generateRevisionSuggestions.js`
- `functions/generateRevisionSegments.js`
- `functions/approveRevision.js`
- `functions/generateAlternatives.js`
- `components/RevisionViewer.js`
- `components/RevisionControls.js`
- `components/useRevisionFlow.js`
- `components/revision/*`

### Known Gaps
- **CRITICAL:** Missing dedicated revision canon (currently inherits WAVE + Voice)
- No governance addendum for revision workflow
- Suggestion quality metrics not formalized
- Version control implemented but not governed

---

## FUNCTION 7: CONVERT

**Status:** ACTIVE  
**Surface:** ScreenplayFormatter (conversion mode)  
**Description:** Format transformation (prose ↔ screenplay)

### Canon Bundle (CLOSED SET)
- `SCREENPLAY_QUALITY_STANDARD_CANON.md` (status: canon) (shared with SCREENPLAY)
- `WRITERDUET_FORMATTING_STANDARD.md` (status: reference)

### Runtime Touchpoints
- `pages/ScreenplayFormatter.js`
- `functions/formatScreenplay.js`

### Known Gaps
- Convert vs Screenplay function boundary unclear
- No dedicated conversion canon (currently borrows from Screenplay)
- Quality standards not distinct from screenplay evaluation

---

## FUNCTION 8: GOVERNANCE FRAMEWORK

**Status:** ACTIVE (INFRASTRUCTURE)  
**Surface:** Platform-wide (CI, runtime validators, incident logging)  
**Description:** Cross-cutting enforcement, audit, and quality control

### Canon Bundle (CLOSED SET)
- `GOVERNANCE_EXECUTIVE_SUMMARY.md` (status: governance)
- `GOVERNANCE_ENGINEERING_CHECKLIST.md` (status: governance)
- `GOVERNANCE_QA_TEST_MATRIX.md` (status: governance)
- `GOVERNANCE_PR_TEMPLATE.md` (status: governance)
- `GOVERNANCE_JIRA_TICKET_TEMPLATE.md` (status: governance)
- `BASE44_GOVERNANCE_OVERVIEW.md` (status: governance)
- `BASE44_ENGINEERING_QA_SPEC.md` (status: governance)
- `BASE44_IMPLEMENTATION_SPEC.md` (status: governance)
- `BASE44_IMPLEMENTATION_ROADMAP.md` (status: governance)
- `INCIDENT_LOG.md` (status: governance)

### Runtime Touchpoints
- All functions inherit governance requirements
- CI validation (not yet implemented)
- Runtime validators (partially wired)

### Known Gaps
- **CRITICAL:** CI enforcement of this index not yet implemented
- Incident logging schema defined but not universally emitted
- Validator SLA maps exist but not mechanically enforced
- QA test matrix defined but not automated

---

## REFERENCE MATERIALS (NON-BINDING)

These files provide context but do not direct behavior:

- `acceptance_tests.v1.json` (status: reference)
- `severity_policy.v1.json` (status: reference)
- `slur_lexicon.v1.json` (status: reference)
- `toadstone_gold.v1.json` (status: reference)
- `toadstone_gold_slur.v1.json` (status: reference)
- `TOADSTONE_POWER_OF_BELIEF.md` (status: reference)
- `voice_rules.v1.json` (status: reference)
- `voice_training_batch_*.json` (status: reference)
- `SMILE_LEXICON.md` (status: reference)

---

## TEST SUITES (NON-CANON BUT GOVERNED)

- `WAVE_TEST_CASES.json` (status: governance)
- `functions/testWaveValidation.js` (status: governance)
- `functions/validateGoldStandard.js` (status: governance)

---

## DEPRECATED / STALE FILES

Files that exist but should not direct behavior:

- `evaluateFullManuscript_BACKUP_20251230.js` (status: deprecated)
- Any unlisted `.md` files in functions/ (status: draft unless indexed)

---

## ENFORCEMENT RULES

### CI Requirements (MUST IMPLEMENT)
1. **Fail build if any file declares `status: canon` but is not indexed here**
2. **Fail build if runtime code references canon files not in this index**
3. **Warn on reference files claiming binding status**
4. **Generate coverage report: % of indexed touchpoints with tests**

### Runtime Requirements (MUST IMPLEMENT)
1. **All evaluation requests MUST log function + bundle version**
2. **Validator gates MUST check against indexed canon, not ad-hoc rules**
3. **Incident logs MUST reference function + canon version + validator**

### QA Requirements (MUST IMPLEMENT)
1. **Test coverage MUST match indexed runtime touchpoints**
2. **Each function MUST have passing tests per its QA checklist**
3. **Regression suite MUST cover all canon-defined behaviors**

---

## CHANGE CONTROL

**Adding a function:**
1. Create canon bundle (entry spec + governance + validator map + incident schema + QA checklist)
2. Add to this index with status: draft
3. Implement runtime touchpoints
4. Pass QA checklist
5. Update status to active

**Modifying canon:**
1. Update indexed canon file
2. Increment version in file header
3. Update this index with new version reference
4. Re-run QA checklist
5. Log change in INCIDENT_LOG.md

**Removing a function:**
1. Update status to deprecated
2. Remove from active routing
3. Archive canon bundle
4. Update documentation

---

## VERSION HISTORY

- **2026-01-03:** Initial index creation (v1.0)
- All functions transitioned from implicit to explicit governance

---

**END OF FUNCTION INDEX**

This document is AUTHORITATIVE. No canon file may direct behavior unless listed here.