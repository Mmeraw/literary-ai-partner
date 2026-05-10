// [PROTECTED]

import type { BoundaryCrossingCategory, RegistryEntry } from "../types";

const FIRST_REAL_CATEGORY_TOKEN = "narrativeDrive" as BoundaryCrossingCategory;

export const firstRealCategoryEntries: ReadonlyArray<RegistryEntry> = Object.freeze([
  {
    category: FIRST_REAL_CATEGORY_TOKEN,
    classificationDepth: "literal",
    auditOrigin: {
      registryPrNumber: 429,
      mergedAt: "2026-05-10T00:00:00Z",
    },
  },
]);