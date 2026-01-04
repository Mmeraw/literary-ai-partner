{
  "test_id": "synopsis_regression_culture",
  "test_name": "WAVE-SYN Regression Test: 'Culture' Story",
  "purpose": "Prevent Utku elevation, title drift, antagonist invention",
  "manuscript": {
    "title": "Culture",
    "alternate_titles": ["The Other Side", "Letting Others In"],
    "format": "memoir / personal essay / observational",
    "pov": "first-person",
    "word_count": 3500,
    "protagonist": "POV narrator (Mike)",
    "antagonist_type": "situational / internal / none",
    "antagonist_description": "Ethical boundary threat, safety risk from homeless encounter, internal conflict about judgment vs compassion"
  },
  "expected_outputs": {
    "title": "Culture",
    "protagonist": {
      "type": "POV narrator",
      "name": "Mike" ,
      "page_time": "major (100%)"
    },
    "antagonist": {
      "type": "situational / internal / environmental",
      "acceptable_descriptions": [
        "Situational risk from encounter with unstable stranger",
        "Internal conflict about judgment vs openness",
        "Environmental threat (homelessness, theft risk, disease exposure)",
        "Ethical boundary violation"
      ],
      "must_not_be": "Tim (Craigslist boy) elevated to villain role"
    },
    "utku_classification": {
      "role": "thematic lens / meta-commentary only",
      "page_time": "none or minimal (<5%)",
      "narrative_agency": "none",
      "acceptable_mention": "Later thematic realization attributed to Utku in end-notes",
      "must_not_be": [
        "protagonist",
        "antagonist",
        "central character",
        "main figure",
        "key participant"
      ]
    },
    "characters_on_page": {
      "major": ["POV narrator (Mike)"],
      "significant": ["Tim (Craigslist homeless boy)", "Alex (Latino neighbor)"],
      "minor": ["Ralph (mentioned partner)", "Emily (mentioned hooker)"],
      "meta_only": ["Utku (thematic lens)", "Lynda Macgibbon (title discussion)"]
    }
  },
  "fail_conditions": [
    {
      "condition": "Utku labeled protagonist, antagonist, or central character",
      "severity": "critical",
      "rule_violated": "WAVE-SYN-04: Meta-Layer Containment"
    },
    {
      "condition": "Title changed from 'Culture' to 'The Other Side' or 'Letting Others In' without instruction",
      "severity": "critical",
      "rule_violated": "WAVE-SYN-TITLE: Title Canon Enforcement"
    },
    {
      "condition": "Human antagonist invented (Tim as villain, Utku as conflict source)",
      "severity": "critical",
      "rule_violated": "WAVE-SYN-03: Antagonist Optionality"
    },
    {
      "condition": "Protagonist identified as anyone other than POV narrator",
      "severity": "critical",
      "rule_violated": "WAVE-SYN-01: POV Supremacy"
    },
    {
      "condition": "Minor character (<25% page time) elevated to protagonist/antagonist",
      "severity": "high",
      "rule_violated": "WAVE-SYN-02: Character Elevation Threshold"
    },
    {
      "condition": "Synopsis focus drifts to Utku's 'realization' rather than narrator's experience",
      "severity": "high",
      "rule_violated": "WAVE-SYN-05: Reflection Cannot Override Events"
    }
  ],
  "test_assertions": {
    "title_matches": "Culture",
    "wave_syn_01_pov_supremacy": true,
    "wave_syn_02_character_threshold": true,
    "wave_syn_03_antagonist_optional": true,
    "wave_syn_04_meta_containment": true,
    "wave_syn_05_events_primacy": true,
    "protagonist_name": "POV narrator",
    "antagonist_type_not": "person",
    "utku_role_not_in": ["protagonist", "antagonist", "central character", "main figure"]
  },
  "notes": [
    "This test locks in the correct interpretation pattern for memoir/essay work",
    "Prevents 'abstract reflection overrides concrete action' failures",
    "Guards against title drift and meta-commentary elevation",
    "Establishes page-time threshold as hard requirement"
  ]
}