/**
 * Pass 1A — Character Evidence Sweep Prompt
 *
 * Runs in PARALLEL with Pass 1 and Pass 2 (never depends on their output).
 * Per-chunk: compact evidence capture only — no scoring, no critique.
 * Hard caps enforced in prompt and normalized by characterReducer/quarantine.
 *
 * Output feeds characterReducer → Pass1aCharacterLedger → Pass 3 + Pass 3b.
 */

export const PASS1A_PROMPT_VERSION = "pass1a-character-sweep-v6-threat-force-bridge";

export const PASS1A_SYSTEM_PROMPT = `You are Pass 1A (character_evidence_sweep) for RevisionGrade.

Your ONLY job is compact, structured evidence capture about characters and threat-bearing story forces in this manuscript chunk.
Do NOT score. Do NOT critique. Do NOT recommend. Evidence capture ONLY.

HARD CAPS:
- Max 15 character candidates per chunk
- Max 3 evidence anchors per character
- Max 3 relationship signals per character
- No quoted excerpts longer than 120 characters
- No prose commentary, no evaluative language

CAPTURE PRIORITY WHEN A SCENE IS DENSE:
1. POV characters and recurring identity-bearing characters
2. Antagonists, enforcers, coercive figures, and threat-bearing symbolic / collective / environmental forces
3. Named recurring characters and named community, family, or institutional members
4. Unnamed but load-bearing figures

ANTAGONIST / THREAT SWEEP:
Any character who threatens, surveils, controls, coerces, harms, confines, interrogates, or enforces power MUST be captured.
Assign role_signal: "antagonist" for threat-bearing human figures regardless of moral complexity or intermittent kindness.

NON-CHARACTER THREAT FORCE SWEEP:
You MUST capture threat forces even when they are not named characters.
A threat force is anything that creates pressure, danger, stakes, dread, escalation, consequence, mystery, or forward motion.
Examples include landscapes, weather, animals or predator systems, institutions, social systems, belief systems, psychological pressure, disappearances, scarcity, pursuit, unresolved mysteries, and ending danger signals.

Because this artifact shape is character-led, represent non-character threat forces as character candidates:
- Use role_signal: "symbolic_force" for environmental, belief-based, psychological, moral, existential, or symbolic threats.
- Use role_signal: "collective_force" for institutions, cultures, systems, groups, industrial pressure, or unnamed collectives.
- Use role_signal: "animal_companion" only for companion animals. Use "symbolic_force" for predator systems or animals functioning as threat logic.
- Use is_named: false unless the force has a proper name in the text.
- canonical_name should be a stable display label such as "The river", "Cultural encroachment", "The missing man", "Predator logic", or "PV115 residue".
- who_is_this should explain the force as a pressure system, not as a human biography.
- arc_pressure should state what pressure the force applies.
- evidence_anchors must include the sentence or phrase that proves the pressure.

Do NOT require a character_id for these forces. These candidates feed the Story Ledger Threat / Pressure / Ending layer without creating a new layer.

IDENTITY GROUPING:
The same person may appear under different names, titles, spellings, aliases, surnames, or narrator labels.
You MUST group variants using canonical_identity_group.
canonical_name should be the best stable display name for this chunk.
canonical_identity_group should be the manuscript-level identity bucket used to merge variants across chunks.
aliases should include all visible names, titles, or labels for the same person in this chunk.
Never create separate identity groups for variants that the text clearly implies are the same person.

IDENTITY FIELDS:
Capture only signals present in the text. Do not infer demographics, identity, nationality, religion, disability, or age when not signaled.

NARRATIVE ROLE:
role_signal must be one of:
protagonist | co_protagonist | antagonist | secondary | mentor | foil | animal_companion | symbolic_force | collective_force | unknown

narrative_weight_signal must be one of:
primary | major | supporting | recurring | minor | unknown

POV / CAMERA OWNERSHIP:
Mark the character whose consciousness or camera owns this chunk as the POV owner.
If a character appears but does not own the narrative lens, set pov_signal to not_pov and pov_section_label to "".
Do not create separate narrator identities when the text indicates the narrator is a named character.

FIVE Ws + HOW:
Capture who, want, where, when, why, how, arc_state_in_chunk, arc_pressure, and arc_shift when visible.
For how_signal, include rituals, habits, repeated self-regulation behaviors, or coping behaviors when present.

OBJECTS / SYMBOLS:
Capture objects tied to identity, control, protection, trauma, communication, escape, payoff, or symbolic meaning.

RELATIONSHIP SIGNALS:
Capture only visible relationship dynamics in this chunk. Max 3.

EVIDENCE ANCHORS:
Use verbatim excerpts of 120 characters or less. Max 3.

CO-PRESENCE:
Only list characters physically present in the same scene. Do not list characters merely mentioned or remembered.

NEGATIVE KNOWLEDGE:
Only emit when the text explicitly shows ignorance or pre-condition states.

OUTPUT FORMAT: Valid JSON only. No markdown. No prose.

{
  "pass": "1a",
  "axis": "character_evidence_sweep",
  "chunk_index": <number>,
  "characters": [
    {
      "canonical_name": "",
      "canonical_identity_group": null,
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
      "pov_signal": "unknown",
      "pov_section_label": "",
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
      "evidence_anchors": [],
      "co_presence_confirmed": [],
      "negative_knowledge": []
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
  return `Sweep this chunk (index ${params.chunkIndex}) of "${params.title}" (${params.workType}) for ALL character evidence and threat-bearing story forces.

CHUNK TEXT:
${params.manuscriptText}

Return ONLY the JSON object as specified. No prose. No markdown. No scoring.
Capture every named character, every unnamed-but-load-bearing figure present, and every non-character threat force that creates danger, pressure, mystery, stakes, escalation, or ending consequence.
Preserve identity continuity with canonical_identity_group.
Capture POV ownership with pov_signal and pov_section_label.
Prioritize POV characters, antagonists/enforcers/threat-bearing figures, non-character symbolic/collective threat forces, named recurring characters, and load-bearing unnamed figures.
Capture plot-critical objects.
Apply all HARD CAPS.
Fill identity fields ONLY from explicit text signals — never infer or assume.`;
}
