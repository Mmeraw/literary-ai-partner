{
  "matrixVersion": "v1",
  "updatedAt": "2026-01-04",
  "criteriaCatalog": [
    { "id": "hook", "label": "Hook / Opening Effectiveness" },
    { "id": "voice", "label": "Voice & Narrative Style" },
    { "id": "character", "label": "Character Presence" },
    { "id": "conflict", "label": "Conflict & Tension" },
    { "id": "theme", "label": "Thematic Resonance" },
    { "id": "pacing", "label": "Pacing & Structural Flow" },
    { "id": "dialogue", "label": "Dialogue & Subtext" },
    { "id": "worldbuilding", "label": "Worldbuilding / Visual Context" },
    { "id": "stakes", "label": "Stakes & Emotional Investment" },
    { "id": "linePolish", "label": "Line-Level Polish / Clarity" },
    { "id": "marketFit", "label": "Marketability / Form Fit" },
    { "id": "keepGoing", "label": "Would Audience Keep Reading / Watching" },
    { "id": "technical", "label": "Technical / Formatting Correctness" }
  ],
  "statusLegend": {
    "R": "Required (scored; can affect readiness)",
    "O": "Optional/Informational (may be scored lightly; never a readiness blocker)",
    "NA": "Not Applicable (must never score, penalize, or generate 'missing' flags)",
    "C": "Constrained (evaluated under special rules; may be scored; guidance must not force invention)"
  },
  "workTypes": {
    "personalEssayReflection": {
      "label": "Personal essay / reflection",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "O",
        "conflict": "NA",
        "theme": "R",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "NA",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "NA"
      }
    },
    "memoirVignette": {
      "label": "Memoir vignette",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "O",
        "theme": "R",
        "pacing": "O",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "NA"
      }
    },
    "memoirChapterNarrative": {
      "label": "Narrative memoir chapter",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "creativeNonfiction": {
      "label": "Creative non-fiction (lyrical / braided / narrative)",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "O",
        "conflict": "O",
        "theme": "R",
        "pacing": "O",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "NA"
      }
    },
    "professionalNonfictionSample": {
      "label": "Professional non-fiction sample",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "O",
        "voice": "O",
        "character": "NA",
        "conflict": "NA",
        "theme": "O",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "NA",
        "stakes": "NA",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "O",
        "technical": "O"
      }
    },
    "opinionEditorial": {
      "label": "Opinion / editorial",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "NA",
        "conflict": "O",
        "theme": "R",
        "pacing": "R",
        "dialogue": "NA",
        "worldbuilding": "NA",
        "stakes": "O",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "academicAnalyticalProse": {
      "label": "Academic / analytical prose",
      "family": "prose_nonfiction",
      "criteria": {
        "hook": "O",
        "voice": "O",
        "character": "NA",
        "conflict": "NA",
        "theme": "R",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "NA",
        "stakes": "NA",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "R"
      }
    },
    "flashFictionMicro": {
      "label": "Flash fiction / micro-fiction",
      "family": "prose_fiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "O",
        "conflict": "O",
        "theme": "O",
        "pacing": "R",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "O",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "shortStory": {
      "label": "Short story",
      "family": "prose_fiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "novelChapter": {
      "label": "Novel chapter",
      "family": "prose_fiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "R",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "literaryFictionGeneral": {
      "label": "Literary fiction (general)",
      "family": "prose_fiction",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "genreFictionGeneral": {
      "label": "Genre fiction (general)",
      "family": "prose_fiction",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "R",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "proseScene": {
      "label": "Prose scene (fiction or memoir)",
      "family": "prose_scene",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "R",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "NA",
        "keepGoing": "O",
        "technical": "NA"
      }
    },
    "scriptSceneFilmTv": {
      "label": "Script scene (film/TV)",
      "family": "script_scene",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "NA",
        "marketFit": "NA",
        "keepGoing": "R",
        "technical": "R"
      }
    },
    "featureScreenplay": {
      "label": "Feature screenplay",
      "family": "screenplay_feature",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "NA",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "R"
      }
    },
    "televisionPilot": {
      "label": "Television pilot",
      "family": "tv_pilot",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "R",
        "stakes": "R",
        "linePolish": "NA",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "R"
      }
    },
    "televisionEpisode": {
      "label": "Television episode (non-pilot)",
      "family": "tv_episode",
      "criteria": {
        "hook": "O",
        "voice": "R",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "NA",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "R"
      }
    },
    "stagePlayScript": {
      "label": "Stage play / theatrical script",
      "family": "stage_play",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "R",
        "pacing": "R",
        "dialogue": "R",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "NA",
        "marketFit": "O",
        "keepGoing": "R",
        "technical": "R"
      }
    },
    "queryPackage": {
      "label": "Query package",
      "family": "submission_materials",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "NA",
        "dialogue": "NA",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "O"
      }
    },
    "synopsis": {
      "label": "Synopsis",
      "family": "submission_materials",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "O"
      }
    },
    "pitchOrLogline": {
      "label": "Pitch / logline",
      "family": "submission_materials",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "O",
        "conflict": "R",
        "theme": "O",
        "pacing": "NA",
        "dialogue": "NA",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "NA"
      }
    },
    "treatmentOrSeriesBible": {
      "label": "Treatment / series bible",
      "family": "submission_materials",
      "criteria": {
        "hook": "R",
        "voice": "O",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "R",
        "stakes": "R",
        "linePolish": "R",
        "marketFit": "R",
        "keepGoing": "R",
        "technical": "O"
      }
    },
    "outlineOrProposal": {
      "label": "Outline / proposal",
      "family": "submission_materials",
      "criteria": {
        "hook": "O",
        "voice": "NA",
        "character": "R",
        "conflict": "R",
        "theme": "O",
        "pacing": "O",
        "dialogue": "NA",
        "worldbuilding": "O",
        "stakes": "R",
        "linePolish": "O",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "O"
      }
    },
    "hybridExperimental": {
      "label": "Hybrid or experimental work",
      "family": "hybrid_other",
      "criteria": {
        "hook": "R",
        "voice": "R",
        "character": "O",
        "conflict": "O",
        "theme": "O",
        "pacing": "O",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "O",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "O"
      }
    },
    "otherUserDefined": {
      "label": "Other (user-defined)",
      "family": "hybrid_other",
      "criteria": {
        "hook": "O",
        "voice": "O",
        "character": "O",
        "conflict": "O",
        "theme": "O",
        "pacing": "O",
        "dialogue": "O",
        "worldbuilding": "O",
        "stakes": "O",
        "linePolish": "R",
        "marketFit": "O",
        "keepGoing": "O",
        "technical": "O"
      }
    }
  }
}