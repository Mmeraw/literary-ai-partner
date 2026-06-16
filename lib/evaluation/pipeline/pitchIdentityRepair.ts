/**
 * Deterministic Pitch Identity Repair
 *
 * Dream Template requires three semantically distinct fields:
 *   one_sentence_pitch  — market hook (sells the story to an agent/reader)
 *   one_paragraph_pitch  — story synopsis (back-cover copy: who, what, stakes)
 *   one_paragraph_summary — diagnostic judgment (editorial feedback with scores)
 *
 * LLMs frequently collapse these into the same paragraph. This module detects
 * overlap and mechanically rewrites the collapsed fields using available source
 * data (premise, strengths, risks) so renderers receive distinct content.
 *
 * Runs after CMOS sanitization, before quality gate.
 */

type PitchRepairInput = {
  one_paragraph_summary: string;
  one_sentence_pitch?: string;
  one_paragraph_pitch?: string;
  premise?: string;
  top_3_strengths?: string[];
  top_3_risks?: string[];
  title?: string;
};

type PitchRepairResult = {
  one_sentence_pitch: string | undefined;
  one_paragraph_pitch: string | undefined;
  repaired: boolean;
  repairs: string[];
};

function normalize(text: string | undefined | null): string {
  return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

/**
 * Jaccard similarity on word-level tokens — fast heuristic for content overlap.
 * Returns 0..1 where 1 = identical word sets.
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

const OVERLAP_THRESHOLD = 0.70;

/**
 * Derive a one-sentence market hook from the premise.
 * Strips evaluation language, returns a clean hook sentence.
 */
function deriveHookFromPremise(premise: string): string {
  const first = firstSentence(premise);
  if (!first) return "";
  // Strip evaluation language if it leaked
  if (/\b(score|criterion|evaluation|manuscript demonstrates|revision)\b/i.test(first)) return "";
  return first;
}

/**
 * Build a story synopsis from premise + top risk, ensuring it differs from
 * both the executive summary and the one-sentence pitch.
 */
function deriveSynopsisFromPremise(
  premise: string,
  risks: string[],
): string {
  const clean = premise.trim();
  if (!clean) return "";
  const topRisk = risks.length > 0
    ? risks[0].trim().replace(/\.\s*$/, "")
    : "";
  // Combine premise with a craft tension line if available
  if (topRisk && !clean.includes(topRisk.substring(0, 20))) {
    return `${clean} The main craft challenge: ${topRisk.toLowerCase()}.`;
  }
  return clean;
}

export function repairPitchIdentity(input: PitchRepairInput): PitchRepairResult {
  const repairs: string[] = [];
  const summaryNorm = normalize(input.one_paragraph_summary);
  let pitchNorm = normalize(input.one_paragraph_pitch);
  let sentenceNorm = normalize(input.one_sentence_pitch);
  let repairedPitch = input.one_paragraph_pitch;
  let repairedSentence = input.one_sentence_pitch;

  // ── Repair 1: one_paragraph_pitch ≈ one_paragraph_summary ────────────
  // The pitch should be back-cover copy, not diagnostic judgment.
  if (pitchNorm && summaryNorm) {
    const isExactDuplicate = pitchNorm === summaryNorm;
    const isHighOverlap = !isExactDuplicate && jaccardSimilarity(pitchNorm, summaryNorm) > OVERLAP_THRESHOLD;
    const isContained = !isExactDuplicate && (summaryNorm.includes(pitchNorm) || pitchNorm.includes(summaryNorm));

    if (isExactDuplicate || isHighOverlap || isContained) {
      const premiseSynopsis = input.premise
        ? deriveSynopsisFromPremise(input.premise, input.top_3_risks ?? [])
        : "";
      if (premiseSynopsis && jaccardSimilarity(premiseSynopsis, summaryNorm) < OVERLAP_THRESHOLD) {
        repairedPitch = premiseSynopsis;
        repairs.push(
          isExactDuplicate
            ? "one_paragraph_pitch was identical to executive summary — replaced with premise-derived synopsis"
            : isContained
              ? "one_paragraph_pitch was contained in executive summary — replaced with premise-derived synopsis"
              : "one_paragraph_pitch had >70% word overlap with executive summary — replaced with premise-derived synopsis",
        );
      }
    }
  }

  // ── Repair 2: one_sentence_pitch ⊂ one_paragraph_pitch or summary ───
  // The hook must be a distinct selling sentence, not a substring.
  pitchNorm = normalize(repairedPitch); // re-normalize after potential repair
  if (sentenceNorm) {
    const isDupOfSummary = sentenceNorm === summaryNorm;
    const isDupOfPitch = pitchNorm && sentenceNorm === pitchNorm;
    const isSubstringOfSummary = !isDupOfSummary && summaryNorm.includes(sentenceNorm);
    const isSubstringOfPitch = !isDupOfPitch && pitchNorm && pitchNorm.includes(sentenceNorm);
    const isHighOverlapSummary = !isDupOfSummary && !isSubstringOfSummary && jaccardSimilarity(sentenceNorm, summaryNorm) > OVERLAP_THRESHOLD;

    if (isDupOfSummary || isDupOfPitch || isSubstringOfSummary || isSubstringOfPitch || isHighOverlapSummary) {
      const premiseHook = input.premise ? deriveHookFromPremise(input.premise) : "";
      if (premiseHook && normalize(premiseHook) !== sentenceNorm && normalize(premiseHook) !== summaryNorm) {
        repairedSentence = premiseHook;
        repairs.push("one_sentence_pitch overlapped with summary/pitch — replaced with premise-derived hook");
      }
    }
  }

  // ── Repair 3: one_sentence_pitch still missing or empty ──────────────
  if (!repairedSentence?.trim() && input.premise) {
    const hook = deriveHookFromPremise(input.premise);
    if (hook) {
      repairedSentence = hook;
      repairs.push("one_sentence_pitch was empty — derived from premise");
    }
  }

  // ── Repair 4: one_paragraph_pitch still missing or empty ─────────────
  if (!repairedPitch?.trim() && input.premise) {
    const synopsis = deriveSynopsisFromPremise(input.premise, input.top_3_risks ?? []);
    if (synopsis) {
      repairedPitch = synopsis;
      repairs.push("one_paragraph_pitch was empty — derived from premise");
    }
  }

  return {
    one_sentence_pitch: repairedSentence,
    one_paragraph_pitch: repairedPitch,
    repaired: repairs.length > 0,
    repairs,
  };
}
