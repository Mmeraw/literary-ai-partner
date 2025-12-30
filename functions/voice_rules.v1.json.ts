{
  "version": "1.0",
  "description": "Operational rules for Base44 voice/register protection and slang handling",
  "last_updated": "2025-12-30",
  "rules": [
    {
      "id": "VR-001",
      "description": "Protect colloquial forms in dialogue or interior monologue.",
      "conditions": {
        "register_lock": "hard",
        "style_flags.allow_colloquial": true
      },
      "action": {
        "label": "NO_ACTION",
        "severity": "none",
        "recommended_action": "keep",
        "note": "Colloquial form preserved by design."
      },
      "examples": ["wanna", "gonna", "gotta", "lemme", "ain't", "ya", "'em", "kinda", "sorta"]
    },
    {
      "id": "VR-002",
      "description": "Flag excessive slang density without forcing correction.",
      "conditions": {
        "register_lock": "soft",
        "slang_density_threshold": ">3 per 250 words per speaker block"
      },
      "action": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "soft",
        "recommended_action": "revise_optional",
        "note": "High density of colloquial forms; review for readability, not correction."
      }
    },
    {
      "id": "VR-003",
      "description": "Detect potential clarity loss in colloquial speech.",
      "conditions": {
        "clarity_score": "low",
        "register_lock": ["soft", "none"]
      },
      "action": {
        "label": "CLARITY_REVIEW",
        "severity": "medium",
        "recommended_action": "revise_optional",
        "note": "Meaning may be unclear; suggest optional clarification without changing voice."
      }
    },
    {
      "id": "VR-004",
      "description": "Prevent normalization of dialect under hard lock.",
      "conditions": {
        "register_lock": "hard",
        "attempted_normalization": true
      },
      "action": {
        "label": "NO_ACTION",
        "severity": "none",
        "recommended_action": "keep",
        "note": "Normalization blocked by voice protection."
      }
    },
    {
      "id": "VR-005",
      "description": "Escalate potentially offensive or legally risky slang.",
      "conditions": {
        "contains_sensitive_term": true
      },
      "action": {
        "label": "MARKET_RISK_REVIEW",
        "severity": "medium",
        "recommended_action": "verify_intent",
        "note": "Review for audience and distribution context; do not auto-sanitize. Provide voice-preserving alternatives."
      }
    },
    {
      "id": "VR-006",
      "description": "Colloquial forms in neutral narration trigger fit review (not error).",
      "conditions": {
        "register": "neutral_narration",
        "register_lock": "none",
        "contains_colloquial": true
      },
      "action": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "medium",
        "recommended_action": "revise_optional",
        "note": "Colloquial form in neutral narration—review for house style fit, not grammar."
      }
    },
    {
      "id": "VR-007",
      "description": "Dialect spelling overuse reduces readability.",
      "conditions": {
        "dialect_apostrophe_density": ">1 per sentence over 5+ sentences"
      },
      "action": {
        "label": "CLARITY_REVIEW",
        "severity": "soft",
        "recommended_action": "revise_optional",
        "note": "Reduce density, keep flavor. Do not standardize everything."
      }
    },
    {
      "id": "VR-008",
      "description": "Register collision detection.",
      "conditions": {
        "contains_both": ["high_formality_legal_phrasing", "heavy_slang"],
        "no_tonal_bridge": true
      },
      "action": {
        "label": "VOICE_REGISTER_REVIEW",
        "severity": "medium",
        "recommended_action": "verify_intent",
        "note": "Mixed registers without transition—may be intentional code-switching."
      }
    },
    {
      "id": "VR-009",
      "description": "Model uncertainty about slang meaning.",
      "conditions": {
        "meaning_confidence": "<0.7",
        "is_slang_or_idiom": true
      },
      "action": {
        "label": "CLARITY_REVIEW",
        "severity": "soft",
        "recommended_action": "verify_intent",
        "note": "Uncertain meaning—ask author, do not hallucinate definition."
      }
    }
  ]
}