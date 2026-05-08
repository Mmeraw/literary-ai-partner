# RevisionGrade Runtime Bundle — Prompt/Validator/Finalizer Upgrade

This bundle contains the implementation-ready materials to replace the thin evaluator runtime with the governed pipeline.

## File map

- `src/prompts/pass1-craft.ts`
- `src/prompts/pass2-editorial.ts`
- `src/prompts/pass3-synthesis.ts`
- `src/evaluation/gates.ts`
- `src/evaluation/finalizer.ts`
- `src/evaluation/validate-and-finalize.ts`
- `tests/evaluation/gates.test.ts`
- `tests/evaluation/finalizer.test.ts`
- `tests/evaluation/pass3-disputed.test.ts`

---

## `src/prompts/pass1-craft.ts`

```typescript
// ========================================================
// src/prompts/pass1-craft.ts
// RevisionGrade — Pass 1 Craft / Structural Evaluator
// Canon-bound to Volume II + Prompt Injection Spec V2
// ========================================================

import type { CanonicalCriterionKey } from "@/lib/canonicalCriteria";
import { CANONICAL_CRITERIA } from "@/lib/canonicalCriteria";

export interface Pass1BuildPromptArgs {
  manuscriptTitle?: string | null;
  chapterTitle?: string | null;
  rawText: string;
  criterionSpecs?: Partial<Record<CanonicalCriterionKey, CriterionInjectionSpec>>;
  diagnosticSpecs?: Partial<Record<DiagnosticKey, DiagnosticInjectionSpec>>;
  workType?: "novel" | "screenplay" | "other";
}

export interface CriterionInjectionSpec {
  definition: string;
  observableSignals: string[];
  failureModes: string[];
  falsePositiveFilters: string[];
  scoringAnchors: {
    score3: string[];
    score5: string[];
    score7: string[];
    score9: string[];
  };
  scoreCapRules?: string[];
  systemDependencies?: DiagnosticKey[];
  detectionHooks?: string[];
}

export interface DiagnosticInjectionSpec {
  name: string;
  purpose: string;
  affectsCriteria: CanonicalCriterionKey[];
  detect: string[];
  failure: string[];
  prohibited?: string[];
}

export type DiagnosticKey =
  | "pressure_graph"
  | "escalation_ladder"
  | "reader_compulsion_model"
  | "authority_leak"
  | "breath_timing"
  | "authority_compression"
  | "dam"
  | "scene_entry"
  | "environmental_echo"
  | "story_failure_map";

export const PASS1_SYSTEM_PROMPT = `
You are RevisionGrade Pass 1.

ROLE
You perform structural and craft detection on a submitted manuscript artifact.
You operate post-demarcation under the ABCDEFG authority model:
- ABC = author benchmark calibration (pre-submission only)
- D = market demarcation
- EFG = evaluator / filter / gate domain

You do not coach the author.
You do not preserve author intent.
You do not encourage.
You evaluate execution only.

PASS 1 SCOPE
Pass 1 is the structural detection pass.
You must prioritize:
- observable signals
- failure modes
- score caps
- direct manuscript evidence

You must not prioritize:
- stylistic preference
- literary interpretation
- market optimism
- soft encouragement

GLOBAL RULES
1. Scores must be derived from detected signals, not assigned first and justified later.
2. Scores must be derived from the lowest satisfied band.
3. Upward justification is prohibited.
4. Every criterion must include:
   - score
   - evidence
   - reasoning
5. Evidence must reference real manuscript text.
6. If evidence is weak, reasoning must narrow rather than generalize.
7. Do not use generic critique language.
8. Do not invent canon terms.
9. Do not merge criteria.
10. If a criterion cannot be supported, state the limitation in reasoning rather than fabricating certainty.

PASS 1 OUTPUT STYLE
- concrete
- evidence-led
- structural
- non-generic
- mechanically legible

BANNED PHRASES
Do not use phrases such as:
- "this feels"
- "could be stronger"
- "works well but"
- "generally effective"
- "needs more polish"

Instead:
- identify the structural mechanism
- identify the location
- identify the consequence

OUTPUT REQUIREMENTS
Return valid JSON only.
No markdown.
No prose outside schema.
`.trim();

export const PASS1_JSON_SCHEMA_GUIDE = `
Return JSON with this shape:

{
  "pass": "pass1",
  "summary": {
    "primaryStrength": "string",
    "primaryWeakness": "string",
    "dominantPattern": "string"
  },
  "criteria": [
    {
      "criterionKey": "CONCEPT",
      "criterionName": "Concept & Core Premise",
      "score": 1,
      "bandJustification": {
        "lowestSatisfiedBand": 3,
        "detectedSignals": ["string"],
        "scoreCapApplied": false,
        "scoreCapReason": null
      },
      "evidence": [
        {
          "snippet": "exact manuscript text",
          "char_start": 0,
          "char_end": 25,
          "explanation": "what this evidence demonstrates"
        }
      ],
      "reasoning": {
        "mechanism": "what structurally worked or failed",
        "effect": "why it matters for this criterion",
        "falsePositiveCheck": "what tempting misread was rejected"
      },
      "diagnosticsUsed": ["pressure_graph"],
      "invalidityFlags": []
    }
  ]
}

