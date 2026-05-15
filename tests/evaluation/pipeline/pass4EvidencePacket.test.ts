import { buildPass4EvidencePacket } from "@/lib/evaluation/pipeline/pass4EvidencePacket";

// ---- Test fixtures (deterministic, no external files) ---------------------

/**
 * Build a synthetic manuscript of `targetWords` words, with clear
 * positional markers so we can assert that the packet actually pulls
 * from the early / middle / late / ending regions of the text.
 *
 * Markers:
 *   - "OPENING_MARKER_ALPHA"  — first paragraph
 *   - "MIDDLE_MARKER_BETA"    — placed ~50% into the manuscript
 *   - "ENDING_MARKER_OMEGA"   — last paragraph
 */
function makeSyntheticManuscript(targetWords: number): string {
  // Use short, prose-realistic words (~5 chars + space) so the
  // resulting char count matches typical English prose density. This
  // keeps compression-ratio tests realistic (real prose is ~6 chars
  // per word; we hit ~6 here including the space).
  const PARA_WORDS = 50;
  const VOCAB = [
    "the", "and", "of", "to", "in", "a", "that", "he", "was", "it",
    "with", "for", "as", "on", "his", "is", "at", "by", "she", "from",
    "they", "this", "had", "not", "but", "be", "have", "are", "were", "one",
    "all", "would", "there", "their", "what", "so", "up", "out", "if", "about",
    "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
  ];
  const paragraphsNeeded = Math.ceil(targetWords / PARA_WORDS);
  const paragraphs: string[] = [];

  for (let i = 0; i < paragraphsNeeded; i++) {
    const words: string[] = [];
    for (let w = 0; w < PARA_WORDS; w++) {
      words.push(VOCAB[(i * 7 + w * 3) % VOCAB.length]);
    }
    paragraphs.push(words.join(" "));
  }

  // Build the body first, then inject markers at exact character
  // fractions so the middle-marker test isn't sensitive to paragraph
  // length variance.
  const body = paragraphs.join("\n\n");
  const midChar = Math.floor(body.length * 0.5);
  // Snap to next whitespace so we don't split a word.
  let midInsertAt = midChar;
  while (
    midInsertAt < body.length &&
    body[midInsertAt] !== " " &&
    body[midInsertAt] !== "\n"
  ) {
    midInsertAt++;
  }

  const withMid =
    body.slice(0, midInsertAt) +
    " MIDDLE_MARKER_BETA " +
    body.slice(midInsertAt);

  return (
    "OPENING_MARKER_ALPHA " +
    withMid +
    " ENDING_MARKER_OMEGA"
  );
}

// ---- Short-form behavior --------------------------------------------------

describe("buildPass4EvidencePacket - short manuscripts", () => {
  it("returns compact single-window packet for short manuscripts (< 25k words)", () => {
    const text = makeSyntheticManuscript(1_000);
    const packet = buildPass4EvidencePacket(text);

    expect(packet.selectedWindows).toEqual(["full"]);
    expect(packet.includesOpening).toBe(true);
    expect(packet.packetChars).toBeLessThanOrEqual(18_000);
    expect(packet.text.length).toBe(packet.packetChars);
    expect(packet.sourceWords).toBeGreaterThanOrEqual(950);
  });

  it("handles empty input cleanly", () => {
    const packet = buildPass4EvidencePacket("");
    expect(packet.text).toBe("");
    expect(packet.packetChars).toBe(0);
    expect(packet.selectedWindows).toEqual([]);
    expect(packet.includesOpening).toBe(false);
    expect(packet.includesEnding).toBe(false);
  });

  it("handles whitespace-only input cleanly", () => {
    const packet = buildPass4EvidencePacket("   \n\n   ");
    expect(packet.sourceWords).toBe(0);
    // It's still non-empty in chars, so short-form path returns it.
    // Either short-form ["full"] with trimmed text or empty packet
    // is acceptable; key invariant: no crash.
    expect(packet.packetChars).toBeLessThanOrEqual(18_000);
  });

  it("preserves ENDING evidence when short-form manuscript exceeds 18k chars", () => {
    // ~5k words is below the long-form threshold but above 18k chars,
    // which exercises the short-form truncation edge case.
    const text = makeSyntheticManuscript(5_000);
    const packet = buildPass4EvidencePacket(text);

    expect(packet.sourceWords).toBeLessThan(25_000);
    expect(packet.sourceChars).toBeGreaterThan(18_000);
    expect(packet.includesEnding).toBe(true);
    expect(packet.selectedWindows).toContain("final");
    expect(packet.text).toMatch(/--- WINDOW: ENDING/);
    expect(packet.text).toContain("ENDING_MARKER_OMEGA");
  });
});

// ---- Long-form behavior ---------------------------------------------------

