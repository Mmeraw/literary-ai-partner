/**
 * GOVERNANCE CODE CONSOLIDATION
 * Extracted from live functions for schema/spec deconfliction
 * Export Date: 2026-01-10
 */

// =============================================================================
// SOURCE: functions/validateWorkTypeMatrix.js (lines 20-90)
// MASTER DATA - Work Type → Criteria Applicability Matrix (MDM Canon v1.0.0)
// =============================================================================

const MASTER_DATA = {
  "matrixVersion": "v1.0.0",
  "criteriaCatalog": [
    {"id": "hook"}, {"id": "voice"}, {"id": "character"}, {"id": "conflict"},
    {"id": "theme"}, {"id": "pacing"}, {"id": "dialogue"}, {"id": "worldbuilding"},
    {"id": "stakes"}, {"id": "linePolish"}, {"id": "marketFit"}, {"id": "keepGoing"}, {"id": "technical"}
  ],
  "workTypes": {
    "personalEssayReflection": {
      "label": "Personal Essay / Reflection",
      "family": "Prose Nonfiction",
      "criteria": {
        "hook": "R", "voice": "R", "character": "O", "conflict": "NA", "theme": "R",
        "pacing": "O", "dialogue": "NA", "worldbuilding": "NA", "stakes": "O",
        "linePolish": "R", "marketFit": "O", "keepGoing": "R", "technical": "R"
      }
    },
    "memoirVignette": {
      "label": "Memoir Vignette",
      "family": "Prose Nonfiction",
      "criteria": {
        "hook": "R", "voice": "R", "character": "O", "conflict": "O", "theme": "R",
        "pacing": "R", "dialogue": "NA", "worldbuilding": "O", "stakes": "R",
        "linePolish": "R", "marketFit": "O", "keepGoing": "R", "technical": "R"
      }
    },
    "novelChapter": {
      "label": "Novel Chapter",
      "family": "Prose Fiction",
      "criteria": {
        "hook": "R", "voice": "R", "character": "R", "conflict": "R", "theme": "R",
        "pacing": "R", "dialogue": "R", "worldbuilding": "R", "stakes": "R",
        "linePolish": "R", "marketFit": "R", "keepGoing": "R", "technical": "R"
      }
    },
    "shortStory": {
      "label": "Short Story",
      "family": "Prose Fiction",
      "criteria": {
        "hook": "R", "voice": "R", "character": "R", "conflict": "R", "theme": "R",
        "pacing": "R", "dialogue": "R", "worldbuilding": "R", "stakes": "R",
        "linePolish": "R", "marketFit": "R", "keepGoing": "R", "technical": "R"
      }
    },
    "featureScreenplay": {
      "label": "Feature Screenplay",
      "family": "Script/Screenplay",
      "criteria": {
        "hook": "R", "voice": "O", "character": "R", "conflict": "R", "theme": "R",
        "pacing": "R", "dialogue": "R", "worldbuilding": "R", "stakes": "R",
        "linePolish": "O", "marketFit": "R", "keepGoing": "R", "technical": "R"
      }
    },
    "scriptSceneFilmTv": {
      "label": "Script Scene (Film/TV)",
      "family": "Script/Screenplay",
      "criteria": {
        "hook": "R", "voice": "O", "character": "R", "conflict": "R", "theme": "O",
        "pacing": "R", "dialogue": "R", "worldbuilding": "O", "stakes": "R",
        "linePolish": "O", "marketFit": "O", "keepGoing": "R", "technical": "R"
      }
    },
    "flashFictionMicro": {
      "label": "Flash Fiction / Micro",
      "family": "micro",
      "criteria": {
        "hook": "R", "voice": "R", "character": "C", "conflict": "R", "theme": "R",
        "pacing": "NA", "dialogue": "C", "worldbuilding": "NA", "stakes": "NA",
        "linePolish": "R", "marketFit": "NA", "keepGoing": "NA", "technical": "R"
      }
    },
    "proseScene": {
      "label": "Prose Scene",
      "family": "Prose Fiction",
      "criteria": {
        "hook": "R", "voice": "R", "character": "R", "conflict": "R", "theme": "O",
        "pacing": "R", "dialogue": "R", "worldbuilding": "O", "stakes": "R",
        "linePolish": "R", "marketFit": "O", "keepGoing": "R", "technical": "R"
      }
    },
    "otherUserDefined": {
      "label": "Other (User-Defined)",
      "family": "Other",
      "criteria": {
        "hook": "R", "voice": "R", "character": "O", "conflict": "O", "theme": "O",
        "pacing": "R", "dialogue": "O", "worldbuilding": "O", "stakes": "O",
        "linePolish": "R", "marketFit": "O", "keepGoing": "R", "technical": "R"
      }
    }
  }
};

