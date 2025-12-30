{
  "batch_id": "TS-GOLD-V1-SLUR",
  "description": "Controlled-risk gold set for slur and high-risk language handling. NO AUTO-REWRITE ALLOWED.",
  "governance_rules": {
    "no_generative_training": true,
    "slurs_in_context_only": true,
    "auto_rewrite_prohibited": true,
    "classification_required": [
      "VOICE_AUTHENTIC",
      "NARRATIVE_CONDEMNATION",
      "MARKET_RISK",
      "PROHIBITED_USE"
    ]
  },
  "examples": [
    {
      "id": "TS-SLUR-001",
      "chapter": 4,
      "excerpt": "\"You [RACIAL_SLUR],\" he spat, his face twisted with hate.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_profanity": true,
        "contains_slur": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Character antagonist using slur to depict racism; condemns character, not endorses viewpoint",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur in hard-locked dialogue depicts character hostility; preserve for narrative integrity but flag for editorial awareness.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-002",
      "chapter": 2,
      "excerpt": "The word '[RACIAL_SLUR]' hung in the air like poison. She felt her stomach turn.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Narrator explicitly condemns slur usage through metaphor ('poison') and character reaction",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur explicitly condemned by narrative voice; critical for thematic impact. No sanitization.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-003",
      "chapter": 1,
      "excerpt": "\"Don't call me that [GENDER_SLUR]. I'm reclaiming it.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Character explicitly reclaiming slur in dialogue; self-identification, not external attack",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Reclaimed language in-group usage; voice-essential, not offensive in context.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-004",
      "chapter": 5,
      "excerpt": "The [ETHNIC_SLUR]s were taking over the neighborhood, he thought bitterly.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Character interiority reflecting racist POV; not narrator endorsement",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur in character interiority; reveals bigotry without endorsement. Flag for editorial review; do not sanitize.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-005",
      "chapter": 3,
      "excerpt": "Historical note: The term '[HISTORICAL_SLUR]' was commonly used in 1940s medical texts.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "historical_context": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Historical documentation; academic citation, not endorsement",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HISTORICAL_CONTEXT_ONLY",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Historical terminology in academic context; preserve for accuracy but flag for sensitivity review.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-006",
      "chapter": 2,
      "excerpt": "He was just another lazy [ETHNIC_SLUR], the narrator observed with disdain.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "PROHIBITED_USE",
      "narrative_context": "Authorial voice endorsing slur; not character POV or historical context",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "PROHIBITED_USE_DETECTED",
          "severity": "critical",
          "correct_action": "BLOCK_PUBLICATION",
          "rationale": "Narrator voice endorsing slur without condemnation or character filter; violates ethical standards. Block auto-publish; require manual editorial intervention.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-007",
      "chapter": 6,
      "excerpt": "\"Call me [RECLAIMED_SLUR]. That's what we call ourselves now.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "In-group reclamation; speaker identifies with term",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Reclaimed slur in in-group dialogue; voice-essential. No action.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-008",
      "chapter": 1,
      "excerpt": "She flinched at the word '[DISABILITY_SLUR].' It had been used against her since childhood.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Slur mentioned to depict trauma; explicitly condemned through character reaction",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur depicted as source of trauma; narrative condemns usage. Preserve for emotional impact.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-009",
      "chapter": 4,
      "excerpt": "The old man used every [RACIAL_SLUR] he knew, one after another.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Narrator reporting behavior without quoting slurs; implicit condemnation",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": false,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "No explicit slur; narrator summarizing behavior. No flag needed unless pattern density becomes gratuitous.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-010",
      "chapter": 2,
      "excerpt": "\"You people are all the same,\" he said, his voice dripping with contempt.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": false
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Coded bigotry without explicit slur; 'you people' as proxy",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "CODED_LANGUAGE_DETECTION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Coded bigotry in character voice; no explicit slur. Preserve for characterization.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-011",
      "chapter": 3,
      "excerpt": "\"[GENDER_SLUR],\" she whispered to herself, testing the word in her mouth.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Character exploring self-identification; reclamation process",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Self-directed exploration of identity language; voice-essential.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-012",
      "chapter": 5,
      "excerpt": "In 1952, the term '[OUTDATED_MEDICAL_TERM]' appeared in every psychology textbook.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "historical_context": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Historical documentation of medical terminology; academic citation",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HISTORICAL_CONTEXT_ONLY",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Historical medical term in academic context; preserve for accuracy with sensitivity note.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-013",
      "chapter": 1,
      "excerpt": "The playground bullies called him '[DISABILITY_SLUR]' every single day.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Narrator reporting bullying behavior; implicit condemnation through 'bullies' label",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur quoted in context of bullying; narrator condemns. Preserve for emotional impact.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-014",
      "chapter": 4,
      "excerpt": "\"Don't use that word,\" she said sharply. \"It's not the 1950s anymore.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": false
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Character explicitly condemning slur usage (referenced but not quoted)",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": false,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "No explicit slur; character condemning usage. No flag needed.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-015",
      "chapter": 2,
      "excerpt": "\"We used to call ourselves [RECLAIMED_SLUR]s,\" the elder explained to the young ones.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "In-group elder explaining historical usage of reclaimed term",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Reclaimed language in historical in-group context; educational. No action.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-016",
      "chapter": 6,
      "excerpt": "The [ETHNIC_SLUR]s weren't welcome here, and everyone knew it.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "PROHIBITED_USE",
      "narrative_context": "Authorial voice using slur to describe group; not character POV or historical setting",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "PROHIBITED_USE_DETECTED",
          "severity": "critical",
          "correct_action": "BLOCK_PUBLICATION",
          "rationale": "Narrator endorsing slur without character filter; violates ethical standards. Block auto-publish.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-017",
      "chapter": 3,
      "excerpt": "His grandfather had fought for the right not to be called '[ETHNIC_SLUR]' anymore.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Slur referenced in context of civil rights struggle; explicitly condemned",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur in historical justice context; narrative condemns. Preserve for thematic impact.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-018",
      "chapter": 5,
      "excerpt": "\"You're one of the good ones,\" he said, as if it were a compliment.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": false
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Coded racism ('good ones') with narrator signaling disapproval ('as if')",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "CODED_LANGUAGE_DETECTION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Coded bigotry with narrative condemnation; preserve for characterization.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-019",
      "chapter": 1,
      "excerpt": "\"[GENDER_SLUR],\" he spat. \"That's all you'll ever be.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Antagonist using slur as weapon; depicts character bigotry",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur in antagonist dialogue; depicts hostility without endorsement. Flag for editorial review.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-020",
      "chapter": 4,
      "excerpt": "The sign read: 'No [ETHNIC_SLUR]s Allowed.' It was 1963.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "historical_context": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Historical documentation of segregation; date anchors context",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HISTORICAL_CONTEXT_ONLY",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Historical signage in 1963 civil rights context; preserve for accuracy with sensitivity note.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-021",
      "chapter": 2,
      "excerpt": "\"I know what they call us,\" she said quietly. \"But I won't let it define me.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": false
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Character referencing slur without repeating; demonstrates resilience",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": false,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "No explicit slur; character resisting label. No flag needed.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-022",
      "chapter": 6,
      "excerpt": "He hurled every [ETHNIC_SLUR] and [GENDER_SLUR] he could think of.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": false
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Narrator reporting verbal abuse without quoting; 'hurled' signals condemnation",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": false,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "No explicit slurs; narrator summarizing abusive behavior. No flag unless gratuitous.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-023",
      "chapter": 3,
      "excerpt": "\"We're [RECLAIMED_SLUR]s and we're proud,\" the banner read.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Narrator quoting pride banner; in-group reclamation in public space",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Reclaimed language in pride context; narrator reporting factually. No action.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-024",
      "chapter": 5,
      "excerpt": "The [DISABILITY_SLUR]s were kept in the basement, out of sight.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "historical_context": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Historical documentation of institutionalization; condemns practice through 'out of sight'",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HISTORICAL_CONTEXT_ONLY",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Historical term in institutional abuse context; preserve with sensitivity note for accuracy.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-025",
      "chapter": 1,
      "excerpt": "\"I'd rather die than be called a [GENDER_SLUR],\" she said fiercely.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "Character expressing refusal of derogatory label; self-advocacy",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Character rejecting slur label; voice-essential for resistance narrative.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-026",
      "chapter": 4,
      "excerpt": "The teacher said 'colored people' like it was 1965.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": false
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Character observation condemning outdated language; 'like it was 1965' signals disapproval",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "OUTDATED_TERMINOLOGY_DETECTION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Outdated term quoted to critique character; narrative condemns. Preserve.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-027",
      "chapter": 2,
      "excerpt": "\"Where I come from, we call that being a [RECLAIMED_SLUR],\" he said proudly.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "contains_slur": true,
        "reclaimed_language": true
      },
      "slur_classification": "VOICE_AUTHENTIC",
      "narrative_context": "In-group pride statement; regional/cultural in-group usage",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Regional in-group reclamation with pride marker; voice-essential. No action.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-028",
      "chapter": 6,
      "excerpt": "The narrator describes them as [ETHNIC_SLUR]s throughout the text.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": false
      },
      "slur_classification": "PROHIBITED_USE",
      "narrative_context": "Meta-analysis flagging authorial slur usage; not narrative condemnation",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "PROHIBITED_USE_DETECTED",
          "severity": "critical",
          "correct_action": "BLOCK_PUBLICATION",
          "rationale": "Pattern of authorial slur usage flagged; requires editorial review before publication.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-029",
      "chapter": 3,
      "excerpt": "\"The correct term is 'intellectually disabled,' not '[OUTDATED_MEDICAL_TERM],'\" the doctor corrected.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true,
        "historical_context": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Character explicitly correcting outdated terminology; educational moment",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "low",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Outdated term quoted to educate; explicitly condemned. Preserve for pedagogical value.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    },
    {
      "id": "TS-SLUR-030",
      "chapter": 5,
      "excerpt": "\"I hate that word,\" she said when he used '[GENDER_SLUR].'",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "contains_slur": true
      },
      "slur_classification": "NARRATIVE_CONDEMNATION",
      "narrative_context": "Character explicitly condemning slur; emotional response demonstrates harm",
      "wave_issues": [
        {
          "wave_number": 99,
          "wave_item": "SLUR_CONTEXT_CLASSIFICATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_CONTEXT_ALLOWED",
          "severity": "medium",
          "correct_action": "DO_NOT_AUTOREWRITE",
          "rationale": "Slur mentioned to show character pain; explicit condemnation. Preserve for emotional impact.",
          "proposed_revision": null,
          "alternatives": null
        }
      ]
    }
  ]
}