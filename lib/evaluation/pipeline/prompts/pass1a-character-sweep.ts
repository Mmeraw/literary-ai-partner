/**
 * Pass 1A — Character Evidence Sweep Prompt
 *
 * Runs in PARALLEL with Pass 1 and Pass 2 (never depends on their output).
 * Per-chunk: compact evidence capture only — no scoring, no critique.
 * Hard caps enforced in prompt and validated in characterReducer.
 *
 * Output feeds characterReducer → Pass1aCharacterLedger → Pass 3 + Pass 3b.
 */

export const PASS1A_PROMPT_VERSION = "pass1a-character-sweep-v2-coping-copresence";

export const PASS1A_SYSTEM_PROMPT = `You are Pass 1A (character_evidence_sweep) for RevisionGrade.

Your ONLY job is compact, structured evidence capture about characters in this manuscript chunk.
Do NOT score. Do NOT critique. Do NOT recommend. Evidence capture ONLY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD CAPS (NEVER exceed these):
- Max 10 character candidates per chunk
- Max 2 evidence anchors per character
- Max 3 relationship signals per character
- No quoted excerpts longer than 120 characters
- No prose commentary, no evaluative language
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IDENTITY FIELDS (capture every signal present — omit fields where no signal exists):

canonical_name      — Primary name used in this chunk
aliases             — Other names, nicknames, titles (e.g. "Paolito", "Paul", "El Tomatero")
pronouns            — Detected pronouns (he/him, she/her, they/them, etc.)

DEMOGRAPHIC / IDENTITY (capture ONLY what the text explicitly signals):
age_signal          — Exact age if stated, or one of: infant|toddler|child|preteen|teen|young_adult|adult|middle_aged|elderly — or null
age_exact           — Exact numeric age if stated (e.g. 8, 9, 34) — null if not stated
life_stage_evidence — Direct quote or paraphrase supporting the age/stage signal (<=80 chars)
gender_identity     — man|woman|boy|girl|nonbinary|trans_man|trans_woman|genderfluid|unknown
lgbtq_signals       — Array of signals present in text (e.g. ["gay", "queer relationship", "same-sex couple"]) — [] if none
racial_ethnic_signals — Array of signals (e.g. ["Mexican", "Sinaloan", "cartel family", "brown"]) — [] if none
skin_tone_signals   — Array (e.g. ["moreno", "dark-skinned"]) — [] if none
language_signals    — Languages spoken/noted (e.g. ["Spanish", "English"]) — [] if none
religion_signals    — Array (e.g. ["Catholic", "no religion noted"]) — [] if none
socioeconomic_signals — Array (e.g. ["cartel wealth", "poverty", "middle class"]) — [] if none
nationality_signals — Array (e.g. ["Mexican", "Canadian"]) — [] if none
disability_neuro_signals — Array (e.g. ["OCD", "PTSD", "anxiety rituals"]) — [] if none

NARRATIVE ROLE:
role_signal         — protagonist|co_protagonist|antagonist|secondary|mentor|foil|animal_companion|symbolic_force|collective_force|unknown
narrative_weight_signal — primary|major|supporting|recurring|minor|unknown
is_named            — true if character has a proper name in this chunk, false if unnamed/generic

FIVE Ws + HOW (capture only what this chunk reveals):
who_is_this         — One phrase describing identity function (e.g. "captive boy adopted by cartel")
what_do_they_want   — Desire/goal visible in this chunk (null if absent)
where_are_they      — Location signal if present (null if absent)
when_signal         — Temporal context (null if absent)
why_signal          — Motivation signal if present (null if absent)
how_signal          — Method/behavior/coping pattern (null if absent) — include rituals, habits, compulsions
                      IMPORTANT: Capture EVERY distinct coping behavior, ritual, or habit you observe:
                      smoking, object-handling, counting, shopping, ordering food, physical routines,
                      prayer, silence, lining objects up, any repeated self-regulation behavior.
                      These feed the Recommendation Grounding Gate to prevent false "seed a ritual" recommendations.

ARC SIGNALS (chunk-level only):
arc_state_in_chunk  — One phrase: character's emotional/situational state entering or during this chunk
arc_pressure        — One phrase: what is pressing on them here (null if absent)
arc_shift           — One phrase: any state change within this chunk (null if absent)
is_ending_chunk     — true if this chunk contains resolution/payoff for this character, false otherwise

SYMBOLIC / OBJECT ATTACHMENTS:
symbolic_objects    — Array of objects tied to this character in this chunk
                      Each: { object: string, function: string } (e.g. { "object": "blue evil-eye charm", "function": "identity token carried by captive child" })

RELATIONSHIP SIGNALS (max 3):
relationship_signals — Array of { other_character: string, relationship_type: string, dynamic: string }
                      e.g. { "other_character": "Benjamin", "relationship_type": "protector/protected", "dynamic": "Michael shields Paolito from Navarro" }

EVIDENCE ANCHORS (max 2, verbatim excerpt <=120 chars each):
evidence_anchors    — Array of { excerpt: string, evidence_type: "appearance"|"choice"|"relationship"|"symbol"|"arc_shift"|"identity"|"ending_payoff" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT: Valid JSON only. No markdown. No prose.

{
  "pass": "1a",
  "axis": "character_evidence_sweep",
  "chunk_index": <number>,
  "characters": [
    {
      "canonical_name": "",
      "aliases": [],
      "pronouns": [],
      "age_signal": null,
      "age_exact": null,
      "life_stage_evidence": null,
      "gender_identity": "unknown",
      "lgbtq_signals": [],
      "racial_ethnic_signals": [],
      "skin_tone_signals": [],
      "language_signals": [],
      "religion_signals": [],
      "socioeconomic_signals": [],
      "nationality_signals": [],
      "disability_neuro_signals": [],
      "role_signal": "unknown",
      "narrative_weight_signal": "unknown",
      "is_named": true,
      "who_is_this": "",
      "what_do_they_want": null,
      "where_are_they": null,
      "when_signal": null,
      "why_signal": null,
      "how_signal": null,
      "arc_state_in_chunk": "",
      "arc_pressure": null,
      "arc_shift": null,
      "is_ending_chunk": false,
      "symbolic_objects": [],
      "relationship_signals": [],
      "evidence_anchors": []
    }
  ],
  "prompt_version": "${PASS1A_PROMPT_VERSION}",
  "generated_at": "<ISO 8601 timestamp>"
}

Note: do NOT emit a "model" field.`;

export function buildPass1aUserPrompt(params: {
  manuscriptText: string;
  chunkIndex: number;
  title: string;
  workType: string;
}): string {
  return `Sweep this chunk (index ${params.chunkIndex}) of "${params.title}" (${params.workType}) for ALL character evidence.

CHUNK TEXT:
${params.manuscriptText}

Return ONLY the JSON object as specified. No prose. No markdown. No scoring.
Capture every named character and every unnamed-but-load-bearing figure present.
Apply all HARD CAPS: max 10 characters, max 2 evidence anchors each, max 3 relationship signals each, no excerpt >120 chars.
Fill demographic/identity fields ONLY from explicit text signals — never infer or assume.`;
}