// Legend:
// R = Required (must score, can block)
// O = Optional (can score, low weight)
// NA = Not Applicable (MUST NOT score - hard prohibition)
// C = Conditional (score only if feature detected - e.g., dialogue only if dialogue exists)


// =============================================================================
// SOURCE: functions/matrixPreflight.js
// INPUT VALIDATION - Minimum requirements and confidence caps
// =============================================================================

const MATRIX_PREFLIGHT_RULES = {
  inputScales: {
    ranges: {
      paragraph: { min: 50, max: 249 },
      scene: { min: 250, max: 1999 },
      chapter: { min: 2000, max: 7999 },
      multi_chapter: { min: 8000, max: 39999 },
      full_manuscript: { min: 40000, max: Infinity }
    },
    confidenceCaps: {
      paragraph: 40,
      scene: 65,
      chapter: 75,
      multi_chapter: 85,
      full_manuscript: 95
    }
  },
  
  requestRequirements: {
    quick_evaluation: "paragraph",
    full_manuscript_evaluation: "full_manuscript",
    synopsis: "chapter",
    query_letter: "full_manuscript",
    query_package: "full_manuscript",
    pitch: "full_manuscript",
    agent_package: "full_manuscript",
    film_adaptation: "full_manuscript",
    comparables: "full_manuscript",
    biography: null
  },
  
  allowedOutputsByScale: {
    paragraph: ["Topic identification", "Surface-level notes", "Genre hint", "Single-moment analysis"],
    scene: ["Scene-level analysis", "Immediate tension", "Moment critique", "Limited character observation", "Voice sample notes"],
    chapter: ["Chapter structural signals", "Pacing within chapter", "Character presence", "Partial arc hints", "WAVE flags"],
    multi_chapter: ["Partial manuscript analysis", "Emerging patterns", "Structural tendencies", "Provisional thematic notes", "Conservative market hints"],
    full_manuscript: ["All evaluation outputs", "Synopsis", "Pitch/logline", "Query letter", "Agent package", "Market positioning", "Full structural analysis"]
  },
  
  blockReasons: {
    SCOPE_INSUFFICIENT: "Input too short for requested output type",
    STRUCTURE_INCOMPLETE: "Narrative structure incomplete",
    HALLUCINATION_RISK: "Insufficient context - high hallucination risk",
    VOICE_INSUFFICIENT: "Not enough text to establish voice authenticity",
    NARRATIVE_INCOMPLETE: "Story arc not complete",
    MATRIX_VIOLATION: "Does not meet minimum matrix requirements"
  }
};


// =============================================================================
// SOURCE: functions/getPolicyFamily.js
// POLICY ROUTING - Work Type → UI labels and semantic enforcement
// =============================================================================

const POLICY_FAMILIES = {
  MICRO_POLICY: 'MICRO_POLICY',
  MANUSCRIPT_POLICY: 'MANUSCRIPT_POLICY',
  SCREENPLAY_POLICY: 'SCREENPLAY_POLICY',
  NEUTRAL_POLICY: 'NEUTRAL_POLICY'
};

const WORK_TYPE_TO_POLICY = {
  'Flash Fiction / Micro': 'MICRO_POLICY',
  'Poetry': 'MICRO_POLICY',
  'Vignette': 'MICRO_POLICY',
  'Micro-Fiction': 'MICRO_POLICY',
  
  'Novel': 'MANUSCRIPT_POLICY',
  'Novella': 'MANUSCRIPT_POLICY',
  'Full-Length Manuscript': 'MANUSCRIPT_POLICY',
  'Manuscript': 'MANUSCRIPT_POLICY',
  
  'Screenplay': 'SCREENPLAY_POLICY',
  'TV Script': 'SCREENPLAY_POLICY',
  'Feature Film': 'SCREENPLAY_POLICY',
  'Script': 'SCREENPLAY_POLICY',
  
  'Unclassified': 'NEUTRAL_POLICY',
  'Experimental': 'NEUTRAL_POLICY'
};

