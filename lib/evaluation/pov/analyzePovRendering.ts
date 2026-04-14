import type { PovDiagnosticSummary, PovFinding, PovRenderType } from "./types";

export interface AnalyzePovRenderingInput {
  manuscriptText: string;
  isClosePov: boolean;
  povMode: "first_person" | "third_person_close" | "unknown";
}

export function analyzePovRendering(input: AnalyzePovRenderingInput): PovDiagnosticSummary {
  const { manuscriptText, isClosePov, povMode } = input;
  const findings: PovFinding[] = [];
  const paragraphs = splitParagraphs(manuscriptText);

  let integratedThoughtCount = 0;
  let markedThoughtCount = 0;
  let mixedRenderingCount = 0;
  let externalConsciousnessCount = 0;

  const italicRegex = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  const quoteRegex = /"([^"\n]+)"/g;
  const whisperVerbs = /\b(whispered|murmured|intoned|breathed)\b/i;
  const firstPersonThoughtPattern =
    /\b(I\s+(think|know|wonder|can't|won't|should|need|remember)|why am I|what if|I don't deserve|I'm not ready)\b/i;
  const clippedIntegratedPattern = /(^|\s)([A-Z][^.!?]{0,40}\.)\s([A-Z][^.!?]{0,40}\.)/;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const anchor = {
      excerpt: excerpt(p),
      paragraphRef: `p${i + 1}`,
    };

    const italics = p.match(italicRegex) ?? [];
    const quotes = [...p.matchAll(quoteRegex)];

    if (italics.length > 0) {
      markedThoughtCount += italics.length;
      if (isClosePov) {
        findings.push({
          code: "ITALICS_BASELINE_COGNITION",
          severity: "warning",
          renderType: "marked_cognition",
          rationale:
            "Italicized cognition appears in close POV. Canon defaults close POV to integrated thought unless italics signal intrusion, rupture, echo, or competing voice.",
          anchor,
          ruleSource: "VOL_II_POV_RENDERING_CONSISTENCY",
        });
      }
    }

    if (isClosePov && firstPersonThoughtPattern.test(p) && italics.length === 0) {
      integratedThoughtCount++;
      findings.push({
        code: povMode === "first_person" ? "ZERO_ITALICS_CLOSE_POV_VALID" : "INTEGRATED_COGNITION_STRONG",
        severity: "info",
        renderType: "integrated_cognition",
        rationale:
          "Thought is integrated into narration rather than artificially marked, supporting immediacy and POV authority.",
        anchor,
        ruleSource: "VOL_II_POV_RENDERING_CONSISTENCY",
      });
    } else if (isClosePov && clippedIntegratedPattern.test(p) && italics.length === 0) {
      integratedThoughtCount++;
      findings.push({
        code: "THOUGHT_CHANNEL_STABLE",
        severity: "info",
        renderType: "integrated_cognition",
        rationale:
          "Compressed cognition appears continuous with narration, indicating stable thought-channel control.",
        anchor,
        ruleSource: "VOL_II_POV_RENDERING_CONSISTENCY",
      });
    }

    if (quotes.length > 0 && whisperVerbs.test(p)) {
      findings.push({
        code: "NON_AUDITORY_IN_QUOTES",
        severity: "warning",
        renderType: "audible_dialogue",
        rationale:
          "Quoted text appears with non-auditory communication markers; canon reserves quotation marks for audible speech.",
        anchor,
        ruleSource: "VOL_II_WHISPER_RULE",
      });
      externalConsciousnessCount++;
    }
  }

  if (integratedThoughtCount > 0 && markedThoughtCount > 0) {
    mixedRenderingCount = 1;
    findings.push({
      code: "MIXED_THOUGHT_RENDERING_NO_LOGIC",
      severity: "warning",
      renderType: "mixed_rendering",
      rationale:
        "Integrated and marked thought both appear; reviewer must verify that marking reflects second-layer cognition rather than inconsistent baseline thought rendering.",
      anchor: {
        excerpt: "Chapter-level mixed thought rendering detected.",
      },
      ruleSource: "VOL_II_POV_RENDERING_CONSISTENCY",
    });
  }

  const issueCount = findings.filter((f) => f.severity !== "info").length;
  const dominantMode: PovRenderType =
    markedThoughtCount > integratedThoughtCount
      ? "marked_cognition"
      : integratedThoughtCount > 0
        ? "integrated_cognition"
        : "unknown";

  return {
    dominantMode,
    integratedThoughtCount,
    markedThoughtCount,
    mixedRenderingCount,
    externalConsciousnessCount,
    issueCount,
    findings,
  };
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function excerpt(text: string, max = 220): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
