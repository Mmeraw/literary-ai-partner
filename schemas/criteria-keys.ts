/**
 * CRITERIA_KEYS — Canonical Criterion Registry
 *
 * REVISIONGRADE / Base44 Story Evaluation System
 *
 * This file defines the SINGLE SOURCE OF TRUTH for all story evaluation
 * criteria used by the system.
 *
 * ─────────────────────────────────────────────────────────────────────
 * 🔒 GOVERNANCE & MDM CONTRACT (CRITICAL)
 *
 * 1. This registry defines the ONLY legal criterion keys that may appear in:
 *    - criteria_plan (R / O / NA / C)
 *    - MDM Work Type matrices
 *    - evaluation results
 *    - audit fixtures
 *    - validator enforcement
 *
 * 2. Master Data Management (MDM) DOES NOT define criteria.
 *    MDM CONSUMES this registry.
 *
 *    • MDM responsibility:
 *      Work Type × Matrix Version → applicability status (R / O / NA / C)
 *
 *  • Registry responsibility:
 *      Criterion identity, stability, and semantic meaning
 *
 * 3. Any MDM matrix referencing a key NOT present in CRITERIA_KEYS
 *    MUST fail validation (hard error).
 *
 * 4. Keys in this file are MACHINE-STABLE and MUST NEVER CHANGE
 *    once released. Labels and descriptions may evolve.
 *
 * 5. This file is versioned independently of MDM matrices.
 *
 * Canon Version: v1.1.0
 * MDM Compatibility: Canon v1
 * Last Updated: 2026-02-08
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Ordered, canonical criterion keys.
 *
 * Order is intentional and must remain stable to support:
 * - audit reproducibility
 * - matrix diffs
 * - historical evaluation comparison
 */
export const CRITERIA_KEYS = [
  "concept",              // 1. Concept & Core Premise
  "narrativeDrive",       // 2. Narrative Drive & Momentum
  "character",            // 3. Character Depth & Psychological Coherence
  "voice",                // 4. Point of View & Voice Control
  "sceneConstruction",    // 5. Scene Construction & Function
  "dialogue",             // 6. Dialogue Authenticity & Subtext
  "theme",                // 7. Thematic Integration
  "worldbuilding",        // 8. World-Building & Environmental Logic
  "pacing",               // 9. Pacing & Structural Balance
  "proseControl",         // 10. Prose Control & Line-Level Craft
  "tone",                 // 11. Tonal Authority & Consistency
  "narrativeClosure",     // 12. Narrative Closure & Promises Kept
  "marketability"         // 13. Professional Readiness & Market Positioning
] as const;

/**
 * Strongly typed union of all canonical criterion keys.
 *
 * Used by:
 * - criteria_plan typing
 * - MDM validation
 * - hardened D2 enforcement
 */
export type CriterionKey = (typeof CRITERIA_KEYS)[number];

/**
 * Human-readable metadata for each criterion.
 *
 * IMPORTANT:
 * - This metadata is DESCRIPTIVE ONLY.
 * - Governance, scoring, and applicability MUST rely on keys + MDM matrices.
 * - Changes here do NOT alter evaluation behavior.
 */
export const CRITERIA_METADATA: Record<
  CriterionKey,
  {
    label: string;
    description: string;
  }
> = {
  concept: {
    label: "Concept & Core Premise",
    description:
      "Assesses originality, clarity, and inherent narrative tension of the central idea."
  },

  narrativeDrive: {
    label: "Narrative Drive & Momentum",
    description:
      "Evaluates escalation, consequence, and sustained forward movement."
  },

  character: {
    label: "Character Depth & Psychological Coherence",
    description:
      "Measures internal consistency, motivation, and capacity for change or resistance."
  },

  voice: {
    label: "Point of View & Voice Control",
    description:
      "Assesses stability, intentionality, and appropriateness of narrative perspective."
  },

  sceneConstruction: {
    label: "Scene Construction & Function",
    description:
      "Determines whether scenes reveal, escalate, complicate, or resolve narrative elements."
  },

  dialogue: {
    label: "Dialogue Authenticity & Subtext",
    description:
      "Evaluates dialogue effectiveness in revealing character and power dynamics."
  },

  theme: {
    label: "Thematic Integration",
    description:
      "Measures how themes are embedded through action and consequence rather than stated."
  },

  worldbuilding: {
    label: "World-Building & Environmental Logic",
    description:
      "Assesses internal consistency and credibility of physical and social systems."
  },

  pacing: {
    label: "Pacing & Structural Balance",
    description:
      "Evaluates rhythm of tension and release across the narrative as a whole."
  },

  proseControl: {
    label: "Prose Control & Line-Level Craft",
    description:
      "Measures precision, intentionality, and clarity at the sentence level."
  },

  tone: {
    label: "Tonal Authority & Consistency",
    description:
      "Assesses tonal integrity and resistance to unintended register shifts."
  },

  narrativeClosure: {
    label: "Narrative Closure & Promises Kept",
    description:
      "Evaluates fulfillment, intentional subversion, or justified openness of narrative promises."
  },

  marketability: {
    label: "Professional Readiness & Market Positioning",
    description:
      "Assesses cohesion, clarity, and alignment with professional publication standards."
  }
};