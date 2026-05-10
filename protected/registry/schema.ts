// [PROTECTED]
//
// Schema validation for the protected registry.

import type {
  RegistryEntry,
  RegistryValidationResult,
  RegistryValidationError,
} from "./types";

export function validateEntry(
  entry: unknown,
  entryIndex: number,
): ReadonlyArray<RegistryValidationError> {
  const errors: RegistryValidationError[] = [];

  if (typeof entry !== "object" || entry === null) {
    errors.push({
      errorKind: "schema",
      entryIndex,
      message: "Entry must be an object.",
    });
    return errors;
  }

  const candidate = entry as Partial<RegistryEntry>;

  if (typeof candidate.category !== "string" || candidate.category.length === 0) {
    errors.push({
      errorKind: "schema",
      entryIndex,
      message: "Entry must have a non-empty category.",
    });
  }

  if (
    candidate.classificationDepth !== "literal" &&
    candidate.classificationDepth !== "pattern-class" &&
    candidate.classificationDepth !== "structural"
  ) {
    errors.push({
      errorKind: "classification",
      entryIndex,
      message: "Entry classificationDepth must be one of the locked enum values.",
    });
  }

  if (
    typeof candidate.auditOrigin !== "object" ||
    candidate.auditOrigin === null ||
    typeof candidate.auditOrigin.registryPrNumber !== "number" ||
    typeof candidate.auditOrigin.mergedAt !== "string"
  ) {
    errors.push({
      errorKind: "schema",
      entryIndex,
      message: "Entry must have a valid auditOrigin with registryPrNumber and mergedAt.",
    });
  }

  return errors;
}

export function validateRegistryContents(entries: ReadonlyArray<unknown>): RegistryValidationResult {
  const allErrors: RegistryValidationError[] = [];
  const categoriesSeen = new Set<string>();
  let categoryCount = 0;

  entries.forEach((entry, index) => {
    const entryErrors = validateEntry(entry, index);
    allErrors.push(...entryErrors);

    if (entryErrors.length === 0) {
      const validEntry = entry as RegistryEntry;
      if (!categoriesSeen.has(validEntry.category)) {
        categoriesSeen.add(validEntry.category);
        categoryCount++;
      }
    }
  });

  return {
    schemaValid: allErrors.length === 0,
    categoryCount,
    entryCount: entries.length,
    errors: allErrors,
  };
}
