{
  "batch_id": "TOADSTONE-FP-B6",
  "project": "TOADSTONE",
  "version": "voice_register_v1_training",
  "meta": {
    "source": "USER_FEEDBACK_REJECTIONS",
    "total_examples": 4,
    "date_created": "2025-12-30",
    "training_purpose": "Prevent voice flattening in transgressive/lyrical mode; all 4 suggestions were rejected by author",
    "note": "Transgression Mode should NOT normalize these—they are intentional stylistic choices"
  },
  "examples": [
    {
      "id": "TOADSTONE-FP-001",
      "chapter": null,
      "excerpt": "his head still bobbing like a pigeon walkin' along struttin' its stuff",
      "register": "neutral_narration",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": true,
        "allow_metaphorical_language": true
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.WORDING.BODY_PART_CLICHE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "This is NOT a cliché—it's a lyrical, rhythmic phrase with stacked motion verbs ('walkin' along struttin'') that matches the colloquial, comic register. Shortening to 'strutting around' removes the musicality and cadence. This is intentional voice.",
          "incorrect_suggestion": "his head still bobbing like a pigeon strutting around",
          "why_incorrect": "Loses stacked rhythm, removes dialect spelling ('walkin''), and flattens the comic swagger of 'its stuff'."
        }
      ],
      "author_feedback": "Too truncated, I need the lyrical rhythm, since that is my unique voice"
    },
    {
      "id": "TOADSTONE-FP-002",
      "chapter": null,
      "excerpt": "scroggin carcass",
      "register": "neutral_narration",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_metaphorical_language": true,
        "allow_neologisms": true
      },
      "wave_issues": [
        {
          "wave_number": 3,
          "wave_item": "W3.DICTION.UNCLEAR_COINAGE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'scroggin carcass' is an idiosyncratic, intentional coinage that gives the narrative its fingerprint. Do not normalize to 'trail mix body' or similar generic alternatives unless there is genuine clarity failure.",
          "incorrect_suggestion": "[presumed normalization, e.g., 'trail mix body' or 'snack-stuffed body']",
          "why_incorrect": "Erases distinctive, grotesque imagery that defines the author's voice."
        }
      ],
      "author_feedback": "scroggin carcass is AMAZING fun wording, why would we change it!!!"
    },
    {
      "id": "TOADSTONE-FP-003",
      "chapter": null,
      "excerpt": "His jaws of life made good on their fine-print promise",
      "register": "neutral_narration",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": false,
        "allow_dialect_spellings": false,
        "allow_metaphorical_language": true
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.WORDING.BODY_PART_CLICHE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "VOICE_REGISTER_REVIEW",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'jaws of life' is a black-comic, culturally loaded metaphor (rescue tool → predatory jaw) that characterizes tone. 'His mouth made good on its promise' is flat exposition that strips the metaphor and loses the 'fine-print promise' nuance.",
          "incorrect_suggestion": "His mouth made good on its promise",
          "why_incorrect": "Erases strong, darkly comic imagery; removes cultural resonance; flattens tone to generic narration."
        }
      ],
      "author_feedback": "'jaws of life' metaphor, gorgeous!!! why cut it???"
    },
    {
      "id": "TOADSTONE-FP-004",
      "chapter": null,
      "excerpt": "his heart was still doing pitter-patter at the thought of Bambi and company",
      "register": "close_third",
      "register_lock": "soft",
      "style_flags": {
        "allow_colloquial": true,
        "allow_dialect_spellings": false,
        "allow_metaphorical_language": true,
        "allow_whimsical_tone": true
      },
      "wave_issues": [
        {
          "wave_number": 4,
          "wave_item": "W4.WORDING.BODY_PART_CLICHE",
          "detected_by_base44": true,
          "is_true_positive": false,
          "label": "NO_ACTION",
          "severity": "low",
          "correct_action": "keep",
          "rationale": "'pitter-patter' is childlike and whimsical on purpose, tuned perfectly to 'Bambi and company.' 'Racing' is generic and reports state without the tonal joke or internal echo. This is voice integrity, not cliché.",
          "incorrect_suggestion": "his heart was still racing at the thought of Bambi and his friends",
          "why_incorrect": "Kills the childlike whimsy; loses tonal comedy; 'and his friends' is more generic than 'and company.'"
        }
      ],
      "author_feedback": "[rejected with thumbs down, Issue Identified note: 'The original expression adds a whimsical touch to describe emotional response, fitting the narrative tone.']"
    }
  ],
  "policy_notes": {
    "transgression_mode_must_respect_voice": "In Transgression Mode, these suggestions should NEVER be auto-applied or presented as 'fixes.' They can be surfaced as optional 'plain English alternatives' with explicit warnings that they flatten tone.",
    "body_part_cliche_vs_intentional_metaphor": "W4.WORDING.BODY_PART_CLICHE must distinguish between tired expressions ('my heart sank') and intentional, loaded metaphors ('jaws of life,' 'pitter-patter'). If the phrase has semantic density or tonal function, mark as NO_ACTION or VOICE_REGISTER_REVIEW (low severity)."
  }
}