const POLICY_ROUTING_SPECS = {
  MICRO_POLICY: {
    scoreLabel: 'Craft Score',
    scoreRange: '/10',
    readinessFloorEnabled: false,
    phase2Enabled: false,
    gatesEnabled: false,
    allowedPhrases: ['craft score', 'compression', 'moment quality', 'literary journal fit'],
    forbiddenPhrases: [
      'readiness floor',
      'professional routing',
      'Agent-Reality Grade',
      'submission-ready',
      'agent-viable',
      'Phase 2',
      'StoryGate eligible',
      'manuscript',
      'market positioning'
    ]
  },
  
  MANUSCRIPT_POLICY: {
    scoreLabel: 'Agent-Reality Grade',
    scoreRange: '/100',
    readinessFloorEnabled: true,
    readinessFloorValue: 8.0,
    phase2Enabled: true,
    gatesEnabled: true,
    allowedPhrases: [
      'Agent-Reality Grade',
      'submission-ready',
      'professional tier',
      'agent-viable',
      'market positioning',
      'readiness floor',
      'Phase 2 eligible'
    ],
    forbiddenPhrases: []
  },
  
  SCREENPLAY_POLICY: {
    scoreLabel: 'Reader Grade',
    scoreRange: '/100',
    readinessFloorEnabled: true,
    readinessFloorValue: 6.5,
    phase2Enabled: true,
    gatesEnabled: true,
    allowedPhrases: ['spec-ready', 'coverage-worthy', 'reader pass', 'screen craft'],
    forbiddenPhrases: ['Agent-Reality Grade', 'manuscript']
  },
  
  NEUTRAL_POLICY: {
    scoreLabel: 'Craft Analysis',
    scoreRange: '/10',
    readinessFloorEnabled: false,
    phase2Enabled: false,
    gatesEnabled: false,
    allowedPhrases: ['craft analysis', 'structural notes', 'feedback'],
    forbiddenPhrases: ['readiness floor', 'submission-ready', 'professional tier']
  }
};


// =============================================================================
// SOURCE: functions/evaluateQuickSubmission.js (KEY SECTIONS)
// ENFORCEMENT LOGIC - Quick Evaluation Pipeline
// =============================================================================

