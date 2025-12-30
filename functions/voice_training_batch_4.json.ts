{
  "batch_id": "TS-VR-B4",
  "project": "TOADSTONE",
  "version": "voice_register_v1_training",
  "meta": {
    "source": "TOADSTONE_CLEAN",
    "total_examples": 18,
    "date_created": "2025-12-30",
    "training_purpose": "Voice protection expansion + house style consistency (US/UK) + format violations + filter verbs"
  },
  "distribution": {
    "false_positives": 6,
    "true_positives": 12,
    "severity_breakdown": {
      "low": 6,
      "medium": 9,
      "high": 8
    }
  },
  "examples": [
    {
      "id": "TS-B4-001",
      "chapter": 1,
      "excerpt": ""Yo, yo, when ya gonna learn to beat me at cribbage?"",
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
          "wave_item": "W2.REGISTER.CASUAL_CONTRACTION_OR_CLIP",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Hard-locked dialogue. 'ya/gonna' are intentional voice markers; do not normalize."
        }
      ]
    },
    {
      "id": "TS-B4-002",
      "chapter": 1,
      "excerpt": ""It ain't just ya I'm tryin' to beat. Speakin' of beat, I'm tired. Time for me to hit the fart sack."",
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
          "wave_item": "W2.REGISTER.NONSTANDARD_SPELLING_DIALOGUE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Dialect spellings ('tryin', 'speakin') are part of the character's spoken register."
        },
        {
          "wave_number": 4,
          "wave_item": "W4.PATTERN.REFRAIN_TIC_COUNT",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "STYLE_PATTERN_REVIEW",
          "severity": "medium",
          "correct_action": "review_optional",
          "rationale": "'Time for me to…' can become a detectable repeated engine if used frequently; count + surface density."
        }
      ]
    },
    {
      "id": "TS-B4-003",
      "chapter": 1,
      "excerpt": ""Nah. I'll be along in a while. I've got some stuff I downloaded on my cell phone I wanna read."",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_WANNA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "This is the exact 'wanna-protection' case. Hard-locked dialogue; normalization is forbidden."
        }
      ]
    },
    {
      "id": "TS-B4-004",
      "chapter": 1,
      "excerpt": "_______",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.FORMAT.SECTION_DIVIDER_CONTRACT",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "FORMAT_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "Project divider contract expects a single consistent marker (e.g., '***'). '_______' breaks downstream parsing and consistency."
        },
        {
          "wave_number": 1,
          "wave_item": "W1.FORMAT.SECTION_DIVIDER_NORMALIZE",
          "detected_by_base44": false,
          "is_true_positive": true,
          "label": "FORMAT_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "Normalizer should auto-detect long-underscore divider tokens and offer a safe conversion to the project's divider token."
        }
      ],
      "proposed_revision": "***"
    },
    {
      "id": "TS-B4-005",
      "chapter": 1,
      "excerpt": "Watching this would see many frogs foaming at the mouth.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 9,
          "wave_item": "W9.CLARITY.MISASSIGNED_SUBJECT",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "The grammatical subject is wrong ('Watching this' can't 'see'). Reader stumbles on first pass."
        }
      ],
      "proposed_revision": "Anyone watching would see many frogs foaming at the mouth.",
      "alternatives": [
        "From the shoreline, a watcher would see many frogs foaming at the mouth.",
        "To anyone looking on, many frogs were foaming at the mouth.",
        "A watcher would see frogs foaming at the mouth across the canopy line."
      ]
    },
    {
      "id": "TS-B4-006",
      "chapter": 1,
      "excerpt": "…body odours…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSESTYLE.US_UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "UK spelling inside a US-English project. This is not slang; it's house-style inconsistency that accumulates."
        }
      ],
      "proposed_revision": "…body odors…",
      "alternatives": [
        "…their body odors…",
        "…their heat, breath, and body odors…",
        "…the giants' heat, breath, and body odors…"
      ]
    },
    {
      "id": "TS-B4-007",
      "chapter": 1,
      "excerpt": "…a splash of colour…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSESTYLE.US_UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "UK 'colour' should be normalized if project language is American English."
        }
      ],
      "proposed_revision": "…a splash of color…"
    },
    {
      "id": "TS-B4-008",
      "chapter": 1,
      "excerpt": "…they weren't foolish enough to be blowing their paycheques on cocaine…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSESTYLE.US_UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "UK 'paycheques' in otherwise US-targeted prose; normalize if US house style is selected."
        }
      ],
      "proposed_revision": "…they weren't foolish enough to be blowing their paychecks on cocaine…"
    },
    {
      "id": "TS-B4-009",
      "chapter": 1,
      "excerpt": "As Billy moved towards the tent with his flashlight leading the way, he found it to be eerily quiet.",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.DICTION.FILTERED_PERCEPTION_CLUSTER",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'found it to be' adds distance. Not wrong, but can be tightened without harming voice (narration)."
        }
      ],
      "proposed_revision": "As Billy moved toward the tent, flashlight leading the way, the campsite was eerily quiet.",
      "alternatives": [
        "Billy moved toward the tent, flashlight leading, and the campsite went eerily quiet.",
        "Billy headed for the tent. The beam cut the dark. Too quiet.",
        "Billy walked toward the tent with the flashlight out front. The quiet felt wrong."
      ]
    },
    {
      "id": "TS-B4-010",
      "chapter": 1,
      "excerpt": "Imagining something grabbing him from the sideline blackness, he swept his torch left, right, and behind…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.DICTION.FILTER_VERB_IMAGINING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "PROSE_TIGHTENING",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "'Imagining' is a filter word that can be converted to direct tension without changing meaning."
        }
      ],
      "proposed_revision": "Something might grab him from the sideline blackness. He swept his torch left, right, and behind…",
      "alternatives": [
        "The sideline blackness felt ready to grab him. He swept his torch left, right, and behind…",
        "He swept his torch left, right, and behind—no movement, no shape, no hand in the dark…",
        "He swept the beam left, right, and behind, purging the blackness of anything waiting there…"
      ]
    },
    {
      "id": "TS-B4-011",
      "chapter": 1,
      "excerpt": ""Hey dude, don't ya find it oddly quiet tonight?"",
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
          "wave_item": "W2.REGISTER.NONSTANDARD_DIALOGUE_YA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Hard-locked dialogue; 'ya' is intentional spoken register."
        }
      ]
    },
    {
      "id": "TS-B4-012",
      "chapter": 1,
      "excerpt": ""Yo, yo, bro', time to chill. Enough with the frogs already. Goodnight."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.PATTERN.REPEATED_PHRASE_TIME_TO",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "STYLE_PATTERN_REVIEW",
          "severity": "medium",
          "correct_action": "review_optional",
          "rationale": "'time to' shows up as a recurring rhythmic engine. In dialogue it's allowed; still worth tracking density across chapters."
        }
      ]
    },
    {
      "id": "TS-B4-013",
      "chapter": 1,
      "excerpt": "He brought back water chanting, "Savoury meat, time to dine…"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSESTYLE.US_UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "UK 'Savoury' in narration under US house style should normalize."
        },
        {
          "wave_number": 3,
          "wave_item": "W3.TONE.REGISTER_COLLISION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "medium",
          "correct_action": "review_optional",
          "rationale": "Narration blends elevated description with slang/chant lines. Not wrong; flag as 'confirm intended tonal blend' rather than error."
        }
      ],
      "proposed_revision": "He brought back water chanting, "Savory meat, time to dine…""
    },
    {
      "id": "TS-B4-014",
      "chapter": 1,
      "excerpt": "Military leaders distributed hundreds of millions of amphetamine tablets…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.CLARITY.BELIEF_VS_FACT_CUE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "High-stakes factual-claim density embedded near character interiority can read as narrated fact. Add a cue if this is Billy's belief model."
        }
      ],
      "proposed_revision": "Billy had read—and half-believed—that military leaders had distributed hundreds of millions of amphetamine tablets…",
      "alternatives": [
        "Billy had read claims that military leaders distributed hundreds of millions of amphetamine tablets…",
        "Billy told himself it was true: military leaders distributed hundreds of millions of amphetamine tablets…",
        "Billy remembered the article: military leaders distributed hundreds of millions of amphetamine tablets…"
      ]
    },
    {
      "id": "TS-B4-015",
      "chapter": 1,
      "excerpt": "…painkillers, tranquillizers, and sedatives…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSESTYLE.US_UK_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "UK 'tranquillizers' should be US 'tranquilizers' under American English project settings."
        }
      ],
      "proposed_revision": "…painkillers, tranquilizers, and sedatives…"
    },
    {
      "id": "TS-B4-016",
      "chapter": 1,
      "excerpt": "He thought, Brutus Callaghan, how about healthier choices tomorrow…",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.POV.INTERNAL_THOUGHT_FORMAT_CUE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "review_optional",
          "rationale": "Thought is embedded as comma-splice narration. Consider a clearer thought cue (italics or free-indirect consistency), but preserve voice."
        }
      ],
      "proposed_revision": "He thought, *Brutus Callaghan, how about healthier choices tomorrow…*",
      "alternatives": [
        "He thought: *Brutus Callaghan—healthier choices tomorrow…*",
        "*Brutus Callaghan, healthier choices tomorrow,* he told himself…",
        "Brutus Callaghan—healthier choices tomorrow. He tried to believe it…"
      ]
    },
    {
      "id": "TS-B4-017",
      "chapter": 1,
      "excerpt": "…they would wash their faces and forefeet…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.CLARITY.SPECIES_LEXICON_CONSISTENCY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'forefeet' is intentional species-appropriate diction; do not 'correct' to human anatomy defaults."
        }
      ]
    },
    {
      "id": "TS-B4-018",
      "chapter": 1,
      "excerpt": ""Scouts!\"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.PUNCTUATION.QUOTE_CONSISTENCY",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CONSISTENCY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "Mixed quote punctuation/escaping can be normalized without changing voice (smart quotes, consistent closing)."
        }
      ],
      "proposed_revision": ""Scouts!""
    }
  ],
  "severity_policy": {
    "mapping": {
      "low": "soft",
      "medium": "medium",
      "high": "strong"
    },
    "caps": [
      {
        "if": {
          "register_lock": "hard",
          "style_flags.allow_colloquial": true
        },
        "then": {
          "max_severity_for": [
            "W2.REGISTER.*",
            "W1.SPELLING.CONTRACTION_NORMALIZE"
          ],
          "max_severity": "low"
        }
      }
    ],
    "always_escalate": [
      {
        "reason_code": "SECTION_DIVIDER_CONTRACT",
        "label": "FORMAT_REVIEW",
        "min_severity": "high"
      }
    ]
  }
}