describe("buildPass4EvidencePacket - long-form manuscripts (>= 25k words)", () => {
  // ~30k words ≈ a short novella, just over the threshold.
  const text30k = makeSyntheticManuscript(30_000);
  // ~105k words ≈ Froggin Noggin size, the real production case.
  const text105k = makeSyntheticManuscript(105_000);

  it("does NOT collapse to the first 3000 chars (the bug being fixed)", () => {
    const packet = buildPass4EvidencePacket(text105k);

    // The old buggy code returned exactly 3000 chars. We must be
    // meaningfully larger than that.
    expect(packet.packetChars).toBeGreaterThan(10_000);
    expect(packet.text.length).toBeGreaterThan(10_000);
  });

  it("includes opening, middle, and ending windows for novel-length text", () => {
    const packet = buildPass4EvidencePacket(text105k);

    expect(packet.selectedWindows).toContain("opening");
    expect(packet.selectedWindows).toContain("middle");
    expect(packet.selectedWindows).toContain("final");
    expect(packet.includesOpening).toBe(true);
    expect(packet.includesEnding).toBe(true);
  });

  it("pulls actual content from early / middle / ending of the source", () => {
    const packet = buildPass4EvidencePacket(text105k);

    // OPENING_MARKER_ALPHA is in the first paragraph, must appear.
    expect(packet.text).toContain("OPENING_MARKER_ALPHA");
    // ENDING_MARKER_OMEGA is in the last paragraph, must appear.
    expect(packet.text).toContain("ENDING_MARKER_OMEGA");
    // MIDDLE_MARKER_BETA sits at ~50% — `middle` window is anchored
    // at 0.5 so it should be captured.
    expect(packet.text).toContain("MIDDLE_MARKER_BETA");
  });

  it("emits labeled window headers in the packet text", () => {
    const packet = buildPass4EvidencePacket(text105k);

    expect(packet.text).toMatch(/--- WINDOW: OPENING/);
    expect(packet.text).toMatch(/--- WINDOW: ENDING/);
  });

  it("respects the hard cap of 40k chars even with default options", () => {
    const packet = buildPass4EvidencePacket(text105k);
    expect(packet.packetChars).toBeLessThanOrEqual(40_000);
  });

  it("targets 18k–30k chars by default for long-form", () => {
    const packet = buildPass4EvidencePacket(text105k);
    expect(packet.packetChars).toBeGreaterThanOrEqual(15_000);
    expect(packet.packetChars).toBeLessThanOrEqual(30_000);
  });

  it("yields compression ratio >= 0.03 for a 30k-word manuscript", () => {
    // 30k words ≈ ~180k chars; packet ~22k chars → ratio ~0.12.
    // The contract is "at least 0.03" — far above the 0.009 bug case.
    const packet = buildPass4EvidencePacket(text30k);
    expect(packet.compressionRatio).toBeGreaterThanOrEqual(0.03);
  });

  it("yields meaningful compression ratio even on a 105k-word manuscript", () => {
    // 105k words ≈ ~630k chars; packet ~22k chars → ratio ~0.035.
    // Bug baseline was 0.009 with the 3000-char excerpt. We require
    // strictly better than that.
    const packet = buildPass4EvidencePacket(text105k);
    expect(packet.compressionRatio).toBeGreaterThan(0.009);
    expect(packet.compressionRatio).toBeGreaterThanOrEqual(0.03);
  });

  it("always includes the ending window (required for narrativeClosure)", () => {
    // Even at the threshold (just over 25k words), the ending must
    // be present because narrativeClosure adjudication depends on it.
    const text25k = makeSyntheticManuscript(26_000);
    const packet = buildPass4EvidencePacket(text25k);
    expect(packet.includesEnding).toBe(true);
    expect(packet.text).toContain("ENDING_MARKER_OMEGA");
  });

  it("returns metadata fields with expected shape", () => {
    const packet = buildPass4EvidencePacket(text105k);
    expect(typeof packet.sourceWords).toBe("number");
    expect(typeof packet.sourceChars).toBe("number");
    expect(typeof packet.packetChars).toBe("number");
    expect(typeof packet.compressionRatio).toBe("number");
    expect(Array.isArray(packet.selectedWindows)).toBe(true);
    expect(typeof packet.includesOpening).toBe("boolean");
    expect(typeof packet.includesEnding).toBe("boolean");

    expect(packet.sourceWords).toBeGreaterThan(100_000);
    expect(packet.sourceWords).toBeLessThan(115_000);
    expect(packet.packetChars).toBe(packet.text.length);
  });

  it("strips markdown image references from the packet", () => {
    const polluted =
      makeSyntheticManuscript(30_000) +
      "\n\n![cover image](https://example.com/cover.png)\n\n" +
      "Final paragraph after the image. END_MARKER_GAMMA.";

    const packet = buildPass4EvidencePacket(polluted);
    expect(packet.text).not.toContain("![cover image]");
    expect(packet.text).not.toContain("https://example.com/cover.png");
  });
});

// ---- Custom options -------------------------------------------------------

describe("buildPass4EvidencePacket - options", () => {
  it("respects a custom hardCapChars override", () => {
    const text = makeSyntheticManuscript(60_000);
    const packet = buildPass4EvidencePacket(text, { hardCapChars: 12_000 });
    expect(packet.packetChars).toBeLessThanOrEqual(12_000);
  });

  it("respects a custom longFormWordThreshold (forces long-form on small input)", () => {
    const text = makeSyntheticManuscript(2_000);
    const packet = buildPass4EvidencePacket(text, {
      longFormWordThreshold: 1_000,
    });
    expect(packet.selectedWindows).not.toEqual(["full"]);
    expect(packet.includesEnding).toBe(true);
  });

  it("enforces hard cap without truncating the ENDING window", () => {
    const text = makeSyntheticManuscript(80_000);
    const packet = buildPass4EvidencePacket(text, { hardCapChars: 12_000 });

    expect(packet.packetChars).toBeLessThanOrEqual(12_000);
    expect(packet.includesEnding).toBe(true);
    expect(packet.selectedWindows).toContain("final");
    expect(packet.text).toMatch(/--- WINDOW: ENDING/);
    expect(packet.text).toContain("ENDING_MARKER_OMEGA");
  });
});