Rules:
- "criteria" must include all 13 canonical criteria.
- "snippet" must be copied exactly from manuscript text.
- "char_start" and "char_end" must map to that snippet.
- "lowestSatisfiedBand" must be one of: 3, 5, 7, 9.
- "score" may be any integer 1-10, but must not exceed score caps described in injected specs.
- "invalidityFlags" should be empty unless the criterion is materially constrained by missing support.
`.trim();

export const PASS1_CRITERIA_ORDER: CanonicalCriterionKey[] = [
  "CONCEPT",
  "DRIVE",
  "CHARACTER",
  "POV",
  "SCENE",
  "DIALOGUE",
  "THEME",
  "WORLD",
  "PACING",
  "PROSE",
  "TONE",
  "EMOTION",
  "MARKET",
];

export const DEFAULT_PASS1_CRITERION_SPECS: Record<
  CanonicalCriterionKey,
  CriterionInjectionSpec
> = {
  CONCEPT: {
    definition:
      "Measures whether the premise generates sustained conflict, escalation, and differentiation without external forcing.",
    observableSignals: [
      "Central dramatic question identifiable early",
      "Premise creates inevitable conflict",
      "Premise supports multiple axes of tension",
    ],
    failureModes: [
      "Premise is situation rather than conflict",
      "Tension requires artificial plot injection",
      "Central question remains unclear too long",
    ],
    falsePositiveFilters: [
      "High concept is not the same as sustainable premise",
      "Interesting setting is not the same as premise",
    ],
    scoringAnchors: {
      score3: [
        "Central question unclear by end of chapter 3",
        "Conflict requires external forcing",
      ],
      score5: [
        "Premise identifiable but supports only one tension axis",
        "Escalation depends on convenience",
      ],
      score7: [
        "Premise sustains organic conflict with minor convenience dependence",
      ],
      score9: [
        "Premise alone produces multi-axis conflict and structural inevitability",
      ],
    },
    scoreCapRules: [
      "If the central dramatic question is not identifiable within the first three chapters, score cannot exceed 5",
    ],
    systemDependencies: ["story_failure_map"],
    detectionHooks: [
      "opening-question scan",
      "premise-conflict linkage",
      "escalation viability check",
    ],
  },

  DRIVE: {
    definition:
      "Measures whether consequence, pressure, or uncertainty increases across scenes and chapters.",
    observableSignals: [
      "Scenes introduce new risk, consequence, or reduced options",
      "Outcomes propagate forward",
      "Pressure carries across scene boundaries",
    ],
    failureModes: [
      "Scene repetition",
      "Reset-to-neutral scenes",
      "No increase in stakes across sequential scenes",
    ],
    falsePositiveFilters: [
      "Fast writing is not momentum",
      "Many events are not necessarily drive",
      "Emotional intensity is not escalation",
    ],
    scoringAnchors: {
      score3: [
        "Two or more consecutive scenes with identical function",
        "No increase in stakes across chapter",
      ],
      score5: ["Escalation exists but plateaus for multiple scenes"],
      score7: ["Pressure generally rises with minor plateau segments"],
      score9: ["Every scene alters risk, consequence, or available options"],
    },
    scoreCapRules: [
      "If pressure plateaus for 4 or more consecutive chapters, score cannot exceed 5",
    ],
    systemDependencies: [
      "pressure_graph",
      "escalation_ladder",
      "reader_compulsion_model",
    ],
    detectionHooks: [
      "scene-end pressure carry scan",
      "options-narrowing scan",
      "chapter-level escalation scan",
    ],
  },

  CHARACTER: {
    definition:
      "Measures whether character behavior follows traceable internal logic under pressure.",
    observableSignals: [
      "Actions align with established psychology",
      "Contradictions are motivated",
      "Emotional states evolve rather than reset",
    ],
    failureModes: [
      "Characters act to serve plot",
      "Emotional reset between scenes",
      "Sudden unjustified competence or incompetence",
    ],
    falsePositiveFilters: [
      "Backstory is not depth",
      "Trauma mention is not psychology",
      "Quirkiness is not complexity",
    ],
    scoringAnchors: {
      score3: ["Major actions contradict prior psychology without justification"],
      score5: ["Partially coherent but breaks under plot pressure"],
      score7: ["Behavior mostly consistent with minor instability"],
      score9: ["All major decisions remain traceable to internal logic under stress"],
    },
    systemDependencies: ["dam"],
    detectionHooks: [
      "decision-motive continuity scan",
      "emotional state propagation check",
    ],
  },

  POV: {
    definition:
      "Measures POV stability, voice integrity, thought rendering consistency, and cognitive clarity.",
    observableSignals: [
      "Thought rendering remains stable",
      "Cognitive source is clear",
      "Voice remains consistent within POV channel",
    ],
    failureModes: [
      "Head-hopping",
      "Italicized baseline cognition",
      "Non-audible content placed in dialogue quotes",
    ],
    falsePositiveFilters: [
      "Formatting variety is not POV sophistication",
      "Intensity is not POV instability",
    ],
    scoringAnchors: {
      score3: ["Repeated POV instability or cognition source confusion"],
      score5: ["Mostly stable POV with recurring rendering inconsistency"],
      score7: ["Stable POV with minor channel or formatting issues"],
      score9: ["POV, thought channel, and voice remain consistently authoritative"],
    },
    systemDependencies: ["dam"],
    detectionHooks: [
      "thought-channel consistency scan",
      "speaker/source clarity check",
    ],
  },

  SCENE: {
    definition:
      "Measures whether each scene performs distinct narrative work and alters narrative state.",
    observableSignals: [
      "Scene changes stakes, knowledge, alignment, or decision state",
      "Entry condition is clear",
      "Exit generates forward pressure",
    ],
    failureModes: [
      "Atmospheric-only scenes",
      "Redundant scene function",
      "Dialogue that does not alter trajectory",
    ],
    falsePositiveFilters: [
      "Good prose is not scene function",
      "Interesting moment is not structural contribution",
    ],
    scoringAnchors: {
      score3: ["Scene does not alter narrative state"],
      score5: ["Scene contributes but overlaps function with adjacent scene"],
      score7: ["Scene is functional with minor redundancy or loose exit"],
      score9: ["Scene performs unique function and meaningfully alters trajectory"],
    },
    systemDependencies: ["scene_entry", "story_failure_map"],
    detectionHooks: [
      "scene-state-change test",
      "entry/exit pressure scan",
      "functional redundancy scan",
    ],
  },

  DIALOGUE: {
    definition:
      "Measures whether dialogue reveals character, power, and subtext beyond information delivery.",
    observableSignals: [
      "Speaker-identifiable voice",
      "Power asymmetry present",
      "Subtext diverges from surface speech",
    ],
    failureModes: [
      "Lecture cadence",
      "Exposition delivery",
      "Voice flattening",
      "Ping-pong dialogue",
    ],
    falsePositiveFilters: [
      "Wit is not subtext",
      "Speech realism is not dialogue authority",
    ],
    scoringAnchors: {
      score3: ["Dialogue primarily delivers information"],
      score5: ["Some subtext but frequent exposition delivery"],
      score7: ["Strong differentiation with occasional lecture cadence"],
      score9: ["Dialogue performs multiple functions simultaneously and silence carries force"],
    },
    systemDependencies: ["dam", "authority_leak"],
    detectionHooks: [
      "speaker-differentiation scan",
      "subtext-vs-surface contrast check",
    ],
  },

  THEME: {
    definition:
      "Measures whether theme emerges through dramatized action, image, and consequence rather than declaration.",
    observableSignals: [
      "Theme emerges through decision and consequence",
      "Motifs accumulate meaning across structure",
      "Counter-positions are dramatized",
    ],
    failureModes: [
      "Thesis sentences",
      "Thematic lecturing",
      "Stacked deck",
      "Motifs without accumulation",
    ],
    falsePositiveFilters: [
      "Subject matter is not thematic integration",
      "Recurring imagery is not integration if ornamental only",
    ],
    scoringAnchors: {
      score3: ["Theme stated directly instead of dramatized"],
      score5: ["Theme partly dramatized but repeatedly explained"],
      score7: ["Theme largely dramatized with minor thesis leakage"],
      score9: ["Theme fully embedded in action, consequence, and structural position"],
    },
    scoreCapRules: [
      "If a character or narrator directly states the thematic point, score cannot exceed 6",
    ],
    systemDependencies: ["authority_leak", "authority_compression"],
    detectionHooks: [
      "thesis-sentence scan",
      "motif recurrence check",
      "counter-position presence test",
    ],
  },

  WORLD: {
    definition:
      "Measures whether physical, social, and institutional systems behave consistently and constrain characters.",
    observableSignals: [
      "Environment limits options",
      "Institutional rules remain consistent",
      "Geography and logistics matter",
    ],
    failureModes: [
      "Convenience geography",
      "Institutional inconsistency",
      "Tourism writing",
      "Static environment",
    ],
    falsePositiveFilters: [
      "Detail volume is not world-building",
      "Exotic setting is not coherence",
    ],
    scoringAnchors: {
      score3: ["Environment functions as backdrop only"],
      score5: ["Mostly coherent but weak as active constraint"],
      score7: ["Environment functions as system with minor convenience issues"],
      score9: ["World actively constrains, enables, and reacts with full internal logic"],
    },
    systemDependencies: ["scene_entry", "environmental_echo"],
    detectionHooks: [
      "constraint-based interaction test",
      "geography/logistics consistency scan",
    ],
  },

  PACING: {
    definition:
      "Measures the rhythm of tension and release across chapters and the full manuscript.",
    observableSignals: [
      "Tension/release alternation exists",
      "Act proportions feel functional",
      "Scene density varies by narrative need",
    ],
    failureModes: [
      "Mid-novel stagnation",
      "Front-loading",
      "Rushed ending",
      "Uniform intensity",
    ],
    falsePositiveFilters: [
      "Fast-paced is not well-paced",
      "Short chapters are not good pacing",
      "High event count is not balance",
    ],
    scoringAnchors: {
      score3: ["Pressure flatlines across multiple chapters"],
      score5: ["Recognizable pressure architecture with major plateaus"],
      score7: ["Functional pressure rhythm with limited structural imbalance"],
      score9: ["Purposeful pressure architecture with effective tension/release management"],
    },
    scoreCapRules: [
      "If pressure plateaus for 4 or more chapters, score cannot exceed 5",
    ],
    systemDependencies: [
      "pressure_graph",
      "escalation_ladder",
      "breath_timing",
      "reader_compulsion_model",
    ],
    detectionHooks: [
      "chapter-pressure trend scan",
      "act-proportion scan",
      "scene-density variation check",
    ],
  },

  PROSE: {
    definition:
      "Measures whether sentence and paragraph execution is precise, controlled, and free from mechanical drag.",
    observableSignals: [
      "Sentence rhythm varies with function",
      "Word choice is specific",
      "Repetition is motivated",
      "Paragraphing contributes to pacing",
    ],
    failureModes: [
      "Mechanical repetition",
      "Adjective dependency",
      "Filter-word drag",
      "Overwriting",
      "Purple prose",
    ],
    falsePositiveFilters: [
      "Lyrical is not the same as controlled",
      "Simple is not the same as weak",
    ],
    scoringAnchors: {
      score3: ["Uniform sentence rhythm and frequent mechanical drag"],
      score5: ["Some control with recurring imprecision or filtering"],
      score7: ["Clear line-level control with isolated over-writing"],
      score9: ["Sentence, paragraph, and white-space control consistently serve function"],
    },
    systemDependencies: [
      "authority_leak",
      "breath_timing",
      "authority_compression",
    ],
    detectionHooks: [
      "filter-word scan",
      "sentence-rhythm scan",
      "repetition-intent check",
    ],
  },

  TONE: {
    definition:
      "Measures whether the manuscript sustains a coherent emotional and aesthetic register appropriate to its genre and stakes.",
    observableSignals: [
      "Tone is identifiable early",
      "Register shifts follow narrative cause",
      "Humor/gravity balance is controlled",
    ],
    failureModes: [
      "Tonal whiplash",
      "Tonal flattening",
      "Genre uncertainty",
      "Inadvertent comedy",
    ],
    falsePositiveFilters: [
      "Consistency is not the same as authority",
      "Dark subject matter is not tonal control",
    ],
    scoringAnchors: {
      score3: ["Tone unstable or genre register unclear"],
      score5: ["Tonal identity present but regularly destabilized"],
      score7: ["Coherent tonal control with occasional unearned shift"],
      score9: ["Tone remains deliberate, genre-appropriate, and event-responsive throughout"],
    },
    systemDependencies: ["dam", "breath_timing", "authority_leak"],
    detectionHooks: [
      "register-stability scan",
      "unintended-humor check",
      "genre-tone coherence check",
    ],
  },

  EMOTION: {
    definition:
      "Measures whether the manuscript produces earned emotional investment through attachment, consequence, and psychological timing.",
    observableSignals: [
      "Emotional beats follow credible buildup",
      "Attachment deepens through dramatized interaction",
      "Consequences alter emotional stakes",
    ],
    failureModes: [
      "Emotion asserted rather than earned",
      "Escalation without attachment",
      "Skipped attachment stages",
    ],
    falsePositiveFilters: [
      "Intense emotion is not earned emotion",
      "Tragic subject matter is not emotional resonance",
    ],
    scoringAnchors: {
      score3: ["Emotional effects are asserted without credible buildup"],
      score5: ["Some resonance but attachment or timing is underdeveloped"],
      score7: ["Meaningful emotional investment with limited under-earning"],
      score9: ["Emotional impact emerges from fully dramatized attachment and consequence"],
    },
    systemDependencies: ["reader_compulsion_model", "story_failure_map"],
    detectionHooks: [
      "attachment-stage scan",
      "emotional-cause/effect chain check",
    ],
  },

  MARKET: {
    definition:
      "Measures whether the manuscript aligns with identifiable readership, genre expectations, and professional submission viability without becoming derivative.",
    observableSignals: [
      "Genre and readership are legible",
      "Comparable titles are plausible",
      "Professional read signals appear early",
    ],
    failureModes: [
      "Genre ambiguity",
      "Derivative positioning",
      "Mismatch between tone and market promise",
    ],
    falsePositiveFilters: [
      "Topical relevance is not market alignment",
      "Comp title availability is not sufficient positioning",
    ],
    scoringAnchors: {
      score3: ["Readership or market category remains unclear"],
      score5: ["Some market legibility with major positioning instability"],
      score7: ["Clear market lane with minor friction"],
      score9: ["Strong reader/market fit with differentiated positioning and professional-read readiness"],
    },
    systemDependencies: ["pressure_graph", "story_failure_map"],
    detectionHooks: [
      "genre-legibility scan",
      "opening-pages professional-read check",
    ],
  },
};

export const DEFAULT_PASS1_DIAGNOSTICS: Record<
  DiagnosticKey,
  DiagnosticInjectionSpec
> = {
  pressure_graph: {
    name: "Narrative Pressure Graph",
    purpose: "Tracks felt pressure rise, plateau, or collapse across chapters.",
    affectsCriteria: ["DRIVE", "PACING", "SCENE", "EMOTION", "MARKET"],
    detect: [
      "pressure plateau",
      "premature peak",
      "pressure collapse",
      "oscillation without escalation",
    ],
    failure: [
      "multiple chapters with no pressure increase",
      "stakes introduced but not sustained",
    ],
  },
  escalation_ladder: {
    name: "Narrative Escalation Ladder",
    purpose: "Tracks whether stakes progress from curiosity to existential consequence.",
    affectsCriteria: ["DRIVE", "PACING", "SCENE", "EMOTION", "MARKET"],
    detect: [
      "curiosity",
      "disruption",
      "risk",
      "irreversibility",
      "existential stakes",
    ],
    failure: ["plateau", "false escalation", "reset pattern"],
  },
  reader_compulsion_model: {
    name: "Reader Compulsion Model",
    purpose: "Tracks curiosity, tension, partial revelation, and renewed uncertainty.",
    affectsCriteria: ["DRIVE", "PACING", "SCENE", "DIALOGUE", "EMOTION"],
    detect: [
      "active questions",
      "resolution delay",
      "partial reward",
      "compulsion density",
    ],
    failure: [
      "scenes without unanswered questions",
      "conflict resolves immediately",
    ],
  },
  authority_leak: {
    name: "Authority Leak Detection",
    purpose: "Detects explanatory overreach that replaces dramatization.",
    affectsCriteria: ["PROSE", "TONE", "DRIVE", "DIALOGUE", "THEME"],
    detect: [
      "confirmation sentences",
      "thesis statements",
      "interpretive echoes",
      "emotional summary closures",
    ],
    failure: ["explanation replaces dramatization"],
    prohibited: [
      "remove lines without checking forward-hook dependency",
      "infer theme from summary language alone",
    ],
  },
  breath_timing: {
    name: "Breath Timing",
    purpose: "Tracks sentence and paragraph rhythm as pacing/authority signal.",
    affectsCriteria: ["PROSE", "PACING", "TONE"],
    detect: ["sentence variance", "cadence shifts", "white-space function"],
    failure: ["uniform rhythm", "stacked abstraction"],
  },
  authority_compression: {
    name: "Authority Compression",
    purpose: "Identifies redundant explanation that lowers authority.",
    affectsCriteria: ["PROSE", "THEME", "TONE"],
    detect: ["redundant explanation", "reader-already-knows sentence"],
    failure: ["thesis restatement", "interpretive echo"],
    prohibited: ["structural compression", "forward-hook deletion"],
  },
  dam: {
    name: "Differentiated Authority Model",
    purpose: "Preserves voice separation across POVs and major speakers.",
    affectsCriteria: ["POV", "DIALOGUE", "CHARACTER", "TONE"],
    detect: ["voice flattening", "POV inconsistency", "cognitive register drift"],
    failure: [
      "identical cognitive voice across POVs",
      "compression removes character identity",
    ],
    prohibited: ["normalize voice across POVs"],
  },
  scene_entry: {
    name: "Scene Entry Doctrine",
    purpose: "Checks whether scene openings begin with behavior, pressure, or decision rather than atmospheric reset.",
    affectsCriteria: ["SCENE", "DRIVE", "WORLD", "PROSE"],
    detect: [
      "character action entry",
      "threat-signal entry",
      "environment-first opening",
    ],
    failure: ["atmospheric reset", "behavior-free opening"],
  },
  environmental_echo: {
    name: "Environmental Echo Chain",
    purpose: "Detects repeated atmospheric framing that replaces motion or differentiation.",
    affectsCriteria: ["WORLD", "PROSE", "DRIVE", "TONE"],
    detect: ["repeated environmental clusters", "opening repetition"],
    failure: ["atmospheric redundancy", "tonal flattening"],
  },
  story_failure_map: {
    name: "Story Failure Map",
    purpose: "Maps structural breakdown zones that propagate through the manuscript.",
    affectsCriteria: ["CONCEPT", "DRIVE", "SCENE", "PACING", "PROSE", "EMOTION", "MARKET"],
    detect: [
      "concept instability",
      "structural drift",
      "escalation collapse",
      "scene redundancy",
      "consequence failure",
    ],
    failure: ["cascade from concept weakness to disengagement"],
  },
};

export function buildPass1Prompt(args: Pass1BuildPromptArgs): string {
  const manuscriptBlock = buildManuscriptContext(args);
  const criteriaBlock = buildCriteriaInjectionBlock(args);
  const diagnosticsBlock = buildDiagnosticsInjectionBlock(args);
  const evaluationInstructions = buildEvaluationInstructions(args.workType ?? "novel");

  return [
    PASS1_SYSTEM_PROMPT,
    "",
    "=== OUTPUT SCHEMA ===",
    PASS1_JSON_SCHEMA_GUIDE,
    "",
    "=== EVALUATION INSTRUCTIONS ===",
    evaluationInstructions,
    "",
    "=== CANONICAL CRITERIA INJECTION ===",
    criteriaBlock,
    "",
    "=== DIAGNOSTIC SYSTEMS INJECTION ===",
    diagnosticsBlock,
    "",
    "=== MANUSCRIPT CONTEXT ===",
    manuscriptBlock,
    "",
    "Now evaluate the submitted chapter artifact under Pass 1 rules and return JSON only.",
  ].join("\n");
}

export function buildPass1UserPrompt(args: Pass1BuildPromptArgs): string {
  return [
    `Work type: ${args.workType ?? "novel"}`,
    `Manuscript title: ${args.manuscriptTitle ?? "Untitled"}`,
    `Chapter title: ${args.chapterTitle ?? "Untitled chapter"}`,
    "",
    "Evaluate all 13 canonical criteria.",
    "Use only structural/craft detection appropriate to Pass 1.",
    "Use exact evidence snippets copied from the manuscript.",
    "Return JSON only.",
    "",
    "MANUSCRIPT TEXT:",
    args.rawText,
  ].join("\n");
}

function buildManuscriptContext(args: Pass1BuildPromptArgs): string {
  return [
    `Work type: ${args.workType ?? "novel"}`,
    `Manuscript title: ${args.manuscriptTitle ?? "Untitled"}`,
    `Chapter title: ${args.chapterTitle ?? "Untitled chapter"}`,
    "",
    args.rawText,
  ].join("\n");
}

function buildCriteriaInjectionBlock(args: Pass1BuildPromptArgs): string {
  const specs = {
    ...DEFAULT_PASS1_CRITERION_SPECS,
    ...(args.criterionSpecs ?? {}),
  };

  return PASS1_CRITERIA_ORDER.map((criterionKey) => {
    const criterionName =
      CANONICAL_CRITERIA[criterionKey]?.label ?? criterionKey;

    const spec = specs[criterionKey];
    if (!spec) {
      return [
        `CRITERION ${criterionKey} — ${criterionName}`,
        `Definition: Use canonical criterion only.`,
      ].join("\n");
    }

    return [
      `CRITERION ${criterionKey} — ${criterionName}`,
      `Definition: ${spec.definition}`,
      `Observable Signals: ${spec.observableSignals.join("; ")}`,
      `Failure Modes: ${spec.failureModes.join("; ")}`,
      `False Positive Filters: ${spec.falsePositiveFilters.join("; ")}`,
      `Scoring Anchor 3: ${spec.scoringAnchors.score3.join("; ")}`,
      `Scoring Anchor 5: ${spec.scoringAnchors.score5.join("; ")}`,
      `Scoring Anchor 7: ${spec.scoringAnchors.score7.join("; ")}`,
      `Scoring Anchor 9: ${spec.scoringAnchors.score9.join("; ")}`,
      `Score Caps: ${(spec.scoreCapRules ?? []).join("; ") || "None"}`,
      `Detection Hooks: ${(spec.detectionHooks ?? []).join("; ") || "None"}`,
      `System Dependencies: ${(spec.systemDependencies ?? []).join(", ") || "None"}`,
    ].join("\n");
  }).join("\n\n");
}

function buildDiagnosticsInjectionBlock(args: Pass1BuildPromptArgs): string {
  const mergedCriteria = {
    ...DEFAULT_PASS1_CRITERION_SPECS,
    ...(args.criterionSpecs ?? {}),
  };

  const mergedDiagnostics = {
    ...DEFAULT_PASS1_DIAGNOSTICS,
    ...(args.diagnosticSpecs ?? {}),
  };

  const neededDiagnostics = new Set<DiagnosticKey>();

  for (const key of PASS1_CRITERIA_ORDER) {
    const deps = mergedCriteria[key]?.systemDependencies ?? [];
    deps.forEach((dep) => neededDiagnostics.add(dep));
  }

  return Array.from(neededDiagnostics)
    .map((diagKey) => {
      const diag = mergedDiagnostics[diagKey];
      if (!diag) return null;

      return [
        `DIAGNOSTIC ${diagKey} — ${diag.name}`,
        `Purpose: ${diag.purpose}`,
        `Affects Criteria: ${diag.affectsCriteria.join(", ")}`,
        `Detect: ${diag.detect.join("; ")}`,
        `Failure: ${diag.failure.join("; ")}`,
        `Prohibited: ${(diag.prohibited ?? []).join("; ") || "None"}`,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildEvaluationInstructions(workType: Pass1BuildPromptArgs["workType"]): string {
  return [
    `Work type mode: ${workType ?? "novel"}`,
    "Evaluate all 13 criteria in canonical order.",
    "Use exact manuscript snippets for evidence.",
    "Evidence must support the score directly.",
    "Use score caps where triggered.",
    "Use false-positive filters to avoid inflated scoring.",
    "Do not perform Pass 2 literary interpretation.",
    "Do not smooth ambiguity; identify the structural mechanism instead.",
    "If support is insufficient, narrow the claim instead of generalizing.",
  ].join("\n");
}
```

