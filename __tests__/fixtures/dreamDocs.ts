export const malformedDreamDocFixture = {
  dream_scores: { quality: "high", readiness: null },
  executive_verdict: 1234,
  market_shelf: {
    best_shelf: "",
    marketable_hook: null,
    market_danger: "  ",
  },
  what_not_to_become: [null, "", 42],
  structural_stack: [null, "bad"],
  arc_map: "not-an-array",
  criterion_analyses: [{ key: "voice", score: "8" }],
  layer_analyses: [1, 2],
  cross_layer_integration: null,
  symbolic_audit: {
    preserved_symbols: ["nope"],
    doctrine_strengths: [""],
    doctrine_risks: null,
    audit_conclusion: 100,
  },
  reader_experience: {
    first_act: "bad",
    middle: null,
    final_act: {},
    aftertaste: null,
  },
  revision_plan: ["bad-entry"],
  releasability: null,
  acceptance_checks: { required_detection: "bad", failure_conditions: null },
  calibration_notes: ["", 10],
  repo_summary: {
    benchmark_name: null,
    source: 22,
    evaluation_type: {},
    overall_score: "90",
    readiness_score: null,
    primary_strengths: "x",
    primary_blockers: null,
    gold_standard_requirement: {},
  },
  manuscript_integrity_issues: ["bad"],
};

export const fullDreamDocFixture = {
  executive_verdict: "Strong manuscript with targeted revision priorities.",
  dream_scores: {
    quality: 89,
    readiness: 84,
    commercial: 78,
    literary: 91,
  },
  market_shelf: {
    best_shelf: "Upmarket Literary Fantasy",
    shelf_neighbors: ["Speculative Literary", "Book Club Fantasy"],
    comparison_space: ["Piranesi", "The Spear Cuts Through Water"],
    marketable_hook: "Mythic courtroom intrigue with intimate POV.",
    market_danger: "Opening pace may underserve commercial readers.",
  },
  what_not_to_become: [
    "Do not flatten the close-third voice into summary exposition.",
    "Do not over-explain symbolic motifs.",
  ],
  structural_stack: [
    {
      layer_name: "Narrative Arc",
      function: "Escalates conflict",
      status: "strong",
      revision_note: "Tighten midpoint reveal placement.",
    },
  ],
  arc_map: [
    {
      act_name: "Act I",
      chapter_range: "1-8",
      primary_function: "World grounding and inciting fracture",
      revision_priority: "Clarify stakes by chapter 3",
    },
  ],
  criterion_analyses: [
    {
      key: "voice",
      score: 9,
      confidence: "High",
      fit_evidence: ["Consistent diction under pressure scenes."],
      gap_evidence: ["Occasional distance during exposition."],
      revision_queue: ["Convert summary blocks to dramatized beats."],
    },
  ],
  layer_analyses: [
    {
      layer_name: "Character Dynamics",
      status: "moderate",
      needed_revision: "Sharpen antagonist interiority windows.",
    },
  ],
  cross_layer_integration: [
    {
      motif: "Water Oaths",
      description: "Connects doctrine and political betrayal",
      integration_quality: "moderate",
      revision_note: "Echo motif in Act III confrontation.",
    },
  ],
  symbolic_audit: {
    preserved_symbols: [
      {
        symbol: "Silver Thread",
        current_function: "Carries memory lineage",
        revision_instruction: "Reinforce in chapter transitions.",
      },
    ],
    doctrine_strengths: ["Clear belief-cost relationship."],
    doctrine_risks: ["One doctrine passage trends abstract."],
    audit_conclusion: "Symbol system is coherent with manageable drift risk.",
  },
  reader_experience: {
    first_act: {
      reader_question: "Can the protagonist trust inherited law?",
      emotional_state: "Curious tension",
      risk: "Slow early disclosure",
    },
    middle: {
      reader_question: "Which alliance survives the doctrine split?",
      emotional_state: "Escalating dread",
      risk: "Secondary arc dilution",
    },
    final_act: {
      reader_question: "Will moral cost match thematic promise?",
      emotional_state: "Cathartic pressure",
      risk: "Resolution compression",
    },
    aftertaste: "Lingering moral unease with earned closure.",
  },
  revision_plan: [
    {
      priority: 1,
      title: "Stakes Compression",
      goal: "Accelerate consequence visibility",
      actions: ["Move tribunal threat to chapter 2."],
      acceptance_check: "Beta readers identify stakes by chapter 3.",
    },
  ],
  releasability: [
    {
      dimension: "Narrative coherence",
      current_status: "Strong with localized drag",
      verdict: "Near-ready",
    },
  ],
  acceptance_checks: {
    required_detection: ["Voice continuity", "Arc escalation"],
    failure_conditions: ["Act II stall", "Symbol contradiction"],
  },
  calibration_notes: ["Benchmark alignment within accepted variance."],
  repo_summary: {
    benchmark_name: "froggin-noggin-dream",
    source: "longform_document_v1",
    evaluation_type: "long_form",
    overall_score: 88,
    readiness_score: 84,
    primary_strengths: ["Voice control", "Thematic integration"],
    primary_blockers: ["Opening pace"],
    gold_standard_requirement: "Resolve Act II propulsion risk before release.",
  },
  manuscript_integrity_issues: [
    {
      kind: "toc_gap",
      description: "One chapter title mismatch in TOC export",
      severity: "minor",
    },
  ],
};

export const canonicalDreamSectionKeys = [
  "executive_verdict",
  "dream_scores",
  "market_shelf",
  "what_not_to_become",
  "structural_stack",
  "arc_map",
  "criterion_analyses",
  "layer_analyses",
  "cross_layer_integration",
  "symbolic_audit",
  "reader_experience",
  "revision_plan",
  "releasability",
  "acceptance_checks",
  "calibration_notes",
  "repo_summary",
] as const;
