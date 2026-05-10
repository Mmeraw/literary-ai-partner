// [PROTECTED]
//
// Type definitions for the protected registry consumer contract.

export type BoundaryCrossingCategory = string & { readonly __brand: unique symbol };

export interface RegistryEntry {
  readonly category: BoundaryCrossingCategory;
  readonly classificationDepth: "literal" | "pattern-class" | "structural";
  readonly auditOrigin: RegistryAuditOrigin;
}

export interface RegistryAuditOrigin {
  readonly registryPrNumber: number;
  readonly mergedAt: string;
}

export interface EscapeAnnotationPattern {
  readonly markerToken: string;
  readonly requiredValidatorCheck: "path-classification" | "scope-annotation";
  readonly auditLogShape: "ci-summary" | "workflow-artifact";
}

export interface RegistryQueryResult {
  readonly matched: boolean;
  readonly category: BoundaryCrossingCategory | null;
  readonly classificationDepth: RegistryEntry["classificationDepth"] | null;
}

export interface RegistryValidationResult {
  readonly schemaValid: boolean;
  readonly categoryCount: number;
  readonly entryCount: number;
  readonly errors: ReadonlyArray<RegistryValidationError>;
}

export interface RegistryValidationError {
  readonly errorKind: "schema" | "reference" | "duplicate" | "classification";
  readonly entryIndex: number;
  readonly message: string;
}

export interface ReadOnlyRegistryConsumer {
  hasCategoryMatch(candidate: string): RegistryQueryResult;
  getEscapeAnnotationContract(): EscapeAnnotationPattern;
  validateRegistry(): RegistryValidationResult;
  getCategoryCount(): number;
}
