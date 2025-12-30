{
  "batch_id": "TS-GOLD-V1-SLUR",
  "version": "1.0",
  "created": "2025-12-30",
  "frozen": false,
  "description": "Controlled-risk gold standard for slur detection, classification, and action enforcement. Policy-critical: every entry sets precedent.",
  "governance_rules": {
    "no_auto_rewrite": true,
    "slurs_only_in_context": true,
    "all_cases_classified": true,
    "zero_generative_training": true
  },
  "pass_criteria": {
    "detection_rate": 1.0,
    "auto_rewrite_rate": 0.0,
    "classification_accuracy": 0.95,
    "grammar_false_positive_rate": 0.0
  },
  "examples": [
    {
      "id": "slur_001_racial_dialogue_hate",
      "excerpt": "Marcus spat at the ground. \"Get out of here, you stupid n****r. This ain't your neighborhood.\"",
      "register": "dialogue",
      "register_lock": "hard",
      "slur_detected": "n****r",
      "category": "race_ethnicity",
      "target_group": "Black people",
      "narrative_stance": "speaker_endorses",
      "risk_bucket": "VOICE_AUTHENTIC",
      "allowed_action": "PRESERVE_WITH_FLAG",
      "rationale": "Hard-locked dialogue depicting racist character. Voice-essential. Never auto-rewrite.",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_RACIAL",
          "label": "High-Risk Language: Racial Slur",
          "severity": "critical",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "Paradigmatic anti-Black racial slur in hostile dialogue context.",
          "action_taken": "FLAG_FOR_MARKET_RISK"
        }
      ]
    },
    {
      "id": "slur_002_homophobic_narration_condemn",
      "excerpt": "The graffiti read 'f****ts die here'—a stark reminder of the violence this community still faced daily.",
      "register": "narration",
      "register_lock": "none",
      "slur_detected": "f****ts",
      "category": "sexuality_gender",
      "target_group": "Gay men / Queer men",
      "narrative_stance": "narrator_condemns",
      "risk_bucket": "NARRATIVE_CONDEMNATION",
      "allowed_action": "PRESERVE_WITH_FLAG",
      "rationale": "Narrator reporting hate speech in critical context. Condemning stance clear. Preserve for thematic integrity.",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_HOMOPHOBIC",
          "label": "High-Risk Language: Homophobic Slur",
          "severity": "high",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "Homophobic slur in quoted hate speech context. Narrator condemns, but retailer/platform may flag.",
          "action_taken": "FLAG_FOR_EDITORIAL_REVIEW"
        }
      ]
    },
    {
      "id": "slur_003_ableist_dialogue_casual",
      "excerpt": "\"Don't be such a r****d,\" Jake laughed, tossing the controller aside.",
      "register": "dialogue",
      "register_lock": "hard",
      "slur_detected": "r****d",
      "category": "disability",
      "target_group": "People with intellectual disabilities",
      "narrative_stance": "speaker_endorses",
      "risk_bucket": "MARKET_RISK",
      "allowed_action": "FLAG_ONLY",
      "rationale": "Ableist slur in casual dialogue. Character voice, but high market risk (many platforms classify as hate content).",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_ABLEIST",
          "label": "High-Risk Language: Ableist Slur",
          "severity": "high",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "Disability-targeted slur used as casual insult. High platform content policy risk.",
          "action_taken": "FLAG_FOR_MARKET_RISK"
        }
      ]
    },
    {
      "id": "slur_004_reclaimed_ingroup_lgbtq",
      "excerpt": "\"We're here, we're queer, and we're not going anywhere,\" Maya shouted, fist raised. The crowd of queer activists roared approval.",
      "register": "narration",
      "register_lock": "none",
      "slur_detected": "queer",
      "category": "sexuality_gender",
      "target_group": "LGBTQ+ people",
      "narrative_stance": "neutral_report",
      "risk_bucket": "VOICE_AUTHENTIC",
      "allowed_action": "PRESERVE_WITH_FLAG",
      "rationale": "Reclaimed term in in-group activist context. Widely accepted in contemporary LGBTQ+ usage. Low risk, but flag for awareness.",
      "wave_issues": [
        {
          "wave_item": "RECLAIMED_LANGUAGE_DETECTED",
          "label": "Reclaimed Language: Context Review",
          "severity": "low",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "Historically marginalized term now reclaimed by target community. In-group usage detected. Preserve.",
          "action_taken": "FLAG_FOR_AWARENESS"
        }
      ]
    },
    {
      "id": "slur_005_misogynistic_dialogue_hostile",
      "excerpt": "\"Shut up, you stupid b***h,\" he snarled, his hand tightening around her wrist.",
      "register": "dialogue",
      "register_lock": "hard",
      "slur_detected": "b***h",
      "category": "sexuality_gender",
      "target_group": "Women",
      "narrative_stance": "speaker_endorses",
      "risk_bucket": "MARKET_RISK",
      "allowed_action": "PRESERVE_WITH_FLAG",
      "rationale": "Gendered insult in hostile, violent context. Character voice depicting abuse. Preserve but flag for retailer sensitivity.",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_GENDERED",
          "label": "High-Risk Language: Gendered Slur",
          "severity": "medium",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "Misogynistic slur in violence/abuse context. Voice-authentic but market-sensitive.",
          "action_taken": "FLAG_FOR_MARKET_RISK"
        }
      ]
    },
    {
      "id": "slur_006_TEMPLATE_racial",
      "excerpt": "[INSERT EXCERPT WITH RACIAL SLUR]",
      "register": "[dialogue|narration|social_media|quoted_material]",
      "register_lock": "[hard|soft|none]",
      "slur_detected": "[TERM]",
      "category": "race_ethnicity",
      "target_group": "[SPECIFIC GROUP]",
      "narrative_stance": "[speaker_endorses|narrator_condemns|neutral_report]",
      "risk_bucket": "[VOICE_AUTHENTIC|NARRATIVE_CONDEMNATION|MARKET_RISK|PROHIBITED_USE]",
      "allowed_action": "[PRESERVE_WITH_FLAG|FLAG_ONLY|BLOCK_AUTOREWRITE]",
      "rationale": "[WHY THIS CLASSIFICATION?]",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_[CATEGORY]",
          "label": "[LABEL TEXT]",
          "severity": "[low|medium|high|critical]",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "[EXPLANATION]",
          "action_taken": "[ACTION]"
        }
      ]
    },
    {
      "id": "slur_007_TEMPLATE_antisemitic",
      "excerpt": "[INSERT EXCERPT WITH ANTISEMITIC SLUR]",
      "register": "[dialogue|narration|social_media|quoted_material]",
      "register_lock": "[hard|soft|none]",
      "slur_detected": "[TERM]",
      "category": "religion",
      "target_group": "Jewish people",
      "narrative_stance": "[speaker_endorses|narrator_condemns|neutral_report]",
      "risk_bucket": "[VOICE_AUTHENTIC|NARRATIVE_CONDEMNATION|MARKET_RISK|PROHIBITED_USE]",
      "allowed_action": "[PRESERVE_WITH_FLAG|FLAG_ONLY|BLOCK_AUTOREWRITE]",
      "rationale": "[WHY THIS CLASSIFICATION?]",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_ANTISEMITIC",
          "label": "[LABEL TEXT]",
          "severity": "[low|medium|high|critical]",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "[EXPLANATION]",
          "action_taken": "[ACTION]"
        }
      ]
    },
    {
      "id": "slur_008_TEMPLATE_transphobic",
      "excerpt": "[INSERT EXCERPT WITH TRANSPHOBIC SLUR]",
      "register": "[dialogue|narration|social_media|quoted_material]",
      "register_lock": "[hard|soft|none]",
      "slur_detected": "[TERM]",
      "category": "sexuality_gender",
      "target_group": "Trans people",
      "narrative_stance": "[speaker_endorses|narrator_condemns|neutral_report]",
      "risk_bucket": "[VOICE_AUTHENTIC|NARRATIVE_CONDEMNATION|MARKET_RISK|PROHIBITED_USE]",
      "allowed_action": "[PRESERVE_WITH_FLAG|FLAG_ONLY|BLOCK_AUTOREWRITE]",
      "rationale": "[WHY THIS CLASSIFICATION?]",
      "wave_issues": [
        {
          "wave_item": "SLUR_DETECTED_TRANSPHOBIC",
          "label": "[LABEL TEXT]",
          "severity": "[low|medium|high|critical]",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "[EXPLANATION]",
          "action_taken": "[ACTION]"
        }
      ]
    },
    {
      "id": "slur_009_TEMPLATE_disability_reclaimed",
      "excerpt": "[INSERT EXCERPT WITH DISABILITY TERM - RECLAIMED CONTEXT]",
      "register": "[dialogue|narration|social_media|quoted_material]",
      "register_lock": "[hard|soft|none]",
      "slur_detected": "[TERM]",
      "category": "disability",
      "target_group": "[SPECIFIC DISABILITY COMMUNITY]",
      "narrative_stance": "[speaker_endorses|narrator_condemns|neutral_report]",
      "risk_bucket": "[VOICE_AUTHENTIC|NARRATIVE_CONDEMNATION|MARKET_RISK|PROHIBITED_USE]",
      "allowed_action": "[PRESERVE_WITH_FLAG|FLAG_ONLY|BLOCK_AUTOREWRITE]",
      "rationale": "[WHY THIS CLASSIFICATION?]",
      "wave_issues": [
        {
          "wave_item": "RECLAIMED_LANGUAGE_DETECTED",
          "label": "[LABEL TEXT]",
          "severity": "[low|medium|high|critical]",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "[EXPLANATION]",
          "action_taken": "[ACTION]"
        }
      ]
    },
    {
      "id": "slur_010_TEMPLATE_xenophobic_dehumanizing",
      "excerpt": "[INSERT EXCERPT WITH XENOPHOBIC/DEHUMANIZING LANGUAGE]",
      "register": "[dialogue|narration|social_media|quoted_material]",
      "register_lock": "[hard|soft|none]",
      "slur_detected": "[TERM OR PHRASE]",
      "category": "[race_ethnicity|nationality|class_status]",
      "target_group": "[SPECIFIC GROUP]",
      "narrative_stance": "[speaker_endorses|narrator_condemns|neutral_report]",
      "risk_bucket": "[VOICE_AUTHENTIC|NARRATIVE_CONDEMNATION|MARKET_RISK|PROHIBITED_USE]",
      "allowed_action": "[PRESERVE_WITH_FLAG|FLAG_ONLY|BLOCK_AUTOREWRITE]",
      "rationale": "[WHY THIS CLASSIFICATION?]",
      "wave_issues": [
        {
          "wave_item": "DEHUMANIZING_LANGUAGE_DETECTED",
          "label": "[LABEL TEXT]",
          "severity": "[low|medium|high|critical]",
          "true_positive": true,
          "correct_label": true,
          "correct_severity": true,
          "correct_action": true,
          "proposed_revision": null,
          "why_flagged": "[EXPLANATION]",
          "action_taken": "[ACTION]"
        }
      ]
    }
  ]
}