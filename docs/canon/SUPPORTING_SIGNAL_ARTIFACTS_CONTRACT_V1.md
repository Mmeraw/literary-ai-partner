# SUPPORTING_SIGNAL_ARTIFACTS_CONTRACT_V1

## Canonical rule

Do **not** add Layer 9.

Keep `pass1a_story_layer_v1` as an eight-layer story-understanding artifact only, with user feedback in `ledger_user_feedback_v1`, approval output in `accepted_story_ledger_v1`, and Phase 2 consuming only approved story understanding plus support artifacts.

## Durable artifact set

Core pipeline artifacts:

1. `dream_calibration_packet_v1`
2. `pass1a_story_layer_v1`
3. `ledger_quality_report_v1`
4. `ledger_user_feedback_v1`
5. `accepted_story_ledger_v1`
6. `story_shape_signal_map_v1`
7. `manuscript_signal_appendix_v1`

Later, if needed:

8. `phase2_evaluation_packet_v1`
9. `phase2_author_response_v1`
10. `evaluation_result_v2`

## Boundary doctrine

Schema the contract; nest the rest.

`story_shape_signal_map_v1` and `manuscript_signal_appendix_v1` are first-class only because they support Phase 2 interpretation and author-facing diagnostics without polluting the eight-layer Story Layer itself.

Marlowe-style outputs such as arc graphs, beat spacing, dialogue ratios, readability, repetition scans, content warnings, and content/market indicators are useful confidence-builders, but they are not foundational story-system layers.

## Phase placement

### Phase 1A core

- `pass1a_story_layer_v1`
- `ledger_quality_report_v1`

### Phase 1A / Phase 2 support

- `story_shape_signal_map_v1`
- `manuscript_signal_appendix_v1`

### User review

- `ledger_user_feedback_v1`

### Approved handoff

- `accepted_story_ledger_v1`

### Phase 2 consumes

- `accepted_story_ledger_v1`
- `dream_calibration_packet_v1`
- `manuscript_evidence_map`
- `story_shape_signal_map_v1`
- `manuscript_signal_appendix_v1`

This preserves the core doctrine: evaluation must not proceed from raw or failed story understanding.

## Dependency and staleness rule

Support artifacts must store:

```ts
accepted_story_ledger_artifact_id: string;
accepted_story_ledger_source_hash: string;
```

If `accepted_story_ledger_v1.source_hash` changes, existing support artifacts are stale. They must be regenerated or marked degraded before Phase 2 uses them.

Support artifacts cannot override accepted story understanding, approval state, or governance warnings.

## Support artifact 1: `story_shape_signal_map_v1`

Purpose: structure-over-time support artifact for Phase 2; not a blocking Story Layer and not authority over `accepted_story_ledger_v1`.

```ts
type StoryShapeSignalMapV1 = RuntimeArtifactEnvelope & {
  artifact_type: "story_shape_signal_map_v1";
  accepted_story_ledger_artifact_id: string;
  accepted_story_ledger_source_hash: string;
  status: "complete" | "partial" | "degraded" | "failed";
  warnings: string[];

  authority: {
    derived_from: [
      "manuscript_evidence_map",
      "accepted_story_ledger_v1",
      "dream_calibration_packet_v1"
    ];
    blocking_story_layer: false;
    phase2_support_artifact: true;
  };

  structural_beats: {
    inciting_incident: BeatSignal | null;
    first_plot_point: BeatSignal | null;
    midpoint_shift: BeatSignal | null;
    second_plot_point: BeatSignal | null;
    climax: BeatSignal | null;
    resolution: BeatSignal | null;
  };

  emotional_arc: {
    overall_direction: "rising" | "falling" | "oscillating" | "flat" | "mixed";
    tonal_band: "lighter" | "neutral" | "darker" | "extreme";
    major_emotional_beats: EmotionalBeat[];
  };

  conflict_shape: {
    conflict_intensity_curve: SignalPoint[];
    dominant_conflict_axes: Array<
      "internal" |
      "interpersonal" |
      "institutional" |
      "environmental" |
      "legal" |
      "moral"
    >;
    escalation_pattern:
      | "steady_escalation"
      | "episodic_spikes"
      | "midpoint_reversal"
      | "late_surge"
      | "diffuse";
  };

  pacing_shape: {
    pacing_pressure_curve: SignalPoint[];
    slowest_spans: EvidencePointer[];
    fastest_spans: EvidencePointer[];
    compression_expansion_notes: string[];
  };

  confidence: {
    beat_location_confidence: "high" | "medium" | "low";
    confidence_rationale: string;
    missing_or_ambiguous_beats: string[];
  };
};

type BeatSignal = {
  label: string;
  narrative_percent_estimate: number;
  chapter_or_section: string;
  evidence_anchors: EvidencePointer[];
  why_this_beat_matters: string;
  confidence: "high" | "medium" | "low";
};

type EmotionalBeat = {
  label: string;
  direction: "positive" | "negative" | "mixed";
  intensity: 1 | 2 | 3 | 4 | 5;
  affected_characters: string[];
  affected_relationships: string[];
  evidence_anchors: EvidencePointer[];
};

type SignalPoint = {
  narrative_percent: number;
  value: number;
  evidence_anchor_id: string;
  note: string;
};

type EvidencePointer = {
  evidence_anchor_id: string;
  chapter_or_section: string;
  excerpt?: string;
};
```