---

## `src/evaluation/finalizer.ts`

```typescript
// ========================================================
// src/evaluation/finalizer.ts
// RevisionGrade — Deterministic Finalizer
// Finalizer must be dumb:
// - no interpretation
// - no repair
// - no smoothing
// - only validate or reject
// ========================================================

import type { CanonicalCriterionKey } from "@/lib/canonicalCriteria";
import type { GateFailure, GateResult, ValidityState } from "./gates";

export interface FinalizerEvidenceItem {
  snippet: string;
  char_start: number;
  char_end: number;
  explanation?: string;
}

export interface FinalizerCriterion {
  criterionKey: CanonicalCriterionKey;
  criterionName: string;
  finalScore?: number;
  validityState: "VALID" | "DISPUTED";
  convergence: {
    agreementType: "FULL" | "PARTIAL" | "DISPUTED";
    scoreDelta: number;
    overlapEvidenceExists: boolean;
    arbitrationBasis:
      | "PASS1_PREVAILS"
      | "PASS2_PREVAILS"
      | "MERGED_SHARED_EVIDENCE"
      | "DISPUTED_UNRESOLVED";
    arbitrationReason: string;
  };
  pass1: {
    score: number;
    lowestSatisfiedBand: 3 | 5 | 7 | 9;
    evidenceCount: number;
  };
  pass2: {
    score: number;
    lowestSatisfiedBand: 3 | 5 | 7 | 9;
    evidenceCount: number;
  };
  evidence: FinalizerEvidenceItem[];
  reasoning: {
    mechanism: string;
    effect: string;
    falsePositiveCheck: string;
  };
  diagnosticsUsed: string[];
  invalidityFlags: string[];
}

export interface FinalizerInput {
  pipelineRunId: string;
  manuscriptId: string;
  chapterId: string;
  pass3Output: {
    pass: "pass3";
    summary: {
      convergenceSummary: string;
      dominantAgreementPattern: string;
      dominantDisagreementPattern: string;
      disputedCriteria: CanonicalCriterionKey[];
    };
    criteria: FinalizerCriterion[];
  };
  gateResult: GateResult;
}

export interface FinalizerArtifact {
  pipelineRunId: string;
  manuscriptId: string;
  chapterId: string;
  finalState: ValidityState;
  canonicalArtifactAllowed: boolean;
  blockedBy: string[];
  disputedCriteria: CanonicalCriterionKey[];
  acceptedCriteria: CanonicalCriterionKey[];
  summary: {
    convergenceSummary: string;
    dominantAgreementPattern: string;
    dominantDisagreementPattern: string;
  };
  governance: {
    failClosed: true;
    finalizerMode: "deterministic";
    interpretedAnything: false;
    repairedAnything: false;
    smoothedAnything: false;
  };
  failures: GateFailure[];
}

export function finalizeEvaluation(
  input: FinalizerInput
): FinalizerArtifact {
  const { pass3Output, gateResult } = input;

  if (gateResult.validity === "INVALID" || gateResult.failures.length > 0) {
    return buildInvalidArtifact(input, gateResult.failures);
  }

  const disputedCriteria = pass3Output.criteria
    .filter((c) => c.validityState === "DISPUTED")
    .map((c) => c.criterionKey);

  if (disputedCriteria.length > 0) {
    return buildDisputedArtifact(input, disputedCriteria);
  }

  return buildValidArtifact(input);
}

function buildInvalidArtifact(
  input: FinalizerInput,
  failures: GateFailure[]
): FinalizerArtifact {
  return {
    pipelineRunId: input.pipelineRunId,
    manuscriptId: input.manuscriptId,
    chapterId: input.chapterId,
    finalState: "INVALID",
    canonicalArtifactAllowed: false,
    blockedBy: uniqueStrings(failures.map((f) => f.code)),
    disputedCriteria: [],
    acceptedCriteria: [],
    summary: {
      convergenceSummary: input.pass3Output.summary.convergenceSummary,
      dominantAgreementPattern:
        input.pass3Output.summary.dominantAgreementPattern,
      dominantDisagreementPattern:
        input.pass3Output.summary.dominantDisagreementPattern,
    },
    governance: {
      failClosed: true,
      finalizerMode: "deterministic",
      interpretedAnything: false,
      repairedAnything: false,
      smoothedAnything: false,
    },
    failures,
  };
}

function buildDisputedArtifact(
  input: FinalizerInput,
  disputedCriteria: CanonicalCriterionKey[]
): FinalizerArtifact {
  const acceptedCriteria = input.pass3Output.criteria
    .filter((c) => c.validityState === "VALID")
    .map((c) => c.criterionKey);

  return {
    pipelineRunId: input.pipelineRunId,
    manuscriptId: input.manuscriptId,
    chapterId: input.chapterId,
    finalState: "DISPUTED",
    canonicalArtifactAllowed: false,
    blockedBy: ["DISPUTED_CRITERIA_PRESENT"],
    disputedCriteria,
    acceptedCriteria,
    summary: {
      convergenceSummary: input.pass3Output.summary.convergenceSummary,
      dominantAgreementPattern:
        input.pass3Output.summary.dominantAgreementPattern,
      dominantDisagreementPattern:
        input.pass3Output.summary.dominantDisagreementPattern,
    },
    governance: {
      failClosed: true,
      finalizerMode: "deterministic",
      interpretedAnything: false,
      repairedAnything: false,
      smoothedAnything: false,
    },
    failures: [],
  };
}

function buildValidArtifact(
  input: FinalizerInput
): FinalizerArtifact {
  const acceptedCriteria = input.pass3Output.criteria.map(
    (c) => c.criterionKey
  );

  return {
    pipelineRunId: input.pipelineRunId,
    manuscriptId: input.manuscriptId,
    chapterId: input.chapterId,
    finalState: "VALID",
    canonicalArtifactAllowed: true,
    blockedBy: [],
    disputedCriteria: [],
    acceptedCriteria,
    summary: {
      convergenceSummary: input.pass3Output.summary.convergenceSummary,
      dominantAgreementPattern:
        input.pass3Output.summary.dominantAgreementPattern,
      dominantDisagreementPattern:
        input.pass3Output.summary.dominantDisagreementPattern,
    },
    governance: {
      failClosed: true,
      finalizerMode: "deterministic",
      interpretedAnything: false,
      repairedAnything: false,
      smoothedAnything: false,
    },
    failures: [],
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
```

