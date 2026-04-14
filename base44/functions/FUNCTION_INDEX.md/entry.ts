# FUNCTION_INDEX.md (EXHAUSTIVE REGISTRY)

**Status:** CANON / BINDING  
**Purpose:** Complete mapping of all platform functions, canon documents, and runtime touchpoints  
**Last Updated:** 2026-01-03

---

## PLATFORM STANDARDS (APPLY TO ALL FUNCTIONS)

- `MULTI_MODEL_GOVERNANCE_STANDARD.md`
- `DEFENSIVE_ENGINEERING_STANDARD.md`
- `DEFENSIVE_ERROR_HANDLING_STANDARD.md`
- `SLUR_GOVERNANCE_DOC.md`
- `PSC_DETECTION_GUIDE.md`
- `VOICE_PRESERVATION_CANON.md`
- `AI_ROUTING_SPEC.md`

---

## FUNCTION 1: EVALUATE

### Canon Documents
- `EVALUATE_ENTRY_CANON.md`
- `EVALUATE_GOVERNANCE_ADDENDUM.md`
- `EVALUATE_RULE_VALIDATOR_SLA_MAP.md`
- `EVALUATE_INCIDENT_LOG_SCHEMA.md`
- `EVALUATE_QA_CHECKLIST.md`
- `13_STORY_CRITERIA.md`
- `WAVE_GUIDE.md`
- `STORY_ARCHITECTURE_GUIDE.md`
- `TRANSGRESSIVE_MODE_SPEC.md`

### Runtime Functions (.js)
- `evaluateQuickSubmission.js`
- `evaluateFullManuscript.js`
- `evaluateThirteenCriteria.js`
- `evaluateSpine.js`
- `evaluateWaveFlags.js`
- `splitManuscript.js`

### Frontend Touchpoints
- `pages/YourWriting.js`
- `pages/UploadManuscript.js`
- `pages/EvaluateChapter.js`
- `pages/Evaluate.js`
- `components/evaluation/TransgressiveModeSelector.js`
- `components/evaluation/LanguageVariantSelector.js`
- `components/evaluation/ScoreCard.js`
- `components/evaluation/CriteriaPanel.js`
- `components/evaluation/ProgressTracker.js`

---

## FUNCTION 2: WAVE (CRAFT ANALYSIS)

### Canon Documents
- `WAVE_GUIDE.md`
- `WAVE_VALIDATION_SUITE.md`
- `WAVE_TEST_CASES.json`
- `VOICE_PRESERVATION_CANON.md`

### Runtime Functions (.js)
- `evaluateWaveFlags.js`
- `validateWaveLabels.js`
- `testWaveValidation.js`
- `voiceGuard.js`
- `applyVoiceProtectionRouting.js`

### Frontend Touchpoints
- `pages/Revise.js`
- `components/VoicePreservationToggle.js`
- `components/revision/SuggestionCard.js`

---

## FUNCTION 3: SCREENPLAY

### Canon Documents
- `SCREENPLAY_QUALITY_STANDARD_CANON.md`
- `SCREENPLAY_QUALITY_STANDARD.md`
- `SCREENPLAY_GOVERNANCE_ADDENDUM.md`
- `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md`
- `SCREENPLAY_INCIDENT_LOG_SCHEMA.md`
- `SCREENPLAY_QA_CHECKLIST_WRITERDUET_MODE.md`
- `WRITERDUET_FORMATTING_STANDARD.md`

### Runtime Functions (.js)
- `formatScreenplay.js`

### Frontend Touchpoints
- `pages/ScreenplayFormatter.js`
- `components/ScreenplayText.js`

---

## FUNCTION 4: REVISION

### Canon Documents
- `WAVE_GUIDE.md` (shared)
- `VOICE_PRESERVATION_CANON.md` (shared)

### Runtime Functions (.js)
- `generateRevisionSuggestions.js`
- `generateRevisionSegments.js`
- `approveRevision.js`
- `generateAlternatives.js`

### Frontend Touchpoints
- `pages/Revise.js`
- `pages/History.js`
- `components/RevisionViewer.js`
- `components/RevisionControls.js`
- `components/useRevisionFlow.js`
- `components/revision/SuggestionCard.js`
- `components/revision/SmartFeaturesBanner.js`
- `components/revision/DownloadOptions.js`
- `components/revision/OverallFeedbackModal.js`
- `components/revision/RevisionInsights.js`
- `components/revision/FeedbackButtons.js`

---

## FUNCTION 5: OUTPUT GENERATION

