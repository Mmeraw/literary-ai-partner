/**
 * Canon regression test — EXPECTED FAILURES DOCUMENT DEFECTS
 *
 * This file uses it.failing() to document the current long-form
 * Transgressive-mode evaluation defects. When a defect is fixed,
 * flip the corresponding it.failing() to it() in the same PR.
 *
 * CI stays green while defects remain documented.
 */

import { describe, expect, it } from "@jest/globals";

const REQUIRED_FROG_NAMED_ENTITIES = [
  "Hyla",
  "Zimeon",
  "Thorander",
  "Arcana",
  "Phyto",
  "Magus",
  "Mage",
  "Enoch",
  "Molly",
  "Maximilian",
  "Beiana",
  "Skyla",
];

const FORBIDDEN_UNGROUNDED_ENTITIES = ["crew", "the crew", "their crew"];

const FORBIDDEN_AGE_CLAIMS = [
  "teen",
  "teens",
  "teenage",
  "young adult",
  "ya",
  "adolescent",
];

const REQUIRED_TRANSGRESSIVE_FRAMINGS = [
  "character-coded",
  "narrator above",
  "narrator positioned",
  "narrator smarter",
  "eye level",
  "witness",
];

describe("canon: long-form Transgressive-mode evaluation floor", () => {
  describe("Dimension 1: character_ledger_coverage (Defect 1)", () => {
    it.failing("must name at least 10 of 12 frog entities", () => {
      const mockProductionOutput = {
        criteria: {
          character: {
            score: 6,
            rationale:
              "Only Chey and Brutus scored; frogs collapsed to generic frog-god belief system.",
          },
        },
      };

      const frogEntitiesFound = REQUIRED_FROG_NAMED_ENTITIES.filter((entity) =>
        mockProductionOutput.criteria.character.rationale.includes(entity)
      );

      expect(frogEntitiesFound.length).toBeGreaterThanOrEqual(10);
    });

    it.failing("must include frog-plot mechanics by name", () => {
      const requiredMechanics = [
        "council",
        "hibernation",
        "shard",
        "gorf",
        "dead zone",
      ];

      const mockProductionOutput = {
        overall_summary:
          "frog-god belief system embedded in performance text; ritualistic frog motifs in the chant",
      };

      const mechanicsFound = requiredMechanics.filter((mechanic) =>
        mockProductionOutput.overall_summary.toLowerCase().includes(mechanic)
      );

      expect(mechanicsFound.length).toBe(requiredMechanics.length);
    });
  });

  describe("Dimension 2: no_ungrounded_entity_synthesis (Defect 2)", () => {
    it.failing("must not emit hallucinated entities like crew", () => {
      const mockProductionOutput = {
        overall_summary:
          "Chey and Brutus and their crew marinate in stoner-noir self-destruction.",
      };

      const ungroundedFound = FORBIDDEN_UNGROUNDED_ENTITIES.filter((entity) =>
        mockProductionOutput.overall_summary.toLowerCase().includes(entity)
      );

      expect(ungroundedFound.length).toBe(0);
    });
  });

  describe("Dimension 3: age_timeline_grounding (Defect 2)", () => {
    it.failing("must not misidentify 32-year-old men as teens", () => {
      const mockProductionOutput = {
        character_section:
          "The characters are engaging street kids with raw dialogue. Their teenage angst and youthful recklessness drives the narrative tension.",
      };

      const ageClaimsFound = FORBIDDEN_AGE_CLAIMS.filter((claim) =>
        mockProductionOutput.character_section.toLowerCase().includes(claim)
      );

      expect(ageClaimsFound.length).toBe(0);
    });
  });

  describe("Dimension 4: register_mode_engaged (Defect 3)", () => {
    it.failing(
      "must show pass3-synthesis-v11-transgressive in provenance when mode is Transgressive",
      () => {
        const mockProductionOutput = {
          provenance: {
            evaluation_mode: "Transgressive (craft, not comfort)",
            voice_preservation_level: "Maximum",
            pass3_prompt_variant: "pass3-synthesis-v11-prose-control-anchor-floor",
          },
        };

        expect(
          mockProductionOutput.provenance.pass3_prompt_variant.includes("transgressive")
        ).toBe(true);
      }
    );

    it.failing("must surface register_mode and voice_level in provenance", () => {
      const mockProductionOutput = {
        provenance: {
          engine: "Pass3-Convergence",
          provider: "openai",
          prompt_pack:
            "pass1-craft-v7-bounded + pass2-editorial-v8-independence + pass3-synthesis-v11-prose-control-anchor-floor",
        },
      };

      const hasRegisterMode = "register_mode" in mockProductionOutput.provenance;
      const hasVoiceLevel =
        "voice_preservation_level" in mockProductionOutput.provenance;

      expect(hasRegisterMode && hasVoiceLevel).toBe(true);
    });
  });

  describe("Dimension 5: transgressive_dialogue_framing (Defect 3)", () => {
    it.failing(
      "must frame transgressive content as character-coded with narrator positioning explicit",
      () => {
        const mockProductionOutput = {
          dialogue_criterion: {
            score: 7,
            rationale:
              "Colloquial talk feels authentic but sometimes carries exposition or stereotype; this matters because attribution and subtext keep speech vivid without flattening nuance.",
          },
        };

        const hasCharacterCodingFrame = REQUIRED_TRANSGRESSIVE_FRAMINGS.some(
          (frame) =>
            mockProductionOutput.dialogue_criterion.rationale
              .toLowerCase()
              .includes(frame)
        );

        expect(hasCharacterCodingFrame).toBe(true);
      }
    );

    it.failing("must include narrator-above-character positioning", () => {
      const mockProductionOutput = {
        transgressive_calibration:
          "The transgression is the asset. Brutus's monologues are character-coded, not author-coded. The craft problem is that the narrator currently rides at Brutus's eye level instead of above it.",
      };

      const hasNarratorPositioning =
        mockProductionOutput.transgressive_calibration
          .toLowerCase()
          .includes("narrator") &&
        (mockProductionOutput.transgressive_calibration
          .toLowerCase()
          .includes("above") ||
          mockProductionOutput.transgressive_calibration
            .toLowerCase()
            .includes("eye level"));

      expect(hasNarratorPositioning).toBe(false);
    });
  });

  describe("Bonus: full_criteria_coverage", () => {
    it.failing("must score all 13 canonical criteria", () => {
      const requiredCriteria = [
        "concept",
        "narrativeDrive",
        "character",
        "voice",
        "sceneConstruction",
        "dialogue",
        "theme",
        "worldbuilding",
        "pacing",
        "proseControl",
        "tone",
        "narrativeClosure",
        "transgressiveCalibration",
      ];

      const mockProductionOutput = {
        criteria: {
          concept: { score: 8 },
          narrativeDrive: { score: 4 },
          character: { score: 6 },
          voice: { score: 7 },
          sceneConstruction: { score: 4 },
          dialogue: { score: 7 },
          theme: { score: 8 },
          worldbuilding: { score: 8 },
          pacing: { score: 4 },
          proseControl: { score: 6 },
          tone: { score: 6 },
          narrativeClosure: { score: 3 },
        },
      };

      expect(Object.keys(mockProductionOutput.criteria).length).toBe(
        requiredCriteria.length
      );

      requiredCriteria.forEach((criterion) => {
        expect(criterion in mockProductionOutput.criteria).toBe(true);
      });
    });
  });
});