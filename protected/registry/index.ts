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
import { syntheticProofEntries } from "./categories/synthetic-proof";

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
 * Category files are aggregated here.
 */
function loadEntries(): ReadonlyArray<RegistryEntry> {
  return Object.freeze([...syntheticProofEntries]);
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

  const entriesByCategory = new Map<string, RegistryEntry>();
  for (const entry of entries) {
    entriesByCategory.set(entry.category, entry);
  }

  return Object.freeze({
    hasCategoryMatch(candidate: string): RegistryQueryResult {
      const entry = entriesByCategory.get(candidate);
      if (entry) {
        return Object.freeze({
          matched: true,
          category: entry.category,
          classificationDepth: entry.classificationDepth,
        });
      }

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