---

## `src/evaluation/validate-and-finalize.ts`

```typescript
import { runEvaluationGates } from "./gates";
import { finalizeEvaluation } from "./finalizer";

export function validateAndFinalize({
  pipelineRunId,
  manuscriptId,
  chapterId,
  manuscriptText,
  pass3Output,
}: {
  pipelineRunId: string;
  manuscriptId: string;
  chapterId: string;
  manuscriptText: string;
  pass3Output: any;
}) {
  const gateResult = runEvaluationGates(pass3Output, manuscriptText);

  return finalizeEvaluation({
    pipelineRunId,
    manuscriptId,
    chapterId,
    pass3Output,
    gateResult,
  });
}
```

---

## `tests/evaluation/gates.test.ts`

```typescript
import { runEvaluationGates } from "@/evaluation/gates";

const manuscriptText = "Hello world. This is a chapter with exact evidence.";

function makeValidCriterion(key: any) {
  return {
    criterionKey: key,
    score: 7,
    evidence: [
      {
        snippet: "Hello world",
        char_start: 0,
        char_end: 11,
        explanation: "Opening evidence",
      },
    ],
    reasoning: {
      mechanism: "Concrete mechanism",
      effect: "Concrete effect",
      falsePositiveCheck: "Rejected a tempting but unsupported reading",
    },
  };
}

const KEYS = [
  "CONCEPT","DRIVE","CHARACTER","POV","SCENE","DIALOGUE","THEME",
  "WORLD","PACING","PROSE","TONE","EMOTION","MARKET",
];

describe("runEvaluationGates", () => {
  test("returns VALID for structurally complete compliant output", () => {
    const response = {
      pass: "pass3" as const,
      criteria: KEYS.map(makeValidCriterion),
    };

    const result = runEvaluationGates(response, manuscriptText);
    expect(result.validity).toBe("VALID");
    expect(result.failures).toHaveLength(0);
  });

  test("fails EG-9 when criteria count is not 13", () => {
    const response = {
      pass: "pass1" as const,
      criteria: KEYS.slice(0, 12).map(makeValidCriterion),
    };

    const result = runEvaluationGates(response, manuscriptText);
    expect(result.validity).toBe("INVALID");
    expect(result.failures.some(f => f.code === "EG9_CRITERIA_COUNT_MISMATCH")).toBe(true);
  });

  test("fails EG-8 when a criterion is missing evidence", () => {
    const criteria = KEYS.map(makeValidCriterion);
    criteria[0].evidence = [];

    const result = runEvaluationGates({ pass: "pass2", criteria }, manuscriptText);
    expect(result.validity).toBe("INVALID");
    expect(result.failures.some(f => f.code === "EG8_MISSING_EVIDENCE")).toBe(true);
  });

  test("fails EG-6 when snippet does not match offsets", () => {
    const criteria = KEYS.map(makeValidCriterion);
    criteria[0].evidence = [
      {
        snippet: "Wrong text",
        char_start: 0,
        char_end: 11,
        explanation: "Bad anchor",
      },
    ];

    const result = runEvaluationGates({ pass: "pass1", criteria }, manuscriptText);
    expect(result.validity).toBe("INVALID");
    expect(result.failures.some(f => f.code === "EG6_SNIPPET_MISMATCH")).toBe(true);
  });

  test("fails EG-7 when banned language appears", () => {
    const criteria = KEYS.map(makeValidCriterion);
    criteria[0].reasoning.effect = "This feels weak in the middle.";

    const result = runEvaluationGates({ pass: "pass2", criteria }, manuscriptText);
    expect(result.validity).toBe("INVALID");
    expect(result.failures.some(f => f.code === "EG7_BANNED_LANGUAGE")).toBe(true);
  });
});
```

