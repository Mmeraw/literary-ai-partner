import type {
  BoundaryCrossingCategory,
  RegistryQueryResult,
  EscapeAnnotationPattern,
} from "../../protected/registry";

export type GuardOutcome = "pass" | "fail";

export interface ScanTarget {
  readonly relativePath: string;
  readonly content: string;
  readonly inScope: boolean;
  readonly scopeRationale: string;
}

export interface MatchSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly lineNumber: number;
}

export type EscapeValidatorOutcome =
  | "accepted"
  | "rejected-no-path-classification"
  | "rejected-malformed-annotation"
  | "rejected-out-of-scope-path";

export interface Violation {
  readonly relativePath: string;
  readonly category: BoundaryCrossingCategory;
  readonly classificationDepth: NonNullable<RegistryQueryResult["classificationDepth"]>;
  readonly span: MatchSpan;
  readonly hasNearbyEscapeAnnotation: boolean;
  readonly escapeValidatorOutcome: EscapeValidatorOutcome | null;
}

export interface RawMatch {
  readonly relativePath: string;
  readonly span: MatchSpan;
  readonly result: RegistryQueryResult;
  readonly hasNearbyEscapeAnnotation: boolean;
}

export interface ScanReport {
  readonly outcome: GuardOutcome;
  readonly scanTargetCount: number;
  readonly inScopeTargetCount: number;
  readonly violationCount: number;
  readonly acceptedExceptionCount: number;
  readonly rejectedExceptionCount: number;
  readonly violations: ReadonlyArray<Violation>;
  readonly registryValidationOk: boolean;
  readonly escapeContract: EscapeAnnotationPattern;
}
