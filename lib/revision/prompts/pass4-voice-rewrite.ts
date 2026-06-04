/**
 * Pass 4 — Voice-Conditioned Rewrite Prompt
 *
 * Generates manuscript-ready A/B/C replacement prose for revision opportunities.
 * Uses the author's own manuscript as voice context to ensure rewrites
 * match the author's natural style, rhythm, vocabulary, and POV.
 *
 * Fires per revision opportunity where target text ≤ 1200 words.
 * Items > 1200 words receive strategy-only treatment (no prose generation).
 *
 * Temperature: 0.6 (higher for creative generation)
 * Max tokens: 2000 per call
 */

export const PASS4_REWRITE_VERSION = "pass4-voice-rewrite-v1";

export const PASS4_SYSTEM_PROMPT = `You are a revision prose generator working in the author's voice.

Your job: produce three distinct A/B/C replacement passages that fix a diagnosed craft issue while perfectly matching the author's existing narrative voice, sentence rhythm, vocabulary level, and point of view.

RULES:
1. VOICE FIDELITY — You are mimicking the author. Study the VOICE CONTEXT provided. Match:
   - Sentence length patterns (short staccato vs. flowing compound)
   - Vocabulary register (literary, colloquial, technical, plain)
   - POV and tense (first-person past, third limited present, etc.)
   - Dialogue attribution style (said-only, action beats, varied verbs)
   - Paragraph density and rhythm
   - Figurative language frequency and type

2. THREE VARIANTS — Produce exactly three alternatives:
   - A (Recommended): The most natural, conservative fix. Minimal departure from original.
   - B (Quieter): A subtler, more restrained approach. Less intervention.
   - C (Bolder): A stronger, more dramatic rendering. Higher revision energy.

3. MANUSCRIPT-READY — Output must be copy-paste ready:
   - No meta-commentary, no "[insert X here]", no instructions
   - No template tokens (LOCATION, OPERATION, CHARACTER, PROTAGONIST)
   - Proper punctuation, dialogue formatting, paragraph breaks
   - Match the author's quotation mark style (curly vs. straight)
   - Preserve existing character names exactly as they appear in context

4. PASSAGE SIZE RULES:
   - If original ≤ 300 words: produce full replacement passages (same approximate length)
   - If original 300-1200 words: produce the key revised section (the sentences that change), wrapped with 1-2 sentences of unchanged context on each side for continuity

5. PRESERVE:
   - All character names, place names, and proper nouns from the original
   - Timeline/chronology (do not introduce events from other chapters)
   - Information that readers need (do not cut essential plot data)
   - The author's emotional register for the scene

6. DO NOT:
   - Add new characters or plot elements not in the original
   - Change the POV or tense
   - Use vocabulary significantly above or below the author's register
   - Introduce clichés or generic literary prose
   - Make the passage longer than 150% of the original (unless operation is "expand")
`;

export interface Pass4RewriteInput {
  /** The original passage that needs revision */
  originalPassage: string;
  /** The editorial instruction / fix direction */
  editorialInstruction: string;
  /** The diagnosed symptom */
  symptom: string;
  /** The diagnosed cause */
  cause: string;
  /** Mistake-proofing constraints */
  mistakeProofing: string;
  /** The revision operation type */
  operation: string;
  /** Voice context: 2-3 surrounding paragraphs from the manuscript */
  voiceContext: string;
  /** Optional: chapter/location for grounding */
  location: string;
  /** TrustedPath mode: generate only variant A to save costs */
  trustedPathOnly?: boolean;
}

export function buildPass4UserPrompt(input: Pass4RewriteInput): string {
  const variantInstruction = input.trustedPathOnly
    ? `Produce ONE manuscript-ready variant (the recommended fix) that addresses the diagnosed issue while maintaining the author's voice. Output as JSON:
{
  "a": "full replacement text"
}`
    : `Produce three manuscript-ready variants (A, B, C) that fix the diagnosed issue while maintaining the author's voice. Output as JSON:
{
  "a": "full replacement text for variant A",
  "b": "full replacement text for variant B",
  "c": "full replacement text for variant C"
}`;

  return `VOICE CONTEXT (study this to match the author's style):
"""
${input.voiceContext}
"""

ORIGINAL PASSAGE TO REVISE (${input.location}):
"""
${input.originalPassage}
"""

EDITORIAL INSTRUCTION: ${input.editorialInstruction}
SYMPTOM: ${input.symptom}
CAUSE: ${input.cause}
OPERATION: ${input.operation}
${input.mistakeProofing ? `PRESERVE (mistake-proofing): ${input.mistakeProofing}` : ""}

${variantInstruction}`;
}
