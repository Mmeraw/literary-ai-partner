import type { EscapeAnnotationPattern } from "../../protected/registry";
import type { EscapeValidatorOutcome, MatchSpan } from "./types";
import { classifyPath } from "./scope-rules";

const ANNOTATION_PROXIMITY_LINES = 1;

interface AnnotationLookupResult {
  readonly found: boolean;
  readonly lineNumber: number | null;
  readonly malformed: boolean;
}

function findNearbyAnnotation(content: string, span: MatchSpan, marker: string): AnnotationLookupResult {
  const lines = content.split("\n");
  const matchLineIndex = Math.max(0, span.lineNumber - 1);
  const minLineIndex = Math.max(0, matchLineIndex - ANNOTATION_PROXIMITY_LINES);

  for (let i = minLineIndex; i <= matchLineIndex; i++) {
    const line = lines[i];
    if (!line || !line.includes(marker)) {
      continue;
    }

    const markerOffset = line.indexOf(marker);
    const beforeMarker = line.slice(0, markerOffset);
    const inLineComment = /\/\//.test(beforeMarker);
    const inBlockComment = /\/\*/.test(beforeMarker);

    if (!inLineComment && !inBlockComment) {
      return { found: true, lineNumber: i + 1, malformed: true };
    }

    return { found: true, lineNumber: i + 1, malformed: false };
  }

  return { found: false, lineNumber: null, malformed: false };
}

export function validateEscapeAnnotation(
  relativePath: string,
  content: string,
  span: MatchSpan,
  contract: EscapeAnnotationPattern,
): EscapeValidatorOutcome {
  const lookup = findNearbyAnnotation(content, span, contract.markerToken);

  if (!lookup.found) {
    return "rejected-no-path-classification";
  }

  if (lookup.malformed) {
    return "rejected-malformed-annotation";
  }

  if (contract.requiredValidatorCheck === "path-classification") {
    const classification = classifyPath(relativePath);
    if (classification.inScope) {
      return "rejected-out-of-scope-path";
    }
  }

  return "accepted";
}

export function hasNearbyEscapeAnnotation(content: string, span: MatchSpan, marker: string): boolean {
  return findNearbyAnnotation(content, span, marker).found;
}