const QUICK_EVALUATION_ENFORCEMENT = {
  // Criteria Labels (UI mapping)
  criteriaLabels: {
    hook: 'The Hook - First pages pull reader in with intrigue, tension, unique voice',
    voice: 'Voice & Narrative Style - Distinct, engaging voice matching tone with fresh prose',
    character: 'Characters & Introductions - Visceral character feel showing personality and motivations',
    conflict: 'Conflict & Tension - Strong driving tension with escalating conflicts',
    theme: 'Thematic Resonance - Deep themes woven naturally without being preachy',
    pacing: 'Pacing & Structural Flow - Momentum in every chapter, tight purposeful scenes',
    dialogue: 'Dialogue & Subtext - Authentic dialogue revealing more than stated',
    worldbuilding: 'Worldbuilding & Immersion - World revealed organically with sensory details',
    stakes: 'Stakes & Emotional Investment - Clear stakes with reader emotional connection',
    linePolish: 'Line-Level Polish - Tight evocative prose with proper rhythm',
    marketFit: 'Marketability & Genre Fit - Fresh, original, fits genre, marketable',
    keepGoing: 'Would Agent Keep Reading - High tension/intrigue making agent request full manuscript',
    technical: 'Technical / Formatting Correctness - Proper format, structure, technical standards'
  },

  // Sample Scope Detection (v1.0.0 Canon)
  sampleScopeRules: {
    S0: { max: 49, label: "Too short" },
    S1: { min: 50, max: 499, label: "Paragraph" },
    S2: { min: 500, max: 2999, label: "Scene" },
    S3: { min: 3000, max: 19999, label: "Chapter" },
    S4: { min: 20000, label: "Multi-chapter" }
  },

  // Sample Scope Enforcement for Micro Family (v1.0.0)
  microFamilyScopeEnforcement: {
    description: "For flashFictionMicro when sampleScope = S1 (50-499 words)",
    alwaysNA: ['marketFit', 'stakes', 'keepGoing'],
    conditionalNA: {
      dialogue: "if no quoted speech detected",
      character: "if wordCount < 200 OR no multiple characters",
      pacing: "if wordCount < 200 OR no multiple characters"
    },
    detectionHeuristics: {
      hasDialogue: "regex: /[\"'].*?[\"']/ AND /\\b(said|asked|replied|whispered|shouted)\\b/i",
      hasMultipleCharacters: "namedEntities >= 2 (simple capitalized word count)"
    }
  },

  // NA Output Gate (MDM Rule M4: Hard Prohibition)
  naOutputGate: {
    enforcement: "criterion_id_based",
    rules: [
      "Block any criterion with status='NA' from being scored",
      "Block any revision request referencing NA criterion_id",
      "Text-scrub WAVE hits containing NA criterion terms",
      "Disable agentSnapshot if core drivers (conflict, dialogue, worldbuilding) ALL NA"
    ],
    naTermsDictionary: {
      dialogue: ['dialogue', 'conversation', 'speaking', 'said', 'talk', 'exchange', 'verbal', 'discussion'],
      conflict: ['conflict', 'tension', 'confrontation', 'clash', 'struggle', 'opposition', 'plot', 'event', 'interaction', 'character interaction', 'pivotal moment', 'dramatic'],
      worldbuilding: ['worldbuilding', 'world-building', 'world building', 'setting detail']
    }
  },

  // Postflight Integrity Gate (Function #6 Lock - MONITORING MODE)
  postflightIntegrity: {
    mode: "monitoring",
    warnings: [
      "SCORED_COUNT_MISMATCH: scored count != expected count from plan"
    ],
    criticalBlocks: [
      "FORBIDDEN_SCORED: NA criterion has a score (blocks entire response)"
    ]
  }
};


// =============================================================================
// SOURCE: functions/evaluateFullManuscript.js (KEY SECTIONS)
// ENFORCEMENT LOGIC - Full Manuscript Pipeline
// =============================================================================

