import { type StoryLayerCoreLayerKey } from "@/lib/evaluation/artifacts/artifactTypes";

export type StoryLayerDisplayMetadata = {
  title: string;
  shortLabel: string;
  description: string;
  iconToken: string;
};

export const STORY_LAYER_METADATA = {
  source_integrity_layer: {
    title: "Source Integrity",
    shortLabel: "Manuscript health",
    description:
      "System extraction health and author guidance. Review the extraction status below, then tell RevisionGrade anything intentional that should not be treated as an error.",
    iconToken: "🔒",
  },
  pov_structure_layer: {
    title: "POV Structure",
    shortLabel: "Narrative perspective",
    description:
      "Whose eyes does the reader see through, and when? Maps the narrative cameras, voice ownership, and any perspective shifts across your story.",
    iconToken: "👁",
  },
  narrator_attribution_layer: {
    title: "Narrator Attribution",
    shortLabel: "Narrator signals",
    description:
      "How narration is attributed and whether unnamed or ambiguous narrator references need author confirmation before downstream use.",
    iconToken: "🧭",
  },
  canonical_identity_layer: {
    title: "Canonical Identity",
    shortLabel: "Names & aliases",
    description:
      "How the system tracks a character across every name, alias, nickname, and role they carry. Especially important when a character is known by several names or hides their identity.",
    iconToken: "🪪",
  },
  cast_role_tier_layer: {
    title: "Cast / Role Tier",
    shortLabel: "Character roles",
    description:
      "Every character ranked by the structural job they do — from protagonist through antagonist to walk-on. Reveals who the story centers on and who applies pressure.",
    iconToken: "🎭",
  },
  identity_pronoun_layer: {
    title: "Pronoun Transitions",
    shortLabel: "Transitions & ambiguity",
    description:
      "Pronoun transitions and identity signals that may need confirmation. Stable pronoun-family usage (including case forms like he/him, she/her, they/them) is normalized and hidden from review.",
    iconToken: "🏷️",
  },
  relationship_network_layer: {
    title: "Relationship Network",
    shortLabel: "Named bonds",
    description:
      "The named bonds between characters: how they began, what stressed them, how they changed. Only sustained relationships between named characters appear here.",
    iconToken: "🔗",
  },
  object_symbol_layer: {
    title: "Object / Symbol",
    shortLabel: "Significant objects",
    description:
      "Tracks significant objects from their first appearance through ownership changes to their final meaning. Weapons, documents, tokens — anything the story puts weight on.",
    iconToken: "🗡",
  },
  location_timeline_worldstate_layer: {
    title: "Timeline / Location",
    shortLabel: "Places & timeline",
    description:
      "Where the story takes place, in what order, and what rules govern the world at each point. Movement paths, time sequences, and environmental logic.",
    iconToken: "🗺",
  },
  threat_antagonist_ending_layer: {
    title: "Threat / Pressure / Ending",
    shortLabel: "Pressure & endings",
    description:
      "The forces working against your protagonist — people, institutions, environments, internal conflicts, and social pressures — mapped to their final state at story's end.",
    iconToken: "⚔️",
  },
} satisfies Record<StoryLayerCoreLayerKey, StoryLayerDisplayMetadata>;
