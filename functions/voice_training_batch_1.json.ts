{
  "meta": {
    "source": "TOADSTONE_CLEAN",
    "batch_id": "B1",
    "total_examples": 25,
    "date_created": "2025-12-30",
    "training_purpose": "Teach Base44 to distinguish intentional voice/register from genuine craft issues in colloquial/slang contexts"
  },
  "distribution": {
    "false_positives": 20,
    "true_positives": 5,
    "severity_breakdown": {
      "low": 20,
      "medium": 4,
      "high": 1
    }
  },
  "examples": [
    {
      "id": "TS-CLEAN-B1-001",
      "chapter": 1,
      "excerpt": ""Yo, yo, when ya gonna learn to beat me at cribbage?"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.CASUAL_CONTRACTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Colloquial voice ("ya," "gonna") is intentional in hard-locked dialogue; normalization would flatten character."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-002",
      "chapter": 1,
      "excerpt": ""Ya know I prefer crazy eights or rummy over cribbage, but ya won't play those games…"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Repeated "ya" is consistent character diction; not a correctness error in dialogue."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-003",
      "chapter": 1,
      "excerpt": ""It ain't just ya I'm tryin' to beat. Speakin' of beat, I'm tired. Time for me to hit the fart sack."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.NONSTANDARD_GRAMMAR",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Nonstandard forms ("ain't," clipped -in') are deliberate register; do not standardize in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-004",
      "chapter": 1,
      "excerpt": ""Just so long as it stays in yer sleepin' bag, yo!"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_APOSTROPHE_DENSITY",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Dialect apostrophes are readable and consistent; no density threshold exceeded in this snippet."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-005",
      "chapter": 1,
      "excerpt": ""Time to chill, bro'."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.VOCATIVE_SLANG",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Vocative slang ("bro'") is a voice marker; not an error."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-006",
      "chapter": 1,
      "excerpt": ""I've got some stuff… I wanna read."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.CASUAL_CONTRACTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'Wanna' is protected in hard-locked voice zones; never normalize to 'want to.'"
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-007",
      "chapter": 1,
      "excerpt": ""Hey dude, don't ya find it oddly quiet tonight?"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'Ya' is character diction; no clarity loss."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-008",
      "chapter": 1,
      "excerpt": ""Yo, yo, bro', time to chill. Enough with the frogs already. Goodnight."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 14,
          "wave_item": "W14.DIALOGUE.UNDER_PRESSURE_REGISTER",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Repetition and clipped phrasing are natural speech rhythm; do not 'clean up' in dialogue."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-009",
      "chapter": 1,
      "excerpt": ""This'll make you crazy loco for sex… I ain't got time… Any ho will do."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 5,
          "wave_item": "W5.REGISTER.INTENSITY_PROFANITY",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "medium",
          "correct_action": "verify_intent",
          "rationale": "Sexualized/derogatory terms may be intentional characterization; flag for market/audience fit without sanitizing."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-010",
      "chapter": 1,
      "excerpt": "Billy's past as the occasional "[homophobic slur]"… would forever remain a secret.",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 5,
          "wave_item": "W5.SAFETY.SLUR_OR_DEROGATORY_TERM",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "MARKET_RISK_REVIEW",
          "severity": "high",
          "correct_action": "verify_intent",
          "rationale": "Derogatory slur reference carries audience/market risk; system should flag without rewriting into blandness."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-011",
      "chapter": 1,
      "excerpt": ""…ice, speed, crank… cotton candy, go-go juice, rocket fuel… Scooby snax…"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 53,
          "wave_item": "W53.PROPER_NOUNS.LIST_FEELS_RESEARCHED",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "medium",
          "correct_action": "revise_optional",
          "rationale": "Long list reads encyclopedic in neutral narration; optional to dramatize as lived detail rather than raw inventory."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-012",
      "chapter": 1,
      "excerpt": ""Put on your dish gloves… 'cause I ain't losin'… Biatchie, told you!"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.NONSTANDARD_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Nonstandard spellings support character voice; no clarity loss."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-013",
      "chapter": 1,
      "excerpt": ""Heh Buddy Boy, this is easy-peasy, tadpole squeezy."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.DICTION.COINAGE_OR_RHYME",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Playful rhyme is intentional cadence; not a craft defect."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-014",
      "chapter": 1,
      "excerpt": ""Hey, DJ, let's find that pot of gold. Ya know the one! Turn it on."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'Ya' is a voice marker; preserve."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-015",
      "chapter": 1,
      "excerpt": ""Let's take it to da distance girl… Wanna make ya all mine…"",
      "register": "stylized_narration",
      "register_lock": "soft",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.STYLIZED_LYRICS_DIALECT",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Lyrics/stylized speech intentionally uses phonetic spellings; should not be corrected."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-016",
      "chapter": 1,
      "excerpt": ""Watching this would see many frogs foaming at the mouth."",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": false, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 9,
          "wave_item": "W9.CLARITY.SUBJECT_MISASSIGNED",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "Construction assigns agency to 'watching' rather than an observer; sentence misreads on first pass."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-017",
      "chapter": 1,
      "excerpt": ""_______"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": false, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.TYPOGRAPHY.SECTION_BREAK_MARKER_MISMATCH",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "TYPOGRAPHY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_recommended",
          "rationale": "Divider marker conflicts with house convention; normalization should map to project-standard section break token."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-018",
      "chapter": 1,
      "excerpt": ""…blowing their paycheques on cocaine: the most expensive… bingo-bango-bongo upper…"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.SLANG_IN_NEUTRAL_NARRATION",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "medium",
          "correct_action": "verify_intent",
          "rationale": "Slang in neutral narration may be intentional tone; flag as fit/consistency review, not correctness."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-019",
      "chapter": 1,
      "excerpt": ""…night vision (they can even see colour)… body odours…"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": false, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 1,
          "wave_item": "W1.HOUSE_STYLE.US_UK_SPELLING_MIX",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "HOUSE_STYLE_MISMATCH",
          "severity": "high",
          "correct_action": "revise_required",
          "rationale": "US-market house style conflict in neutral narration; this is consistency, not slang."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-020",
      "chapter": 1,
      "excerpt": ""That's gross. I told ya I don't wanna do this kinda skulduggery."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.CASUAL_CONTRACTION",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'Ya / wanna / kinda' are protected colloquial tokens in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-021",
      "chapter": 1,
      "excerpt": ""Yeah, yeah, yeah, come on, we'll learn somethin' about frogs…"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_APOSTROPHE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Apostrophe clipping is readable and consistent; no action."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-022",
      "chapter": 1,
      "excerpt": ""Knock, knock." / "Who's there?" / "Boo! Let me in."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 13,
          "wave_item": "W13.DIALOGUE_TAGS.UNNECESSARY",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "revise_optional",
          "rationale": "In rapid exchanges, tags may be reduced; optional craft note, not an error."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-023",
      "chapter": 1,
      "excerpt": ""Yo yo, I have an idea. Let's get out the badminton net…"",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": false, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.REPETITION_AS_SPEECH_PATTERN",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Repetition ('yo yo') is a speech tic; preserve in hard-locked dialogue."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-024",
      "chapter": 1,
      "excerpt": ""Make sure the fire's out before ya come in."",
      "register": "dialogue",
      "register_lock": "hard",
      "style_flags": { "allow_colloquial": true, "allow_dialect_spellings": true, "allow_profanity": true },
      "wave_issues": [
        {
          "wave_number": 2,
          "wave_item": "W2.REGISTER.DIALECT_SPELLING",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "Dialect spelling 'ya' is intentional; do not normalize."
        }
      ]
    },
    {
      "id": "TS-CLEAN-B1-025",
      "chapter": 1,
      "excerpt": ""Given it wasn't Billy's jeep, he didn't feel he had a choice to do anything but follow orders…"",
      "register": "neutral_narration",
      "register_lock": "none",
      "style_flags": { "allow_colloquial": false, "allow_dialect_spellings": false, "allow_profanity": false },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.FILTER_VERBS.FELT_DISTANCE",
          "detected_by_base44": true,
          "is_true_positive": true,
          "label": "CLARITY_REVIEW",
          "severity": "medium",
          "correct_action": "revise_optional",
          "rationale": "'Didn't feel he had a choice' adds narrative distance; optional to tighten depending on POV closeness goals."
        }
      ]
    }
  ]
}