const FULL_MANUSCRIPT_ENFORCEMENT = {
  // Governance Run Creation (lines 524-546)
  governedRunSchema: {
    entity: "EvaluationRun",
    requiredFields: [
      "projectId",
      "workTypeUi",
      "sourceFileId",
      "inputFingerprintHash",
      "governanceVersion"
    ],
    defaults: {
      phase2Enabled: true,
      readinessFloor: 8.0,
      coverageMinChapters: 5,
      coverageMinWordPct: 0.25,
      governanceVersion: "EVAL_METHOD_v1.0.0",
      allowRawTextInPhase2: false,
      phase2ReadOnlyScores: true
    }
  },

  // Phase Gate Progression (Lifecycle enforcement)
  lifecycle: {
    states: [
      "created",
      "segmented",
      "phase1_complete",
      "gated",
      "phase2_skipped",
      "phase2_complete",
      "complete",
      "failed"
    ],
    transitions: {
      "created → segmented": "After chapters exist",
      "segmented → phase1_complete": "After all chapter summaries + spine done",
      "phase1_complete → gated": "After gate decision written",
      "gated → phase2_complete": "If gates pass",
      "gated → phase2_skipped": "If gates fail",
      "* → failed": "On critical error"
    }
  },

  // Gate Decision Rules (lines 1125-1165)
  gateRules: {
    readinessGate: {
      threshold: 8.0,
      check: "phase1Readiness >= 8.0"
    },
    coverageGate: {
      minChapters: 5,
      minWordPct: 0.25,
      check: "coverageChapters >= 5 AND coverageWordPct >= 0.25"
    },
    integrityGate: {
      check: "segmentsMissing.length === 0 AND segmentsWritten === segmentsExpected",
      verifies: "All chapters have corresponding EvaluationSegment records"
    },
    phase2Allowed: {
      rule: "readinessPassed AND coveragePassed AND integrityPassed"
    }
  },

  // Integrity Check (Phase 0 - lines 575-597)
  integrityCheck: {
    function: "checkManuscriptIntegrity",
    penaltyIfUnclean: 0.5,
    checksFor: [
      "Placeholders ([TODO], [TK], draft markers)",
      "Meta-notes (revision comments)",
      "Duplicate sections (repeated text blocks)",
      "Outline-heavy formatting (>30% bullet points)",
      "Archive markers (old version indicators)"
    ],
    cleanScore: "0-100 (100 = perfectly clean)",
    modes: {
      clean: "cleanScore >= 90",
      minor_cleanup: "cleanScore >= 70",
      development: "cleanScore < 70"
    }
  },

  // 12 Agent Criteria (used in spine evaluation - lines 811-823)
  agentCriteria: [
    "The Hook (Opening Impact)",
    "Voice & Narrative Style",
    "Characters & Development",
    "Conflict & Tension Architecture",
    "Thematic Resonance",
    "Pacing & Structural Flow",
    "Dialogue & Subtext",
    "Worldbuilding & Immersion",
    "Stakes & Emotional Investment",
    "Line-Level Polish",
    "Marketability & Genre Fit",
    "Would Agent Request Full Manuscript"
  ],

  // WAVE Tier Structure (lines 148-199)
  waveTiers: {
    early: {
      label: "Structural Truth",
      checks: [
        "Wave 2: POV Honesty (no mind-reading, observable proof only)",
        "Wave 17: Concrete Stakes (what's at risk if this fails?)",
        "Wave 36: Character Consistency (voice logic maintained?)"
      ],
      model: "gpt-4o",
      timeout: 60000
    },
    mid: {
      label: "Momentum & Meaning",
      checks: [
        "Wave 3: Generic Nouns (replace room/thing/place with specificity)",
        "Wave 4: Filter Verbs (remove I saw/felt/heard distance)",
        "Wave 5: Adverb Diet (weak verbs propped up by adverbs?)",
        "Wave 6: Active Voice (restore agency, name actors)",
        "Wave 7: Negation Discipline (say what happened, not what didn't)",
        "Wave 13: Dialogue Tags (over-attribution bloat?)"
      ],
      model: "gpt-4o-mini",
      timeout: 60000
    },
    late: {
      label: "Authority & Polish",
      checks: [
        "Wave 1: Body-Part Clichés (jaw/chest/eyes that don't change action)",
        "Wave 8: Abstract Triples (two beats sharpen, three soften)",
        "Wave 9: Motif Hygiene (spotlight once per section)",
        "Wave 15: On-the-Nose Explanations (cut because/which meant)",
        "Wave 61: Reflexive Redundancy (himself/herself/own/just without function)"
      ],
      model: "gpt-4o-mini",
      timeout: 60000
    }
  },

  // Scoring Aggregation (lines 1068-1086)
  scoringFormula: {
    chapterScore: "(agentScore * 0.5) + (waveScore * 0.5)",
    waveScore: "(early + mid + late) / 3",
    manuscriptOverall: "(spineScore * 0.5) + (avgChapterScore * 0.5)",
    integrityPenalty: "0.5 points if cleanScore < 90"
  }
};


// =============================================================================
// CRITICAL ENFORCEMENT POINTS FROM evaluateQuickSubmission.js
// =============================================================================