### Canon Documents
- `SYNOPSIS_SPEC.json`
- `COMPARABLES_CANON_SPEC.md`
- `FILM_PITCH_DECK_QUALITY_STANDARD.md`

### Runtime Functions (.js)
- `generateSynopsis.js`
- `runSynopsisQA.js`
- `generateQueryLetter.js`
- `generateQueryLetterPackage.js`
- `generateQueryPitches.js`
- `generateFilmPitchDeck.js`
- `generateComparables.js`
- `generateCompletePackage.js`
- `prefillPackageFields.js`
- `extractPitchFields.js`
- `applyVoiceAnchorAndSchemaToPitch.js`

### Frontend Touchpoints
- `pages/Synopsis.js`
- `pages/QueryLetter.js`
- `pages/PitchGenerator.js`
- `pages/Comparables.js`
- `pages/CompletePackage.js`
- `pages/FilmAdaptation.js`
- `pages/PitchBuilder.js`
- `pages/ComparativeReport.js`
- `pages/SampleComparativeAnalysis.js`
- `pages/SampleFilmPitchDeck.js`

---

## FUNCTION 6: BIOGRAPHY

### Canon Documents
- (None specific - follows output generation standards)

### Runtime Functions (.js)
- `uploadAndGenerateBio.js`
- `extractLinkedInBio.js`

### Frontend Touchpoints
- `pages/Biography.js`

---

## FUNCTION 7: STORYGATE STUDIO

### Canon Documents
- `STORYGATE_FLOW_MAP.md`
- `STORYGATE_STUDIO_DESIGN_SYSTEM.md`

### Runtime Functions (.js)
- `submitStoryGateFilm.js`
- `createStoryGateListing.js`
- `handleVerification.js`
- `checkProjectAccess.js`
- `handleAccessRequest.js`
- `requestProjectAccess.js`

### Frontend Touchpoints
- `pages/StoryGate.js`
- `pages/StorygateStudio.js`
- `pages/CreatorStoryGate.js`
- `pages/StoryGatePortal.js`
- `pages/IndustryVerification.js`
- `pages/AdminVerificationQueue.js`
- `pages/CreateStoryGateListing.js`
- `pages/StoryGateFilmSubmission.js`
- `pages/AdminStoryGateOps.js`
- `pages/StorygateReview.js`

---

## FUNCTION 8: MANUSCRIPT MANAGEMENT

### Canon Documents
- (Inherits from Evaluate + Wave)

### Runtime Functions (.js)
- `splitManuscript.js`
- `cloneManuscript.js`
- `markManuscriptFinal.js`
- `checkManuscriptIntegrity.js`
- `analyzeNarrativeContinuity.js`
- `compareVersions.js`

### Frontend Touchpoints
- `pages/ManuscriptDashboard.js`
- `pages/Dashboard.js`
- `pages/ChapterReport.js`
- `pages/SpineReport.js`
- `components/dashboard/ProjectOverview.js`
- `components/dashboard/EvaluationsList.js`
- `components/dashboard/RevisionHistory.js`

---

## FUNCTION 9: FILE PROCESSING

### Canon Documents
- (None specific - utility functions)

### Runtime Functions (.js)
- `ingestUploadedFileToText.js`
- `importDocx.js`
- `convertDocxToText.js`

### Frontend Touchpoints
- `pages/TestUpload.js`
- `pages/UploadWork.js`
- `components/RichTextEditor.js`

---

## FUNCTION 10: VALIDATION & TESTING

### Canon Documents
- `WAVE_VALIDATION_SUITE.md`
- `GOVERNANCE_QA_TEST_MATRIX.md`
- `WAVE_TEST_CASES.json`

### Runtime Functions (.js)
- `validateWaveLabels.js`
- `validateGoldStandard.js`
- `testWaveValidation.js`
- `checkRouteHealth.js`

### Frontend Touchpoints
- `pages/ValidationReport.js`

---

## FUNCTION 11: ANALYTICS & FEEDBACK

### Canon Documents
- (None specific)

### Runtime Functions (.js)
- `storeEvaluationSignals.js`
- `analyzeFeedback.js`

### Frontend Touchpoints
- `pages/Analytics.js`
- `components/FeedbackWidget.js`
- `components/analytics/FeedbackAnalytics.js`
- `components/dashboard/FeedbackPreferences.js`

---

## FUNCTION 12: PAYMENTS (STRIPE)

### Canon Documents
- (None specific - external integration)

### Runtime Functions (.js)
- `createCheckoutSession.js`
- `getStripePrices.js`
- `setupStripeProducts.js`
- `stripeWebhook.js`