This artifact is where beat structure, emotional movement, conflict curves, and pacing curves live. It supports richer Phase 2 diagnosis similar to beat and arc graphs, but it does not redefine the accepted story map.

## Support artifact 2: `manuscript_signal_appendix_v1`

Purpose: surface/craft/market appendix for Phase 2 and author-facing diagnostics; not a blocking Story Layer.

```ts
type ManuscriptSignalAppendixV1 = RuntimeArtifactEnvelope & {
  artifact_type: "manuscript_signal_appendix_v1";
  accepted_story_ledger_artifact_id: string;
  accepted_story_ledger_source_hash: string;
  status: "complete" | "partial" | "degraded" | "failed";
  warnings: string[];

  authority: {
    blocking_story_layer: false;
    phase2_support_artifact: true;
    author_facing_appendix: true;
  };

  dialogue_narrative_ratio: {
    dialogue_percent: number;
    narrative_percent: number;
    by_pov_owner?: Record<string, {
      dialogue_percent: number;
      narrative_percent: number;
    }>;
    interpretation: string;
  };

  readability_stats: {
    estimated_grade_level: number;
    complexity_score?: number;
    sentence_length_distribution: {
      average_sentence_length: number;
      median_sentence_length: number;
      longest_sentences: EvidencePointer[];
    };
  };

  repetition_scan: {
    repeated_phrases: Array<{
      phrase: string;
      count: number;
      per_100k_words?: number;
      classification:
        | "intentional_motif"
        | "voice_signature"
        | "trauma_rhythm"
        | "lazy_repetition"
        | "uncertain";
      evidence_anchors: EvidencePointer[];
    }>;
  };

  style_density: {
    adverb_density?: number;
    adjective_density?: number;
    cliche_flags: Array<{
      phrase: string;
      count: number;
      evidence_anchors: EvidencePointer[];
    }>;
  };

  content_and_market_signals: {
    genre_primary?: string;
    genre_secondary?: string;
    word_count_band:
      | "short_for_genre"
      | "within_range"
      | "long_for_genre"
      | "very_long";
    tonal_band: "lighter" | "average" | "darker" | "extreme";
    content_warnings: Array<{
      type: string;
      severity: "mild" | "moderate" | "strong" | "severe";
      evidence_anchors: EvidencePointer[];
      recommended_author_facing_phrase: string;
    }>;
  };
};
```

This appendix holds dialogue ratio, readability, repetition, style density, content warnings, and market-facing signals. These categories align with the kinds of report packaging visible in Marlowe-style reports, but they remain non-governing support only.

## Required layer additions

The two support artifacts do not expand the Story Layer count, but they justify a few field additions to existing layers.

### Layer 5 — Relationship Arc Network

Add:

```ts
stakes_type: Array<
  "emotional" |
  "physical" |
  "social" |
  "economic" |
  "existential" |
  "moral" |
  "legal"
>;

stakes_intensity_trajectory:
  | "low_to_high"
  | "high_to_higher"
  | "rupture_to_repair"
  | "rupture_to_loss"
  | "stable_to_transformed"
  | "unresolved";

relationship_pressure_curve: Array<{
  evidence_anchor_id: string;
  pressure_level: 1 | 2 | 3 | 4 | 5;
  note: string;
}>;
```

### Layer 8 — Threat / Antagonist / Pressure + Ending Accountability

Add:

```ts
conflict_axes: Array<
  "internal" |
  "interpersonal" |
  "institutional" |
  "environmental" |
  "legal" |
  "moral"
>;

stakes_resolution_status:
  | "resolved"
  | "transformed"
  | "escalated"
  | "intentionally_unresolved"
  | "accidentally_abandoned";

pressure_escalation_path: Array<{
  evidence_anchor_id: string;
  pressure_source: string;
  target: string;
  escalation_level: 1 | 2 | 3 | 4 | 5;
  outcome: string;
}>;
```

## Implementation instruction

The next concrete schema work should create exactly these two new schema artifacts and no new Story Layer:

1. `story_shape_signal_map_v1`
2. `manuscript_signal_appendix_v1`

Constraint: they remain support artifacts in the larger doctrine, not authority over `accepted_story_ledger_v1`, and not substitutes for Phase 1A story understanding.
