// [PROTECTED]

import type { BoundaryCrossingCategory, RegistryEntry } from "../types";

const SYNTHETIC_PROOF_TOKEN = "ZXQ_SYNTHETIC_PROOF_TOKEN" as BoundaryCrossingCategory;

export const syntheticProofEntries: ReadonlyArray<RegistryEntry> = Object.freeze([
  {
    category: SYNTHETIC_PROOF_TOKEN,
    classificationDepth: "literal",
    auditOrigin: {
      registryPrNumber: 427,
      mergedAt: "2026-05-10T00:00:00Z",
    },
  },
]);