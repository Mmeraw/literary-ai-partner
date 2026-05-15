/**
 * Pass 4 — Representative Long-Form Evidence Packet Builder
 *
 * Purpose
 * -------
 * Pass 4 (Perplexity adjudication) historically received only the first
 * 3,000 characters of the manuscript. For a 100k-word novel that is
 * ~0.5% of the text and biases adjudication toward whatever appears in
 * the opening pages (often front matter or a single early scene). The
 * result was systemic `PASS4_WEAK_AGREEMENT` failures driven not by
 * actual disagreement but by the adjudicator being underfed.
 *
 * This builder returns a bounded representative packet:
 *   - Short manuscripts (< 25k words): compact behavior preserved.
 *   - Long manuscripts (>= 25k words): five labeled windows
 *     (opening, early, middle, late, ending) so the adjudicator sees
 *     the beginning, midpoint, and resolution — critical for criteria
 *     like narrativeDrive, pacing, and narrativeClosure.
 *
 * Hard limits
 *   - Target: 18,000 – 30,000 chars for long-form
 *   - Cap:    40,000 chars (hard)
 *   - Always includes the ending for narrativeClosure adjudication.
 *
 * The packet is markdown-stripped of image references so the model is
 * not distracted by `![alt](url)` tokens.
 *
 * No side effects, no I/O. Pure function.
 */

export type Pass4WindowLabel =
  | "full"
  | "opening"
  | "early"
  | "middle"
  | "late"
  | "ending";

export interface Pass4EvidencePacket {
  /** Final prompt-ready text, already labeled with window headers. */
  text: string;
  /** Words in the original manuscript (whitespace-split count). */
  sourceWords: number;
  /** Characters in the original manuscript. */
  sourceChars: number;
  /** Characters in the final packet text. */
  packetChars: number;
  /** packetChars / sourceChars, rounded to 4 decimals. */
  compressionRatio: number;
  /** Window labels included, in order they appear in the packet. */
  selectedWindows: Pass4WindowLabel[];
  /** True if an opening / first-window slice is included. */
  includesOpening: boolean;
  /** True if a closing / ending slice is included. */
  includesEnding: boolean;
}

export interface Pass4EvidencePacketOptions {
  /**
   * Threshold at which the long-form, multi-window strategy kicks in.
   * Default: 25,000 words.
   */
  longFormWordThreshold?: number;
  /**
   * Target packet size for long-form manuscripts. The builder will
   * try to land between 18k and this value. Default: 30,000 chars.
   */
  targetChars?: number;
  /**
   * Absolute hard cap. The packet will never exceed this size, even
   * if every window were at full size. Default: 40,000 chars.
   */
  hardCapChars?: number;
}

const DEFAULTS: Required<Pass4EvidencePacketOptions> = {
  longFormWordThreshold: 25_000,
  targetChars: 30_000,
  hardCapChars: 40_000,
};

// Per-window sizes for long-form. Sum = 29,000 chars baseline; the
// builder may shrink proportionally to stay within targetChars. This
// sum is sized so that a 100k-word (~600k-char) manuscript yields a
// compression ratio of ~0.04–0.05 (well above the 0.009 bug baseline).
const LONG_FORM_WINDOW_SIZES: Record<
  Exclude<Pass4WindowLabel, "full">,
  number
> = {
  opening: 5_000,
  early: 5_500,
  middle: 6_000,
  late: 5_500,
  ending: 7_000,
};

const WINDOW_ORDER: Exclude<Pass4WindowLabel, "full">[] = [
  "opening",
  "early",
  "middle",
  "late",
  "ending",
];

const WINDOW_DISPLAY_LABELS: Record<Pass4WindowLabel, string> = {
  full: "FULL",
  opening: "OPENING",
  early: "EARLY",
  middle: "MIDDLE",
  late: "LATE",
  ending: "ENDING",
};

