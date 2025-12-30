{
  "version": "1.0",
  "description": "Acceptance tests for Base44 voice/register protection system",
  "last_updated": "2025-12-30",
  "test_suite": "Voice Protection & Severity Classification",
  "tests": [
    {
      "id": "AT-001",
      "name": "Colloquial contraction in dialogue should not be normalized",
      "category": "voice_protection",
      "input": {
        "text": "I don't wanna be here.",
        "register": "dialogue",
        "register_lock": "hard",
        "style_flags": {
          "allow_colloquial": true,
          "allow_nonstandard_grammar": true,
          "allow_profanity": false,
          "allow_dialect_spellings": true
        }
      },
      "expected": {
        "label": "NO_ACTION",
        "severity": "none",
        "recommended_action": "keep",
        "proposed_revision": "",
        "eligible_for_auto_apply": false,
        "notes": "Colloquial form protected under dialogue register."
      },
      "failure_modes": [
        "If Base44 outputs 'want to' → FAIL",
        "If label == 'ERROR' → FAIL",
        "If severity > 'soft' → FAIL"
      ]
    },
    {
      "id": "AT-002",
      "name": "Voice-diluting rewrite should be flagged as regression",
      "category": "voice_protection",
      "input": {
        "original": "In a different headspace and feelin' kinda chilly vanilly",
        "proposed_rewrite": "Billy continued to sit and munch away on trail mix, quieter now.",
        "register": "close_third",
        "register_lock": "hard",
        "style_flags": {
          "allow_colloquial": true
        }
      },
      "expected": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "soft",
        "recommended_action": "keep",
        "proposed_revision": "",
        "regression_detected": true,
        "notes": "Proposed rewrite removes character-specific voice markers and sensory detail. Keep original."
      },
      "failure_modes": [
        "If Base44 accepts the bland rewrite → FAIL",
        "If regression_detected == false → FAIL"
      ]
    },
    {
      "id": "AT-003",
      "name": "True clarity error still flags even in protected register",
      "category": "clarity_enforcement",
      "input": {
        "text": "He said it and then they were and it happened but nobody saw who.",
        "register": "dialogue",
        "register_lock": "hard",
        "style_flags": {
          "allow_colloquial": true
        }
      },
      "expected": {
        "label": "CLARITY_REVIEW",
        "severity": "medium",
        "recommended_action": "revise_recommended",
        "proposed_revision": "He said it. Then it vanished. They showed up right after. Nobody saw who did it.",
        "eligible_for_auto_apply": false,
        "notes": "Ambiguous referents reduce comprehension. Voice protection does not override clarity requirements."
      }
    },
    {
      "id": "AT-004",
      "name": "Market risk handling preserves voice while offering alternatives",
      "category": "market_risk",
      "input": {
        "text": "What I know is I don't wanna be chopped liver or chop suey on some Chinaman's plate",
        "register": "dialogue",
        "register_lock": "hard",
        "style_flags": {
          "allow_colloquial": true,
          "allow_profanity": true
        }
      },
      "expected": {
        "label": "MARKET_RISK_REVIEW",
        "severity": "medium",
        "recommended_action": "verify_intent",
        "proposed_revision": "What I know is I don't wanna be chopped liver or chop suey—somebody's dinner.",
        "alternatives": [
          "What I know is I don't wanna end up chopped liver or chop suey—served up like a joke.",
          "What I know is I don't wanna be a side dish in somebody else's nightmare.",
          "What I know is I don't wanna be dinner. Not here. Not like this."
        ],
        "eligible_for_auto_apply": false,
        "notes": "Ethnic slur detected. Provide voice-preserving alternatives that maintain absurdist dark humor without the slur. Do NOT flatten into generic 'organs harvested.'"
      },
      "failure_modes": [
        "If proposed_revision == 'I do not want my organs harvested' → FAIL (voice destroyed)",
        "If label == 'ERROR' instead of 'MARKET_RISK_REVIEW' → FAIL",
        "If alternatives are bland/formal → FAIL"
      ]
    },
    {
      "id": "AT-005",
      "name": "Soft adverb suggestion without forcing change",
      "category": "optional_polish",
      "input": {
        "text": "Seemingly now on Stage 7 at the 35-acre Canadian Motion Picture Park",
        "register": "stylized_narration",
        "register_lock": "soft",
        "style_flags": {
          "allow_colloquial": true
        }
      },
      "expected": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "soft",
        "recommended_action": "revise_optional",
        "proposed_revision": "Now on Stage 7 at the 35-acre Canadian Motion Picture Park",
        "alternatives": [
          "Apparently now on Stage 7 at the 35-acre Canadian Motion Picture Park",
          "Now on Stage 7—or so he told himself—at the 35-acre Canadian Motion Picture Park",
          "Now on Stage 7 at the 35-acre Canadian Motion Picture Park, as if the set could make it less real."
        ],
        "eligible_for_auto_apply": false,
        "notes": "Adverb adds distance. Optional removal tightens without harming voice."
      }
    },
    {
      "id": "AT-006",
      "name": "Active voice revision preserves momentum",
      "category": "craft_improvement",
      "input": {
        "text": "Propelled by the temporary, sugary energy coursing through his veins, he slaughtered the trail mix.",
        "register": "stylized_narration",
        "register_lock": "soft"
      },
      "expected": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "medium",
        "recommended_action": "revise_optional",
        "proposed_revision": "Sugar-high and temporary, the energy in his veins drove him, and he slaughtered the trail mix.",
        "alternatives": [
          "Sugar-high and borrowed, he slaughtered the trail mix.",
          "With that temporary sweetness in his veins, he slaughtered the trail mix.",
          "Sugared up, past himself, he slaughtered the trail mix."
        ],
        "eligible_for_auto_apply": false,
        "notes": "Passive construction weakens drive. Preserve forward motion—avoid 'X propelled him. He did Y.'"
      },
      "failure_modes": [
        "If output splits into two stiff sentences ('...propelled him. He slaughtered...') → FAIL (momentum loss)",
        "If output removes 'sugary' energy metaphor → FAIL (voice damage)"
      ]
    },
    {
      "id": "AT-007",
      "name": "False-positive filter verb detection prevented",
      "category": "false_positive_prevention",
      "input": {
        "text": "Brutus ignored Billy's needling.",
        "register": "neutral_narration",
        "register_lock": "none"
      },
      "expected": {
        "label": "NO_ACTION",
        "severity": "none",
        "recommended_action": "keep",
        "proposed_revision": "",
        "notes": "'Ignored' is a strong relational verb showing character agency. Not a filter verb problem."
      },
      "failure_modes": [
        "If Base44 suggests 'turned back to the water' → FAIL (false positive)",
        "If label == 'ERROR' or severity > 'soft' → FAIL"
      ]
    },
    {
      "id": "AT-008",
      "name": "Micro-specificity without signal gain rejected",
      "category": "false_positive_prevention",
      "input": {
        "text": "Billy continued to sit and munch away on trail mix.",
        "register": "neutral_narration",
        "register_lock": "soft"
      },
      "expected": {
        "label": "NO_ACTION",
        "severity": "none",
        "recommended_action": "keep",
        "proposed_revision": "",
        "notes": "No clarity or impact gain from 'eating handfuls of the trail mix.' Preserve original unless adding new signal (sound, motive, tell)."
      },
      "failure_modes": [
        "If Base44 suggests 'eating handfuls of the trail mix' → FAIL (no improvement)",
        "If severity == 'medium' or 'strong' → FAIL (overcorrection)"
      ]
    }
  ],
  "regression_tests": [
    {
      "id": "RT-001",
      "name": "Rewrite removes cultural specificity and character voice",
      "input": {
        "original": "What I know is I don't wanna be chopped liver or chop suey on some Chinaman's plate",
        "proposed_revision": "What I know is I don't want my organs harvested"
      },
      "expected_regression_detection": {
        "regression_detected": true,
        "regression_type": "voice_dilution",
        "severity": "strong",
        "notes": "Rewrite removes cultural specificity, humor register, and character-specific absurdism. REJECT."
      }
    },
    {
      "id": "RT-002",
      "name": "Rewrite removes embodied sensory detail",
      "input": {
        "original": "In a different headspace and feelin' kinda chilly vanilly",
        "proposed_revision": "Billy continued to sit and munch away on trail mix, quieter now."
      },
      "expected_regression_detection": {
        "regression_detected": true,
        "regression_type": "voice_and_interiority_loss",
        "severity": "strong",
        "notes": "Rewrite replaces interior state with generic external action. REJECT."
      }
    },
    {
      "id": "RT-003",
      "name": "Specificity micro-change adds stiffness not signal",
      "input": {
        "original": "munch away on trail mix",
        "proposed_revision": "eating handfuls of the trail mix"
      },
      "expected_regression_detection": {
        "regression_detected": true,
        "regression_type": "voice_stiffening",
        "severity": "medium",
        "notes": "Revision adds formality without adding sensory/behavioral detail. No gain. REJECT."
      }
    }
  ]
}