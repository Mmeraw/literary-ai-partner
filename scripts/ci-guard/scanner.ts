import type { ReadOnlyRegistryConsumer } from "../../protected/registry";
import type { ScanTarget, RawMatch } from "./types";
import { classifyPath } from "./scope-rules";
import { hasNearbyEscapeAnnotation } from "./annotation-validator";

const TOKEN_PATTERN = /[A-Za-z][A-Za-z0-9_-]{2,}/g;

function computeLineNumber(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function* iterateCandidateTokens(content: string): Generator<{ token: string; offset: number; lineNumber: number }> {
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(content)) !== null) {
    const offset = match.index;
    yield {
      token: match[0],
      offset,
      lineNumber: computeLineNumber(content, offset),
    };
  }
}

export function buildScanTarget(relativePath: string, content: string): ScanTarget {
  const classification = classifyPath(relativePath);
  return {
    relativePath,
    content,
    inScope: classification.inScope,
    scopeRationale: classification.rationale,
  };
}

export function scanTarget(target: ScanTarget, registry: ReadOnlyRegistryConsumer): ReadonlyArray<RawMatch> {
  if (!target.inScope) return [];

  const annotation = registry.getEscapeAnnotationContract();
  const matches: RawMatch[] = [];

  for (const { token, offset, lineNumber } of iterateCandidateTokens(target.content)) {
    const result = registry.hasCategoryMatch(token);
    if (!result.matched || result.category === null || result.classificationDepth === null) {
      continue;
    }

    const span = {
      startOffset: offset,
      endOffset: offset + token.length,
      lineNumber,
    };

    matches.push({
      relativePath: target.relativePath,
      span,
      result,
      hasNearbyEscapeAnnotation: hasNearbyEscapeAnnotation(target.content, span, annotation.markerToken),
    });
  }

  return matches;
}