---

## `tests/evaluation/finalizer.test.ts`

```typescript
import { finalizeEvaluation } from "@/evaluation/finalizer";

const baseInput = {
  pipelineRunId: "run_1",
  manuscriptId: "ms_1",
  chapterId: "ch_1",
  pass3Output: {
    pass: "pass3" as const,
    summary: {
      convergenceSummary: "Mostly converged",
      dominantAgreementPattern: "Evidence overlap",
      dominantDisagreementPattern: "Minor score deltas",
      disputedCriteria: [],
    },
    criteria: [
      {
        criterionKey: "CONCEPT",
        criterionName: "Concept & Core Premise",
        finalScore: 7,
        validityState: "VALID" as const,
        convergence: {
          agreementType: "FULL" as const,
          scoreDelta: 0,
          overlapEvidenceExists: true,
          arbitrationBasis: "MERGED_SHARED_EVIDENCE" as const,
          arbitrationReason: "Same evidence and same mechanism",
        },
        pass1: { score: 7, lowestSatisfiedBand: 7 as const, evidenceCount: 1 },
        pass2: { score: 7, lowestSatisfiedBand: 7 as const, evidenceCount: 1 },
        evidence: [
          { snippet: "Hello world", char_start: 0, char_end: 11, explanation: "anchor" },
        ],
        reasoning: {
          mechanism: "Strong premise signal",
          effect: "Supports concept score",
          falsePositiveCheck: "Not merely high concept",
        },
        diagnosticsUsed: [],
        invalidityFlags: [],
      },
    ],
  },
};

describe("finalizeEvaluation", () => {
  test("returns INVALID when gate failures exist", () => {
    const artifact = finalizeEvaluation({
      ...baseInput,
      gateResult: {
        validity: "INVALID",
        failures: [{ code: "EG6_SNIPPET_MISMATCH", message: "Mismatch" }],
      },
    });

    expect(artifact.finalState).toBe("INVALID");
    expect(artifact.canonicalArtifactAllowed).toBe(false);
    expect(artifact.blockedBy).toContain("EG6_SNIPPET_MISMATCH");
  });

  test("returns DISPUTED when any criterion is disputed", () => {
    const disputedInput = {
      ...baseInput,
      pass3Output: {
        ...baseInput.pass3Output,
        criteria: [
          {
            ...baseInput.pass3Output.criteria[0],
            validityState: "DISPUTED" as const,
            convergence: {
              agreementType: "DISPUTED" as const,
              scoreDelta: 3,
              overlapEvidenceExists: false,
              arbitrationBasis: "DISPUTED_UNRESOLVED" as const,
              arbitrationReason: "No shared evidence basis",
            },
          },
        ],
      },
      gateResult: {
        validity: "VALID" as const,
        failures: [],
      },
    };

    const artifact = finalizeEvaluation(disputedInput);
    expect(artifact.finalState).toBe("DISPUTED");
    expect(artifact.canonicalArtifactAllowed).toBe(false);
    expect(artifact.blockedBy).toContain("DISPUTED_CRITERIA_PRESENT");
  });

  test("returns VALID when no gate failures and no disputes exist", () => {
    const artifact = finalizeEvaluation({
      ...baseInput,
      gateResult: { validity: "VALID", failures: [] },
    });

    expect(artifact.finalState).toBe("VALID");
    expect(artifact.canonicalArtifactAllowed).toBe(true);
    expect(artifact.blockedBy).toHaveLength(0);
  });
});
```

