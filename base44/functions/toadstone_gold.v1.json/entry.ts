{
  "batch_id": "TS-GOLD-V1",
  "description": "Combined gold training set from Batches 1-7 for regression validation",
  "examples": [
    {
      "id": "TS-B1-001",
      "chapter": 1,
      "excerpt": "\"I don't give a damn what you think.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Profanity in hard-locked dialogue reflects character voice and emotional state; not an error."
        }
      ]
    },
    {
      "id": "TS-B1-002",
      "chapter": 1,
      "excerpt": "He was gonna make them pay.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.INFORMAL_CONTRACTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Informal register in close-third is consistent with character interiority; not an error unless tone shift is unintended."
        }
      ]
    },
    {
      "id": "TS-B1-003",
      "chapter": 1,
      "excerpt": "The manuscript was alright.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.COLLOQUIAL_PHRASING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'Alright' is colloquial; in neutral narration, replace with 'acceptable' or 'adequate'.",
          "proposed_revision": "The manuscript was acceptable."
        }
      ]
    },
    {
      "id": "TS-B1-004",
      "chapter": 1,
      "excerpt": "She sung the old hymn quietly.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.GRAMMAR.IRREGULAR_VERB_FORM",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HOUSE_STYLE_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "'Sung' is incorrect past tense form; should be 'sang'.",
          "proposed_revision": "She sang the old hymn quietly."
        }
      ]
    },
    {
      "id": "TS-B1-005",
      "chapter": 1,
      "excerpt": "\"You ain't goin' nowhere,\" he said.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.NONSTANDARD_GRAMMAR",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Dialect and double-negative are intentional character markers; correction would erase voice."
        }
      ]
    },
    {
      "id": "TS-B2-001",
      "chapter": 1,
      "excerpt": "The river flowed quietly under the bridge.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.CLARITY.ADVERB_REDUNDANCY",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "low",
          "correct_action": "revise_optional",
          "rationale": "'Quietly' may be implicit in context; consider omitting for tighter prose.",
          "proposed_revision": "The river flowed under the bridge.",
          "alternatives": [
            "The river flowed under the bridge.",
            "The river moved quietly beneath the bridge."
          ]
        }
      ]
    },
    {
      "id": "TS-B2-002",
      "chapter": 1,
      "excerpt": "He literally died laughing.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.CLARITY.LITERAL_VS_FIGURATIVE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CREDIBILITY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "'Literally' signals factual death, but context suggests hyperbole. Resolve ambiguity.",
          "proposed_revision": "He laughed until tears streamed down his face.",
          "alternatives": [
            "He nearly died laughing.",
            "He collapsed in laughter."
          ]
        }
      ]
    },
    {
      "id": "TS-B2-003",
      "chapter": 1,
      "excerpt": "She carefully and meticulously reviewed the document.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.CLARITY.REDUNDANT_MODIFIERS",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'Carefully' and 'meticulously' are near-synonyms; select one for concision.",
          "proposed_revision": "She meticulously reviewed the document.",
          "alternatives": [
            "She carefully reviewed the document.",
            "She reviewed the document with care."
          ]
        }
      ]
    },
    {
      "id": "TS-B4-001",
      "chapter": 1,
      "excerpt": "\"Fuck this,\" she muttered.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Profanity in hard-locked dialogue is voice-essential; sanitization would flatten character."
        }
      ]
    },
    {
      "id": "TS-B4-002",
      "chapter": 1,
      "excerpt": "He was a real asshole about it.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "verify_intent",
          "rationale": "Profanity in soft-locked close-third may reflect character voice; verify if interiority or narrator tone."
        }
      ]
    },
    {
      "id": "TS-B4-003",
      "chapter": 1,
      "excerpt": "The situation was fucked.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "revise_recommended",
          "rationale": "Profanity in neutral narration breaks register expectations; suggest voice-preserving alternative.",
          "proposed_revision": "The situation was dire.",
          "alternatives": [
            "The situation was hopeless.",
            "The situation had deteriorated beyond repair."
          ]
        }
      ]
    },
    {
      "id": "TS-B4-004",
      "chapter": 1,
      "excerpt": "\"Goddamn it,\" he whispered.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.RELIGIOUS_PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Religious profanity in hard-locked dialogue is character voice; no sanitization."
        }
      ]
    },
    {
      "id": "TS-B5-001",
      "chapter": 1,
      "excerpt": "She smiled and nodded.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 5,
          "wave_item": "W5.SMILE_BODY_LANGUAGE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "low",
          "correct_action": "revise_optional",
          "rationale": "'Smiled and nodded' is high-frequency; consider specificity or omission for variety.",
          "proposed_revision": "She nodded once, lips pressed tight.",
          "alternatives": [
            "She gave a slight nod.",
            "She acknowledged him with a nod."
          ]
        }
      ]
    },
    {
      "id": "TS-B5-002",
      "chapter": 1,
      "excerpt": "\"I'm fine,\" she said with a smile.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true
      },
      "wave_issues": [
        {
          "wave_number": 5,
          "wave_item": "W5.SMILE_BODY_LANGUAGE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Smile in dialogue tag is functional; flags only if pattern density becomes distracting."
        }
      ]
    },
    {
      "id": "TS-B5-003",
      "chapter": 1,
      "excerpt": "He smiled warmly at her.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 5,
          "wave_item": "W5.SMILE_BODY_LANGUAGE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'Smiled warmly' is common; add specificity or substitute unique gesture.",
          "proposed_revision": "His expression softened as he looked at her.",
          "alternatives": [
            "He met her eyes, his face relaxing.",
            "A faint smile touched his lips."
          ]
        }
      ]
    },
    {
      "id": "TS-B6-001",
      "chapter": 2,
      "excerpt": "\"You're gonna regret this,\" she said.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.INFORMAL_CONTRACTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Informal contractions in hard-locked dialogue are voice markers; no normalization."
        }
      ]
    },
    {
      "id": "TS-B6-002",
      "chapter": 2,
      "excerpt": "The sky was grey, the clouds heavy with rain.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 7,
          "wave_item": "W7.TYPOGRAPHY.UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HOUSE_STYLE_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "US house style requires 'gray'; UK spelling inconsistent with target market.",
          "proposed_revision": "The sky was gray, the clouds heavy with rain."
        }
      ]
    },
    {
      "id": "TS-B6-003",
      "chapter": 2,
      "excerpt": "She walked down the street, feeling anxious.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 6,
          "wave_item": "W6.EMOTION_LABELING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'Feeling anxious' is emotion-telling; show via physical or sensory detail.",
          "proposed_revision": "She walked down the street, her pulse quickening with every step.",
          "alternatives": [
            "She walked down the street, hands clenched at her sides.",
            "Her breath came shallow as she walked down the street."
          ]
        }
      ]
    },
    {
      "id": "TS-B7-001",
      "chapter": 2,
      "excerpt": "\"Ain't nobody tellin' me what's poison and what ain't.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.NONSTANDARD_GRAMMAR",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Double-negative and vernacular grammar are intentional markers of character voice. Correction would erase sociolect."
        }
      ]
    },
    {
      "id": "TS-B7-002",
      "chapter": 2,
      "excerpt": "The swamp stank of rot, heat, and old promises that never planned to be kept.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.METAPHOR.DENSITY",
          "detected_by_base44": false,
          "is_true_positive": true,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "medium",
          "correct_action": "revise_optional",
          "rationale": "Metaphor density is high but coherent; acceptable unless pacing demands tightening."
        }
      ]
    },
    {
      "id": "TS-B7-003",
      "chapter": 2,
      "excerpt": "He felt the swamp watching him.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 9,
          "wave_item": "W9.ANTHROPOMORPHIC_ATTRIBUTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Anthropomorphic perception is a core atmospheric device; not a literal logic error."
        }
      ]
    },
    {
      "id": "TS-B7-004",
      "chapter": 2,
      "excerpt": "He could almost taste the rot in the air, thick as syrup.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.SENSORY_OVERLAP",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "OPTIONAL_CRAFT_POLISH",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Cross-sensory metaphor is intentional and effective; not an error."
        }
      ]
    },
    {
      "id": "TS-B7-005",
      "chapter": 2,
      "excerpt": "They was already halfway gone by the time he turned.",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.GRAMMAR.SUBJECT_VERB_AGREEMENT",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Nonstandard grammar is intentional and signals class/voice; do not normalize."
        }
      ]
    }
  ]
}