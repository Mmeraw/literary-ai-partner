{
  "spec_id": "SYNOPSIS_MASTER_SPEC_v1.0",
  "spec_role": "governing_spec",
  "doc_behavior": {
    "expose_verbatim_to_user": false,
    "allow_paraphrase_of_rules": false,
    "enforcement_mode": "strict"
  },
  "outputs": {
    "versions": [
      {
        "id": "query",
        "name": "Short / Query Synopsis",
        "min_words": 100,
        "max_words": 150,
        "formatting": {
          "spacing": "single",
          "paragraph_line_target": { "min": 3, "max": 6 }
        }
      },
      {
        "id": "standard",
        "name": "Standard Synopsis",
        "min_words": 250,
        "max_words": 500,
        "formatting": {
          "spacing": "double_ok",
          "pages_target": "1-2"
        }
      },
      {
        "id": "extended",
        "name": "Extended Synopsis",
        "min_words": 700,
        "max_words": 1000,
        "formatting": {
          "spacing": "flexible"
        }
      }
    ]
  },
  "global_constraints": {
    "tense": "present",
    "pov": "third_person",
    "ending_policy": "reveal",
    "max_named_characters": 7,
    "avoid_blurb_speak": true,
    "dialogue_policy": {
      "max_quotes": 1,
      "allow_only_if_indispensable": true
    }
  },
  "required_headers": [
    "1. Basic Metadata",
    "2. Premise / Setup",
    "3. Major Plot Points",
    "4. Climax",
    "5. Resolution",
    "6. Themes",
    "7. Style / Voice",
    "8. Market Positioning",
    "9. Closing Note"
  ],
  "header_requirements": {
    "1. Basic Metadata": {
      "fields_required": ["Title", "Genre", "Word Count", "POV", "Author Name", "One-sentence logline"]
    },
    "2. Premise / Setup": {
      "must_include": ["protagonists_named", "inciting_incident", "core_conflict_sentence", "setting_time_cue_minimal"]
    },
    "3. Major Plot Points": {
      "must_include": ["turning_points_count:3-5", "stakes_escalation"],
      "optional_rules": {
        "include_subplots_only_if": ["changes_ending", "materially_raises_stakes"]
      }
    },
    "4. Climax": {
      "must_include": ["decisive_confrontation_named", "objective_vs_antagonist_or_system"]
    },
    "5. Resolution": {
      "must_include": ["outcome_and_fallout", "new_normal", "protagonist_change_sentence"]
    },
    "6. Themes": {
      "must_include": ["theme_bullets_count:2-3"]
    },
    "7. Style / Voice": {
      "must_include": ["tense_pov_confirmation", "tone_sentence", "dual_pov_or_timeline_sentence_if_applicable"]
    },
    "8. Market Positioning": {
      "must_include": ["comps_count:2-3", "differentiation_sentence"],
      "optional": ["intended_audience"]
    },
    "9. Closing Note": {
      "must_include": ["one_resonant_line", "no_cliffhanger"]
    }
  },
  "evaluation": {
    "aims": [
      { "id": "hook", "name": "Hook", "description": "stimulate interest and curiosity", "weight": 1.0 },
      { "id": "genre_tone", "name": "Genre / Tone", "description": "identify narrative category and mood", "weight": 1.0 },
      { "id": "story_essentials", "name": "Story Essentials", "description": "plot, main characters, setting with clarity/economy", "weight": 1.0 },
      { "id": "ending_revealed", "name": "Ending Revealed", "description": "strong, inevitable resolution; no cliffhangers", "weight": 1.0 },
      { "id": "market_signal", "name": "Market Signal", "description": "distinctive and saleable; comps + differentiation", "weight": 1.0 }
    ],
    "pitfalls": [
      { "id": "too_many_characters_or_subplots", "severity": "high" },
      { "id": "theme_instead_of_story", "severity": "high" },
      { "id": "teaser_or_rhetorical_ending", "severity": "high" },
      { "id": "tense_or_pov_inconsistent", "severity": "high" },
      { "id": "adjectival_padding_or_vague_stakes", "severity": "medium" },
      { "id": "missing_emotional_arc", "severity": "medium" }
    ]
  },
  "checklist_rules": [
    { "id": "metadata_complete", "severity": "high" },
    { "id": "premise_clear_by_sentence_3", "severity": "high" },
    { "id": "stakes_escalate_logically", "severity": "high" },
    { "id": "climax_named", "severity": "high" },
    { "id": "resolution_outcome_change_stated", "severity": "high" },
    { "id": "themes_2_to_3_bullets", "severity": "medium" },
    { "id": "style_voice_declared", "severity": "medium" },
    { "id": "market_positioning_present", "severity": "medium" },
    { "id": "closing_note_present", "severity": "low" }
  ],
  "trusted_path": {
    "preserve_original": true,
    "require_preview_before_apply": true,
    "preview_must_include": ["change_count", "waves_affected"],
    "undo": {
      "granularity": ["per_change", "per_wave", "restore_original"]
    },
    "default_apply_scope": {
      "waves": ["high", "medium"]
    }
  }
}