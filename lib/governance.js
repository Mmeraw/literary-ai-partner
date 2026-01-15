// lib/governance.js

export const GOVERNANCE_VERSION = "1.0.0";

export const FUNCTION_IDS = {
  EVALUATE: "evaluate",
  WAVE: "wave",
  SCREENPLAY: "screenplay",
  REVISION: "revision",
  OUTPUT_GENERATION: "output_generation",
  BIOGRAPHY: "biography",
  STORYGATE: "storygate_studio",
  MANUSCRIPT_MANAGEMENT: "manuscript_management",
  FILE_PROCESSING: "file_processing",
  VALIDATION_TESTING: "validation_testing",
  ANALYTICS_FEEDBACK: "analytics_feedback",
  PAYMENTS_STRIPE: "payments_stripe",
  UTILITIES_HELPERS: "utilities_helpers",
};

/**
 * Basic canon hash placeholder.
 * Replace with a real hash of your MDM/WAVE spec when ready.
 */
export function computeCanonHash(payload) {
  const raw = JSON.stringify(payload ?? {});
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `canon_${Math.abs(hash)}`;
}

/**
 * Wraps any function input into the 5‑layer governance envelope:
 * inputs → routing → validation → outputs → audit.
 */
export function createGovernedRequest({
  functionId,
  workType,
  inputs,
  routing = {},
  validation = {},
  meta = {},
}) {
  const timestamp = new Date().toISOString();

  return {
    governanceVersion: GOVERNANCE_VERSION,
    functionId,
    workType,
    canonHash: computeCanonHash({ functionId, workType }),
    envelope: {
      inputs,
      routing,
      validation,
      outputs: {},
      audit: {
        createdAt: timestamp,
        meta,
      },
    },
  };
}

