{
  "meta": {
    "source": "TOADSTONE_CLEAN",
    "batch_id": "B2",
    "total_examples": 25,
    "date_created": "2025-12-30",
    "training_purpose": "Expand voice protection patterns: dialogue minimalism, lyrics, real syntax errors vs. colloquial forms, market risk escalation"
  },
  "distribution": {
    "false_positives": 18,
    "true_positives": 7,
    "severity_breakdown": {
      "low": 18,
      "medium": 5,
      "high": 2
    }
  },
  "examples": [
    {
      "id": "TS-B2-001",
      "chapter": 1,
      "excerpt": ""How do you do this?"",
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
          "wave_item": "W2.REGISTER.DIALOGUE_MINIMALISM_OK",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Short, natural dialogue is not a deficiency. Avoid padding for 'completeness.'"
        }
      ]
    },
    {
      "id": "TS-B2-002",
      "chapter": 1,
      "excerpt": ""We got 'em in the bottle. Now how are we going to get 'em out and hold onto 'em? I want to severe skulls! Crack open melons. Split wigs."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 9,
          "wave_item": "W9.CLARITY.WORD_CHOICE_CONFUSION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "Likely intended 'sever skulls' (verb) rather than 'severe skulls' (adjective). This is a true meaning-level error, not voice."
        }
      ]
    },
    {
      "id": "TS-B2-003",
      "chapter": 1,
      "excerpt": ""That's gross. I told you I don't want to do this kinda skulduggery."",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_TOKEN_KINDA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'kinda' is deliberate register. Do not normalize in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-B2-004",
      "chapter": 1,
      "excerpt": ""Yeah, yeah, yeah, come on, we will learn somethin' about frogs that we didn't learn while in biology."",
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
          "wave_item": "W2.REGISTER.DIALECT_APOSTROPHE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Dialect apostrophe ('somethin'') is voice texture. Only review if density harms readability."
        }
      ]
    },
    {
      "id": "TS-B2-005",
      "chapter": 1,
      "excerpt": "Billy wasn't in the mood for tormenting creatures, so he moved to the Jeep to turning something calming on the stereo.",
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
          "wave_item": "W9.SYNTAX.INFINITIVE_BREAK",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "ERROR",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "'to turning' is a grammatical construction error in neutral narration; should be 'to turn on' or restructure."
        }
      ]
    },
    {
      "id": "TS-B2-006",
      "chapter": 1,
      "excerpt": ""Hey, DJ, let's find that pot of gold. Ya know the one! Turn it on."",
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
          "wave_item": "W2.REGISTER.CASUAL_SPELLING_YA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'Ya' is intentional dialogue register. Do not normalize to 'you' in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-B2-007",
      "chapter": 1,
      "excerpt": ""Let's take it to da distance girl / Wanna make ya all mine … I'm gonna lasso ya girl … Stay here wit' me 'n' mark time"",
      "register": "song_lyrics",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.LYRICS_DIALECT_ALLOWED",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Lyrics are a protected stylization zone; do not correct 'da/ya/gonna/wit'' unless clarity collapses."
        }
      ]
    },
    {
      "id": "TS-B2-008",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_FORMS_AINT_TRYIN_SPEAKIN",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "This is coherent, character-anchored speech. 'ain't' and clipped gerunds are not errors in this register."
        }
      ]
    },
    {
      "id": "TS-B2-009",
      "chapter": 1,
      "excerpt": ""I've got some stuff I downloaded on my cell phone I wanna read."",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_CONTRACTION_WANNA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "This is your exact 'wanna' protection case. Do not normalize 'wanna' → 'want to' in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-B2-010",
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
          "wave_number": 13,
          "wave_item": "W13.DIALOGUE.TAGS_NOT_REQUIRED",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Line carries clear voice; do not force dialogue tags or formalize slang."
        }
      ]
    },
    {
      "id": "TS-B2-011",
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
          "wave_item": "W9.CLARITY.MISSING_SUBJECT_AGENT",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "Sentence assigns agency incorrectly ('Watching this' can't 'see'). This is a true clarity/logic error."
        }
      ]
    },
    {
      "id": "TS-B2-012",
      "chapter": 1,
      "excerpt": "…drank silly water from a brown urn.",
      "register": "neutral_narration",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 59,
          "wave_item": "W59.CLARITY.UNKNOWN_IDIOM",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "medium",
          "correct_action": "verify_intent",
          "rationale": "'Silly water' reads like an in-world euphemism (likely alcohol). Not wrong—flag only if reader comprehension is at risk."
        }
      ]
    },
    {
      "id": "TS-B2-013",
      "chapter": 1,
      "excerpt": "Meth was abundant… they weren't foolish enough to be blowing their paycheques on cocaine…",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": true,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 41,
          "wave_item": "W41.HOUSE_STYLE.US_SPELLING_PROJECT",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HOUSE_STYLE_MISMATCH",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "In an en-US project, 'paycheques' may be a house-style mismatch unless this is intentionally Canadianized narration."
        }
      ]
    },
    {
      "id": "TS-B2-014",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_GONNA_YA",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Core 'gonna/ya' protection case. Do not normalize colloquial speech in locked dialogue."
        }
      ]
    },
    {
      "id": "TS-B2-015",
      "chapter": 1,
      "excerpt": ""Time to chill, bro'."",
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
          "wave_item": "W2.REGISTER.APOSTROPHE_BRO_PRIME",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Apostrophe stylization ('bro'') is voice. Do not 'correct' to 'bro' unless readability complaints arise."
        }
      ]
    },
    {
      "id": "TS-B2-016",
      "chapter": 1,
      "excerpt": ""Seems like you have something in common with them! … designer zits? Dig!"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 59,
          "wave_item": "W59.CLARITY.ERA_SLANG_FIT",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "verify_intent",
          "rationale": "'Dig!' is coherent but era-coded. Not wrong—only a fit check for intended time/voice."
        }
      ]
    },
    {
      "id": "TS-B2-017",
      "chapter": 1,
      "excerpt": ""Don't forget the harvesting of humans organs."",
      "register": "dialogue",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 9,
          "wave_item": "W9.GRAMMAR.POSSESSIVE_PLURAL",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "Likely intended 'human organs' (adjective) rather than 'humans organs' (missing possessive/apostrophe)."
        }
      ]
    },
    {
      "id": "TS-B2-018",
      "chapter": 1,
      "excerpt": ""I don't want to die. I want a better erection… Gimme Kardashian's butt."",
      "register": "dialogue",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 25,
          "wave_item": "W25.STYLE.LIST_INTENSITY_STACK",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "medium",
          "correct_action": "revise_optional",
          "rationale": "Not a correctness error. Potential rhythm/list-density note if it overwhelms the scene beat, depending on intent."
        }
      ]
    },
    {
      "id": "TS-B2-019",
      "chapter": 1,
      "excerpt": ""Dude, Bralorne and Gold Bridge are in the middle of Hicksville, meant for those who are Tweedledees and Tweedledumbs."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.INSULT_SLURLESS_OK",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Insult register is intentional character voice. No normalization required."
        }
      ]
    },
    {
      "id": "TS-B2-020",
      "chapter": 1,
      "excerpt": ""How do you know he didn't?"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": false
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.FILTER_VERBS.NONE_PRESENT",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "No filter-verb issue exists; avoid manufacturing a rewrite."
        }
      ]
    },
    {
      "id": "TS-B2-021",
      "chapter": 1,
      "excerpt": ""Pull ya out, cuz I am Da Maker / Worship da blade, cuz I am Da Undertaker …"",
      "register": "song_lyrics",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.LYRICS_PHONETIC_SPELLING_OK",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Phonetic spellings ('da/cuz') are deliberate stylization in lyrics. Do not 'correct.'"
        }
      ]
    },
    {
      "id": "TS-B2-022",
      "chapter": 1,
      "excerpt": ""Don't say I don't contribute… slasher fare… Now there's a meal for somethin' later."",
      "register": "neutral_narration",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 14,
          "wave_item": "W14.DIALOGUE_UNDER_PRESSURE_REGISTER_SHIFT",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "verify_intent",
          "rationale": "If this is narrated free-indirect through character voice, slang is correct. Only review if the project intends neutral narration here."
        }
      ]
    },
    {
      "id": "TS-B2-023",
      "chapter": 1,
      "excerpt": ""[ETHNIC SLUR REDACTED]'s plate" (original contains an ethnic slur)",
      "register": "dialogue",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 101,
          "wave_item": "W101.MARKET_RISK.SLUR_OR_DEROGATORY_TERM",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "verify_intent",
          "rationale": "This is not a grammar error. It's a publication/reader-risk signal. Engine must flag for intent/risk handling, not auto-sanitize or silently rewrite."
        }
      ]
    },
    {
      "id": "TS-B2-024",
      "chapter": 1,
      "excerpt": ""Let's embrace dis f—fest girl"",
      "register": "song_lyrics",
      "register_lock": "hard",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_profanity": true
      },
      "wave_issues": [
        {
          "wave_number": 101,
          "wave_item": "W101.MARKET_RISK.EXPLICIT_LANGUAGE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "medium",
          "correct_action": "verify_intent",
          "rationale": "Explicit language in lyrics is permitted by project settings, but should still be optionally flagged for audience-fit (e.g., YA vs adult)."
        }
      ]
    },
    {
      "id": "TS-B2-025",
      "chapter": 1,
      "excerpt": ""Ya know I prefer crazy eights or rummy over cribbage, but ya won't play those games or others ya know I'm better at."",
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
          "wave_item": "W2.REGISTER.COLLOQUIAL_YA_DENSITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "revise_optional",
          "rationale": "Not wrong. Only consider variety if this density becomes monotonous within a single speaker block; never treat as grammar error."
        }
      ]
    }
  ]
}