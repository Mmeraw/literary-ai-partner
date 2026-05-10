// [PROTECTED]
//
// Protected registry consumer-facing entry point.

import type {
  RegistryEntry,
  ReadOnlyRegistryConsumer,
  RegistryQueryResult,
  RegistryValidationResult,
  EscapeAnnotationPattern,
} from "./types";
import { validateRegistryContents } from "./schema";

export type {
  BoundaryCrossingCategory,
  RegistryEntry,
  RegistryAuditOrigin,
  EscapeAnnotationPattern,
  RegistryQueryResult,
  RegistryValidationResult,
  RegistryValidationError,
  ReadOnlyRegistryConsumer,
} from "./types";

/**
 * At scaffold time, category files contain no entries.
 */
function loadEntries(): ReadonlyArray<RegistryEntry> {
  return Object.freeze([]);
}

function buildConsumer(): ReadOnlyRegistryConsumer {
  const entries = loadEntries();
  const validated = validateRegistryContents(entries);
  const validation: RegistryValidationResult = Object.freeze({
    schemaValid: validated.schemaValid,
    categoryCount: validated.categoryCount,
    entryCount: validated.entryCount,
    errors: Object.freeze([...validated.errors]),
  });

  if (!validation.schemaValid) {
    throw new Error(
      `[protected/registry] Registry failed self-validation at load time. ` +
        `Errors: ${validation.errors.length}. Refusing to expose consumer contract.`,
    );
  }

  const escapeAnnotation: EscapeAnnotationPattern = Object.freeze({
    markerToken: "@InternalOnly",
    requiredValidatorCheck: "path-classification",
    auditLogShape: "ci-summary",
  });

  return Object.freeze({
    hasCategoryMatch(_candidate: string): RegistryQueryResult {
      return Object.freeze({
        matched: false,
        category: null,
        classificationDepth: null,
      });
    },
    getEscapeAnnotationContract(): EscapeAnnotationPattern {
      return escapeAnnotation;
    },
    validateRegistry(): RegistryValidationResult {
      return validation;
    },
    getCategoryCount(): number {
      return validation.categoryCount;
    },
  });
}

const consumer: ReadOnlyRegistryConsumer = buildConsumer();

export function getRegistryConsumer(): ReadOnlyRegistryConsumer {
  return consumer;
}