// Anchor fractions for early / middle / late (opening and ending are
// always at the extremes).
const WINDOW_ANCHORS: Record<"early" | "middle" | "late", number> = {
  early: 0.15,
  middle: 0.5,
  late: 0.8,
};

/**
 * Strip markdown image references like ![alt](url) so they don't
 * pollute the adjudicator's view. Other markdown (links, emphasis,
 * headings) is left intact since it can carry semantic meaning.
 */
function stripMarkdownImages(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");
}

/**
 * Whitespace-split word count. Cheap and stable; matches the
 * convention used elsewhere in the pipeline (countWords in
 * runPipeline.ts).
 */
function countWords(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Given a desired starting char index and a desired length, return a
 * slice that prefers paragraph boundaries (\n\n) when one is within
 * 400 chars before the requested start. Falls back to a sentence
 * boundary, then a hard cut. Never extends past textLen.
 */
function sliceOnBoundary(
  text: string,
  rawStart: number,
  desiredLen: number,
): string {
  const textLen = text.length;
  if (textLen === 0) return "";

  const start = Math.max(0, Math.min(rawStart, textLen - 1));
  const end = Math.min(textLen, start + desiredLen);

  // Look backward up to 400 chars for a paragraph break to anchor
  // the slice cleanly.
  const lookbackWindow = text.slice(Math.max(0, start - 400), start);
  const paraIdx = lookbackWindow.lastIndexOf("\n\n");
  let adjustedStart = start;
  if (paraIdx >= 0) {
    adjustedStart = Math.max(0, start - 400) + paraIdx + 2;
  } else {
    // Try a sentence boundary in the same lookback window.
    const sentMatch = lookbackWindow.match(/[.!?]\s+(?=[A-Z"'\u201C])/g);
    if (sentMatch && sentMatch.length > 0) {
      const lastSent = lookbackWindow.lastIndexOf(
        sentMatch[sentMatch.length - 1],
      );
      if (lastSent >= 0) {
        adjustedStart =
          Math.max(0, start - 400) +
          lastSent +
          sentMatch[sentMatch.length - 1].length;
      }
    }
  }

  // Cap forward end at textLen and avoid running past it.
  const adjustedEnd = Math.min(textLen, adjustedStart + desiredLen);
  return text.slice(adjustedStart, adjustedEnd).trim();
}

function buildWindowSection(label: Pass4WindowLabel, body: string): string {
  return (
    `--- WINDOW: ${WINDOW_DISPLAY_LABELS[label]} (~${body.length} chars) ---\n` +
    body
  );
}

/**
 * Build the representative evidence packet.
 *
 * @param manuscriptText The full manuscript text (the caller already
 *   has it loaded — `runPipeline` passes the same string used for
 *   Passes 1–3).
 * @param options Optional overrides (see Pass4EvidencePacketOptions).
 */
export function buildPass4EvidencePacket(
  manuscriptText: string,
  options: Pass4EvidencePacketOptions = {},
): Pass4EvidencePacket {
  const opts = { ...DEFAULTS, ...options };
  const cleaned = stripMarkdownImages(manuscriptText ?? "");
  const sourceChars = cleaned.length;
  const sourceWords = countWords(cleaned);

  // --- Edge case: empty / trivial input ---
  if (sourceChars === 0) {
    return {
      text: "",
      sourceWords: 0,
      sourceChars: 0,
      packetChars: 0,
      compressionRatio: 0,
      selectedWindows: [],
      includesOpening: false,
      includesEnding: false,
    };
  }

  // --- Short-form path: preserve compact behavior ---
  if (sourceWords < opts.longFormWordThreshold) {
    const shortCap = Math.min(18_000, opts.hardCapChars);

    // Preserve compact legacy behavior when the full short manuscript fits.
    if (sourceChars <= shortCap) {
      const text = cleaned.slice(0, shortCap);
      return {
        text,
        sourceWords,
        sourceChars,
        packetChars: text.length,
        compressionRatio:
          sourceChars > 0
            ? Math.round((text.length / sourceChars) * 10_000) / 10_000
            : 0,
        selectedWindows: ["full"],
        includesOpening: true,
        includesEnding: true,
      };
    }

    // If short-form content exceeds cap, preserve ending evidence by
    // emitting a compact OPENING + ENDING packet.
    const desiredEndingChars = Math.min(7_000, Math.floor(shortCap * 0.45));
    const endingBody = cleaned.slice(Math.max(0, sourceChars - desiredEndingChars)).trim();
    const endingSection = buildWindowSection("ending", endingBody);

    const desiredOpeningChars = Math.min(8_000, Math.floor(shortCap * 0.55));
    const openingRaw = cleaned.slice(0, desiredOpeningChars).trim();
    const openingHeader = `--- WINDOW: ${WINDOW_DISPLAY_LABELS.opening} (~`;
    const openingSuffix = ` chars) ---\n`;
    const openingSeparatorBudget = 2; // "\n\n"
    const openingBodyBudget = Math.max(
      0,
      shortCap - endingSection.length - openingSeparatorBudget - openingHeader.length - openingSuffix.length,
    );
    const openingBody = openingRaw.slice(0, openingBodyBudget).trim();

    const sections: string[] = [];
    const selectedWindows: Pass4WindowLabel[] = [];

    if (openingBody.length > 0) {
      sections.push(buildWindowSection("opening", openingBody));
      selectedWindows.push("opening");
    }
    sections.push(endingSection);
    selectedWindows.push("ending");

    const text = sections.join("\n\n");
    return {
      text,
      sourceWords,
      sourceChars,
      packetChars: text.length,
      compressionRatio:
        sourceChars > 0
          ? Math.round((text.length / sourceChars) * 10_000) / 10_000
          : 0,
      selectedWindows,
      includesOpening: selectedWindows.includes("opening"),
      includesEnding: true,
    };
  }

  // --- Long-form path: multi-window labeled packet ---

  // Compute the raw budget. If sum of default window sizes exceeds
  // targetChars, shrink each proportionally. Always respect hard cap.
  const rawSum = WINDOW_ORDER.reduce(
    (acc, w) => acc + LONG_FORM_WINDOW_SIZES[w],
    0,
  );
  const budget = Math.min(opts.targetChars, opts.hardCapChars);
  const scale = rawSum > budget ? budget / rawSum : 1;

  const sized: Record<Exclude<Pass4WindowLabel, "full">, number> = {
    opening: Math.floor(LONG_FORM_WINDOW_SIZES.opening * scale),
    early: Math.floor(LONG_FORM_WINDOW_SIZES.early * scale),
    middle: Math.floor(LONG_FORM_WINDOW_SIZES.middle * scale),
    late: Math.floor(LONG_FORM_WINDOW_SIZES.late * scale),
    ending: Math.floor(LONG_FORM_WINDOW_SIZES.ending * scale),
  };

  const slices: { label: Pass4WindowLabel; body: string }[] = [];

  // Opening — always first sized.opening chars.
  const opening = cleaned.slice(0, sized.opening).trim();
  if (opening.length > 0) slices.push({ label: "opening", body: opening });

  // Early / middle / late — anchored by fractions, centered on the
  // anchor (the slice brackets the anchor point so a marker placed
  // *at* the anchor lands inside the window, not just after it).
  for (const label of ["early", "middle", "late"] as const) {
    const anchor = Math.floor(sourceChars * WINDOW_ANCHORS[label]);
    const halfSize = Math.floor(sized[label] / 2);
    const rawStart = Math.max(0, anchor - halfSize);
    const body = sliceOnBoundary(cleaned, rawStart, sized[label]);
    if (body.length > 0) slices.push({ label, body });
  }

  // Ending — always pinned to the absolute end of the manuscript so
  // narrativeClosure adjudication has the final lines. We snap the
  // *start* to a paragraph boundary but never trim the tail.
  const rawEndingStart = Math.max(0, sourceChars - sized.ending);
  // Look back up to 400 chars for a paragraph break to anchor cleanly,
  // but never extend past sourceChars on the right.
  const lookback = cleaned.slice(
    Math.max(0, rawEndingStart - 400),
    rawEndingStart,
  );
  const paraIdx = lookback.lastIndexOf("\n\n");
  const endingStart =
    paraIdx >= 0
      ? Math.max(0, rawEndingStart - 400) + paraIdx + 2
      : rawEndingStart;
  const ending = cleaned.slice(endingStart, sourceChars).trim();
  if (ending.length > 0) slices.push({ label: "ending", body: ending });

  // De-duplicate accidental overlap between adjacent windows on
  // short-ish "long-form" manuscripts (e.g., 25-30k words where
  // late/ending might collide). If two consecutive slices share the
  // same final 200 chars, trim the later one.
  for (let i = 1; i < slices.length; i++) {
    const prev = slices[i - 1].body;
    const cur = slices[i].body;
    if (prev.length >= 200 && cur.length >= 200) {
      const tail = prev.slice(-200);
      const overlapAt = cur.indexOf(tail);
      if (overlapAt >= 0 && overlapAt < cur.length / 2) {
        slices[i] = {
          label: slices[i].label,
          body: cur.slice(overlapAt + tail.length).trim(),
        };
      }
    }
  }

  const nonEmptySlices = slices.filter((s) => s.body.length > 0);

  // Assemble text with ending-safe hard-cap handling. We preserve the
  // ENDING window and trim/drop earlier windows first when needed.
  const rawSections = nonEmptySlices.map((s) => ({
    label: s.label,
    body: s.body,
    section: buildWindowSection(s.label, s.body),
  }));

  const joinSections = (sections: string[]): string => sections.join("\n\n");

  const fullText = joinSections(rawSections.map((s) => s.section));
  let finalSections = rawSections;

  if (fullText.length > opts.hardCapChars) {
    const ending = rawSections.find((s) => s.label === "ending");
    const prefix = rawSections.filter((s) => s.label !== "ending");

    if (ending) {
      let endingBody = ending.body;
      let endingSection = buildWindowSection("ending", endingBody);

      // Pathological tiny hard-cap fallback: keep ENDING intact as a
      // section and trim from the *front* of ending body if required.
      if (endingSection.length > opts.hardCapChars) {
        while (
          endingBody.length > 0 &&
          buildWindowSection("ending", endingBody).length > opts.hardCapChars
        ) {
          endingBody = endingBody.slice(1);
        }
        endingSection = buildWindowSection("ending", endingBody);
      }

      const keptPrefix: typeof rawSections = [];
      let used = endingSection.length;
      for (const candidate of prefix) {
        const separator = keptPrefix.length > 0 ? 2 : 2;
        if (used + separator + candidate.section.length <= opts.hardCapChars) {
          keptPrefix.push(candidate);
          used += separator + candidate.section.length;
        }
      }

      finalSections = [
        ...keptPrefix,
        {
          label: "ending",
          body: endingBody,
          section: endingSection,
        },
      ];
    } else {
      // Defensive fallback if no ending section exists.
      const kept: typeof rawSections = [];
      let used = 0;
      for (const candidate of rawSections) {
        const separator = kept.length > 0 ? 2 : 0;
        if (used + separator + candidate.section.length <= opts.hardCapChars) {
          kept.push(candidate);
          used += separator + candidate.section.length;
        }
      }
      finalSections = kept;
    }
  }

  const finalText = joinSections(finalSections.map((s) => s.section));
  const selectedWindows = finalSections.map((s) => s.label);

  return {
    text: finalText,
    sourceWords,
    sourceChars,
    packetChars: finalText.length,
    compressionRatio:
      sourceChars > 0
        ? Math.round((finalText.length / sourceChars) * 10_000) / 10_000
        : 0,
    selectedWindows,
    includesOpening: selectedWindows.includes("opening"),
    includesEnding: selectedWindows.includes("ending"),
  };
}