### Frontend Touchpoints
- `pages/Pricing.js`
- `pages/PaymentSuccess.js`
- `pages/Enterprise.js`
- `components/enterprise/DemoRequestForm.js`

---

## FUNCTION 13: UTILITIES & HELPERS

### Canon Documents
- (None specific)

### Runtime Functions (.js)
- `generateCanonHash.js`
- `transitionDocumentState.js`
- `generateBenchmarkComparison.js`
- `generateStoryLogo.js`

### Frontend Touchpoints
- `components/BenchmarkComparisonModal.js`
- `pages/LogoGenerator.js`

---

## FUNCTION 14: AGENT DISCOVERY

### Canon Documents
- (None specific - follows output generation standards)

### Runtime Functions (.js)
- (Integrated into `generateCompletePackage.js` and query letter functions)

### Frontend Touchpoints
- `pages/FindAgents.js`

---

## GOVERNANCE & DOCUMENTATION

### Canon Documents
- `GOVERNANCE_EXECUTIVE_SUMMARY.md`
- `GOVERNANCE_ENGINEERING_CHECKLIST.md`
- `GOVERNANCE_QA_TEST_MATRIX.md`
- `GOVERNANCE_PR_TEMPLATE.md`
- `GOVERNANCE_JIRA_TICKET_TEMPLATE.md`
- `BASE44_GOVERNANCE_OVERVIEW.md`
- `BASE44_ENGINEERING_QA_SPEC.md`
- `BASE44_IMPLEMENTATION_SPEC.md`
- `BASE44_IMPLEMENTATION_ROADMAP.md`
- `BASE44_QUERY_LETTER_BUG_REPORT.md`
- `BASE44_RESPONSIBILITIES.md`
- `INCIDENT_LOG.md`
- `REVISIONGRADE_FUNCTIONALITY_SCHEMA.md`
- `REVISIONGRADE_FUNCTIONAL_ARCHITECTURE.md`

### Frontend Touchpoints
- `pages/InternalGovernanceIndex.js`
- `pages/InternalBase44Responsibilities.js`
- `pages/InternalRevisionGradeResponsibilities.js`
- `pages/InternalTrustedPathContract.js`

---

## REFERENCE MATERIALS (NON-BINDING)

### Test Data & Lexicons
- `acceptance_tests.v1.json`
- `severity_policy.v1.json`
- `slur_lexicon.v1.json`
- `toadstone_gold.v1.json`
- `toadstone_gold_slur.v1.json`
- `TOADSTONE_POWER_OF_BELIEF.md`
- `SMILE_LEXICON.md`
- `SLUR_LEXICON_SCHEMA.json`

### Voice Training Data
- `voice_register_schema.json`
- `voice_rules.v1.json`
- `voice_training_batch_1.json`
- `voice_training_batch_2.json`
- `voice_training_batch_4.json`
- `voice_training_batch_5.json`
- `voice_training_batch_6.json`
- `voice_training_batch_7.json`

---

## ADDITIONAL PAGES (INFORMATIONAL)

- `pages/Home.js`
- `pages/Contact.js`
- `pages/Privacy.js`
- `pages/Terms.js`
- `pages/FAQ.js`
- `pages/Methodology.js`
- `pages/Criteria.js`
- `pages/SampleAnalyses.js`
- `pages/SampleChapterAnalysis.js`
- `pages/SampleAnalysis.js`
- `pages/WhyRevisionGrade.js`
- `pages/SecurityAndEthics.js`
- `pages/EthicsAndSafety.js`
- `pages/SlurHandlingPolicy.js`
- `pages/ForProfessionals.js`
- `pages/HelpCenter.js`
- `pages/InviteUser.js`
- `pages/SelectFormat.js`
- `pages/Progress.js`
- `pages/ViewReport.js`

---

## SHARED COMPONENTS

- `components/AnalyticsTracker.js`
- `components/ScrollToTop.js`
- `components/ErrorHandler.js`
- `components/UserNotRegisteredError.js`
- `components/FAQSearchResults.js`
- `components/submission/TextEditor.js`
- `components/evaluation/StyleModeSelector.js`
- `components/evaluation/FinalOutput.js`
- `components/evaluation/ThoughtTagCard.js`
- `components/evaluation/TransgressiveRiskPanel.js`
- `components/utils/exportTxt.js`

---

## LAYOUT & GLOBALS

- `Layout.js`
- `globals.css`

---

**TOTAL COUNTS:**
- **Runtime Functions (.js):** 47
- **Canon Documents (.md):** 35+
- **Frontend Pages:** 60+
- **Components:** 40+

---

**END OF EXHAUSTIVE FUNCTION INDEX**