const QUICK_EVAL_CRITICAL_SECTIONS = `
// Lines 75-115: Matrix Preflight Validation (MUST execute before LLM)
const preflightResponse = await base44.functions.invoke('matrixPreflight', {
    inputText: text,
    requestType: 'quick_evaluation',
    userEmail: user.email
});
const preflight = preflightResponse.data;

if (!preflight.allowed) {
    // BLOCK: Create audit log, log to Sentry, return refusal response
    return Response.json(refusal, { status: 422 });
}

// Lines 117-124: Work Type Gate (MDM Canon v1)
if (!final_work_type_used) {
    return Response.json({
        code: "EVALUATION_BLOCKED",
        userMessage: "Work Type not confirmed",
        refusalReason: "MATRIX_VIOLATION",
        nextAction: "confirm_work_type"
    }, { status: 400 });
}

// Lines 126-140: Load Criteria Plan from Master Data
const criteriaPlanResult = await base44.functions.invoke('validateWorkTypeMatrix', {
    action: 'buildPlan',
    workTypeId: final_work_type_used
});

const criteriaPlan = criteriaPlanResult.data.criteriaPlan;

// Lines 161-204: Sample Scope Enforcement for flashFictionMicro (CRITICAL BUG LOCATION)
if (sampleScope === 'S1' && criteriaPlan.family === 'micro') {
    // ALWAYS N/A for S1 micro (cannot assess from paragraph):
    criteriaPlan.criteria.marketFit = { status: 'NA' };
    criteriaPlan.criteria.stakes = { status: 'NA' };
    criteriaPlan.criteria.keepGoing = { status: 'NA' };
    
    // CONDITIONAL N/A (feature-gated):
    if (!hasDialogue) {
        criteriaPlan.criteria.dialogue = { status: 'NA' };
    }
    
    if (wordCount < 200 || !hasMultipleCharacters) {
        criteriaPlan.criteria.character = { status: 'NA' };
        criteriaPlan.criteria.pacing = { status: 'NA' };
    }
    
    // REBUILD LISTS after enforcement (critical fix)
    applicableCriteria.length = 0;
    naCriteria.length = 0;
    naCriteriaSet.clear();
    // ... rebuild from criteriaPlan.criteria
}

// Lines 301-361: NA OUTPUT GATE (MDM Rule M4: Hard NA prohibition)
const processedCriteria = (agentAnalysis.criteria || [])
    .map(criterion => {
        const criterionId = criterion.criterion_id;
        const status = criteriaPlan.criteria[criterionId].status;
        
        // MDM RULE M4: Hard NA prohibition
        if (status === 'NA') {
            naOutputGate.blocked_criteria.push(criterionId);
            return null; // DROP from output
        }
        
        return { ...criterion, status };
    })
    .filter(c => c !== null);

// Lines 386-423: Postflight Integrity Gate (Function #6 Lock)
const scoredCount = processedCriteria.length;
const expectedScoredCount = applicableCriteria.length;

if (scoredCount !== expectedScoredCount) {
    integrityWarnings.push(\`SCORED_COUNT_MISMATCH: got \${scoredCount}, expected \${expectedScoredCount}\`);
}

// CRITICAL - block if N/A criterion scored
const forbiddenScored = processedCriteria.filter(c => naCriteriaSet.has(c.criterion_id));
if (forbiddenScored.length > 0) {
    integrityCritical.push(\`FORBIDDEN_SCORED: \${forbiddenScored.map(c => c.criterion_id).join(', ')}\`);
    // BLOCK entire response with 500 error
    return Response.json({
        error: 'Critical evaluation integrity failure',
        code: 'EVAL_INTEGRITY_CRITICAL'
    }, { status: 500 });
}
`;


// =============================================================================
// EXPORT OBJECT - All governance data consolidated
// =============================================================================

export const GOVERNANCE_CANON = {
  version: "v1.0.0",
  extractedDate: "2026-01-10",
  
  masterData: MASTER_DATA,
  matrixPreflightRules: MATRIX_PREFLIGHT_RULES,
  policyFamilies: POLICY_FAMILIES,
  workTypeToPolicyMap: WORK_TYPE_TO_POLICY,
  policyRoutingSpecs: POLICY_ROUTING_SPECS,
  quickEvaluationEnforcement: QUICK_EVALUATION_ENFORCEMENT,
  fullManuscriptEnforcement: FULL_MANUSCRIPT_ENFORCEMENT,
  
  criticalCodeSections: {
    quickEval: QUICK_EVAL_CRITICAL_SECTIONS
  },
  
  notes: [
    "This file contains the actual governance logic extracted from live code",
    "Compare against .md documentation to find discrepancies",
    "Key bug location: evaluateQuickSubmission.js lines 161-204 (Sample Scope Enforcement)",
    "Master data is canonical source of truth for R/O/NA/C status",
    "All enforcement must respect NA hard prohibition (MDM Rule M4)"
  ]
};