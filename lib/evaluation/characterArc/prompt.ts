/**
 * Character Arc Extraction — Prompt
 *
 * PR-579: LLM prompt for extracting the character arc ledger from a manuscript.
 *
 * Design goals:
 *   - Extract ALL load-bearing characters, not just protagonists
 *   - Identify relational engines (dyadic/group relationships with emotional weight)
 *   - Classify arc movement using the 4-beat model (start→pressure→turn→end)
 *   - Detect pronoun signals from manuscript evidence
 *   - Return structured JSON only — no prose commentary
 *
 * Temperature: 0.1 (low — extraction task, not generative)
 * Max tokens: 4000 (sufficient for 10–15 characters with evidence)
 */

export const CHARACTER_ARC_EXTRACTION_PROMPT_VERSION =
  'character_arc_extraction_v1';

export const CHARACTER_ARC_SYSTEM_PROMPT = `You are a character-system analyst. Your job is to extract a complete, structured character arc ledger from a manuscript.

RULES:
- Identify every character who carries narrative weight: protagonists, co-protagonists, major companions, significant supporting characters.
- Do NOT omit non-human characters (animals, AIs, spirits) if they carry reader attachment or closure weight.
- For each character, extract EVIDENCE from the manuscript text — short verbatim snippets (max 60 words each, max 5 per character).
- Classify arc movement using the 4-beat model: start state → pressure agent → turning point → end state. Use null for beats that cannot be identified from the text.
- Assign a narrative_weight_band: primary (protagonist/co-protagonist), major (load-bearing supporting), supporting (developed recurring), recurring (appears multiple times, limited arc), minor (functional/named once).
- Identify relational_engines: named dyadic or group relationships that carry emotional weight (e.g. "Hyla-Zimeon", "Rana-Newton"). List engine IDs on each character's entry.
- Detect pronouns from manuscript evidence. If pronouns are contradicted across the text, flag this.
- Do NOT evaluate craft. Do NOT score. Do NOT comment on quality. Only extract and classify.

Return ONLY a JSON object. No prose. No explanation. No markdown fencing.

JSON shape:
{
  "characters": [
    {
      "character_id": "snake_case_name",
      "name": "Canonical Name",
      "pronouns": ["she", "her"],
      "narrative_weight_band": "primary" | "major" | "supporting" | "recurring" | "minor",
      "arc_movement": {
        "start": "string or null",
        "pressure": "string or null",
        "turn": "string or null",
        "end": "string or null"
      },
      "arc_classification": "redemptive" | "tragic" | "coming_of_age" | "static" | "transformative" | "sacrificial" | "cyclical" | null,
      "ending_status": "resolved" | "open" | "absent" | "ambiguous",
      "relational_engines": ["engine_id_1"],
      "evidence_snippets": ["verbatim snippet 1", "verbatim snippet 2"]
    }
  ],
  "relational_engines": [
    {
      "engine_id": "character_a-character_b",
      "label": "Character A and Character B",
      "character_ids": ["character_a", "character_b"],
      "weight": "dominant" | "significant" | "contextual"
    }
  ]
}`;

/**
 * Build the user-turn prompt for character arc extraction.
 * Uses sampled chunks to stay within context window.
 */
export function buildCharacterArcUserPrompt(params: {
  title: string;
  wordCount: number;
  manuscriptSample: string; // sampled/truncated manuscript text
  chunkCount: number;
}): string {
  const { title, wordCount, manuscriptSample, chunkCount } = params;

  return `Manuscript: "${title}"
Word count: ${wordCount.toLocaleString()}
Chunk count: ${chunkCount}

Extract the complete character arc ledger for this manuscript.

MANUSCRIPT TEXT:
${manuscriptSample}

Return JSON only.`;
}