---

## `tests/evaluation/pass3-disputed.test.ts`

```typescript
import { buildPass3Prompt } from "@/prompts/pass3-synthesis";

const args = {
  manuscriptTitle: "Test Novel",
  chapterTitle: "Chapter 1",
  rawText: "Hello world. This is manuscript text.",
  workType: "novel" as const,
  pass1Output: {
    pass: "pass1" as const,
    criteria: [
      {
        criterionKey: "DRIVE",
        criterionName: "Narrative Drive & Momentum",
        score: 4,
        bandJustification: {
          lowestSatisfiedBand: 3 as const,
          detectedSignals: ["plateau"],
          scoreCapApplied: false,
          scoreCapReason: null,
        },
        evidence: [
          {
            snippet: "Hello world",
            char_start: 0,
            char_end: 11,
            explanation: "pass1 anchor",
          },
        ],
        reasoning: {
          mechanism: "Pressure plateau",
          effect: "Weak drive",
          falsePositiveCheck: "Not just calm prose",
        },
        diagnosticsUsed: ["pressure_graph"],
        invalidityFlags: [],
      },
    ],
    summary: {},
  },
  pass2Output: {
    pass: "pass2" as const,
    criteria: [
      {
        criterionKey: "DRIVE",
        criterionName: "Narrative Drive & Momentum",
        score: 7,
        bandJustification: {
          lowestSatisfiedBand: 7 as const,
          detectedSignals: ["compulsion present"],
          scoreCapApplied: false,
          scoreCapReason: null,
        },
        evidence: [
          {
            snippet: "This is manuscript",
            char_start: 13,
            char_end: 31,
            explanation: "pass2 anchor",
          },
        ],
        reasoning: {
          mechanism: "Curiosity loop",
          effect: "Supports stronger drive",
          falsePositiveCheck: "Not merely event density",
        },
        diagnosticsUsed: ["reader_compulsion_model"],
        invalidityFlags: [],
      },
    ],
    summary: {},
  },
};

describe("buildPass3Prompt", () => {
  test("includes disputed-rule language in convergence instructions", () => {
    const prompt = buildPass3Prompt(args);
    expect(prompt).toContain("absolute score delta is 3 or more");
    expect(prompt).toContain("mark DISPUTED");
    expect(prompt).toContain("Weighted averaging is prohibited");
  });

  test("includes both pass outputs for same criterion", () => {
    const prompt = buildPass3Prompt(args);
    expect(prompt).toContain("PASS 1");
    expect(prompt).toContain("PASS 2");
    expect(prompt).toContain("Narrative Drive & Momentum");
  });
});
```

---

## Immediate implementation order

1. Replace existing prompt builders with the three prompt files above.
2. Replace the current weighted-average synthesis behavior with the Pass 3 convergence logic.
3. Add `gates.ts`, `finalizer.ts`, and `validate-and-finalize.ts`.
4. Run the tests above.
5. Only after green tests, tune model choice and token budgets.

## Immediate repo edits

Update these files first:

- `src/services/evaluator-layer.ts`
  - swap in `buildPass1Prompt`
  - swap in `buildPass2Prompt`
  - swap in `buildPass3Prompt`

- current synthesis logic
  - remove weighted averaging and crude pass/revise/fail threshold logic

- pipeline final stage
  - call `runEvaluationGates(...)`
  - then `finalizeEvaluation(...)`

## Critical guardrails

Do not:
- add more canon
- expand Volume II further
- tweak theory

Do:
- wire this into runtime
- add validators
- make Finalizer dumb
- let tests tell you what breaks
