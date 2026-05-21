/**
 * Pass 1A AI-Output Quarantine Layer
 *
 * Sits between raw Pass 1A model output and characterReducer.ts.
 * Principle: strict at entry, forgiving in reduction, visible in diagnostics.
 *
 * Policy:
 *   malformed field        → coerce and log
 *   malformed nested item  → drop that item, keep character entry
 *   malformed character    → drop that entry, keep chunk
 *   malformed chunk        → keep remaining chunks, job continues
 *
 * Never throws. Every defect is logged with a diagnostic code.
 */

import type {
  Pass1aChunkOutput,
  Pass1aCharacterChunkEntry,
  Pass1aAgeSignal,
  Pass1aGenderIdentity,
  Pass1aRoleSignal,
  Pass1aNarrativeWeightSignal,
  Pass1aEvidenceType,
  EvidenceConfidence,
} from "./types";

// ── Diagnostic types ──────────────────────────────────────────────────────

export type Pass1aQuarantineAction =
  | "coerced"        // value was malformed but usable — converted
  | "dropped"        // value was present but unusable — discarded
  | "defaulted"      // field was missing/unusable — replaced with safe default
  | "entry_dropped"; // entire character entry was too corrupt to salvage

export type Pass1aQuarantineDiagnosticCode =
  | "PASS1A_MALFORMED_STRING_COERCED"
  | "PASS1A_MALFORMED_STRING_DROPPED"
  | "PASS1A_MALFORMED_ARRAY_DEFAULTED"
  | "PASS1A_MALFORMED_BOOLEAN_DEFAULTED"
  | "PASS1A_MALFORMED_ENUM_DEFAULTED"
  | "PASS1A_MALFORMED_NUMBER_DROPPED"
  | "PASS1A_MALFORMED_NESTED_ITEM_DROPPED"
  | "PASS1A_MALFORMED_CHARACTER_DROPPED"
  | "PASS1A_MALFORMED_CHUNK_DROPPED";

export interface Pass1aQuarantineDiagnostic {
  code: Pass1aQuarantineDiagnosticCode;
  action: Pass1aQuarantineAction;
  chunk_index: number;
  character_name?: string;
  field_path: string;
  observed_type: string;
  normalized_preview?: string;
}

export interface Pass1aQuarantineSummary {
  chunks_received: number;
  chunks_returned: number;
  characters_received: number;
  characters_returned: number;
  diagnostics_count: number;
  coerced_count: number;
  dropped_count: number;
}

export interface Pass1aQuarantineResult {
  chunkOutputs: Pass1aChunkOutput[];
  diagnostics: Pass1aQuarantineDiagnostic[];
  summary: Pass1aQuarantineSummary;
}

// ── Valid enum sets — used for safe enum coercion ─────────────────────────

const VALID_AGE_SIGNALS = new Set<string>([
  "infant", "toddler", "child", "preteen", "teen",
  "young_adult", "adult", "middle_aged", "elderly",
]);

const VALID_GENDER_IDENTITIES = new Set<string>([
  "man", "woman", "boy", "girl",
  "nonbinary", "trans_man", "trans_woman", "genderfluid",
  "unknown",
]);

const VALID_ROLE_SIGNALS = new Set<string>([
  "protagonist", "co_protagonist", "antagonist", "secondary",
  "mentor", "foil", "animal_companion", "symbolic_force",
  "collective_force", "unknown",
]);

const VALID_NARRATIVE_WEIGHTS = new Set<string>([
  "primary", "major", "supporting", "recurring", "minor", "unknown",
]);

const VALID_EVIDENCE_TYPES = new Set<string>([
  "appearance", "choice", "relationship", "symbol",
  "arc_shift", "identity", "ending_payoff",
]);

const VALID_EVIDENCE_CONFIDENCE = new Set<string>([
  "explicit", "strong_inference", "weak_inference",
]);

const ENUM_ALIASES: Record<string, string> = {
  "young adult": "young_adult",
  "middle aged": "middle_aged",
  "co protagonist": "co_protagonist",
  "co-protagonist": "co_protagonist",
  "animal companion": "animal_companion",
  "symbolic force": "symbolic_force",
  "collective force": "collective_force",
  "strong inference": "strong_inference",
  "weak inference": "weak_inference",
  "ending payoff": "ending_payoff",
};

// ── Core normalization primitives ─────────────────────────────────────────

function observedType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function recordDiagnostic(
  diagnostics: Pass1aQuarantineDiagnostic[],
  diagnostic: Pass1aQuarantineDiagnostic,
): void {
  diagnostics.push(diagnostic);
}

function normalizeEnumToken(value: unknown): string | null {
  const text = normalizeAiString(value);
  if (!text) return null;
  const normalized = text.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ENUM_ALIASES[text.trim().toLowerCase()] ?? normalized;
}

/**
 * Safely coerce any LLM-emitted value to a trimmed string or null.
 * Handles strings, arrays, objects, primitives, and nested structures.
 */
export function normalizeAiString(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeAiString(item))
      .filter((s): s is string => Boolean(s))
      .join("; ");
    return joined.length > 0 ? joined : null;
  }

  if (typeof value === "object") {
    const r = value as Record<string, unknown>;
    const preferred =
      normalizeAiString(r.description) ??
      normalizeAiString(r.signal) ??
      normalizeAiString(r.value) ??
      normalizeAiString(r.text) ??
      normalizeAiString(r.mechanism) ??
      normalizeAiString(r.summary) ??
      normalizeAiString(r.note) ??
      normalizeAiString(r.label) ??
      normalizeAiString(r.name);
    if (preferred) return preferred;

    const flat = Object.values(r)
      .map((item) => normalizeAiString(item))
      .filter((s): s is string => Boolean(s))
      .join("; ");
    return flat.length > 0 ? flat : null;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

// ── Field-level normalizers with diagnostic emission ─────────────────────

function normStr(
  value: unknown,
  fieldPath: string,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
  opts: { required?: boolean; fallback?: string; characterName?: string } = {},
): string | null {
  const normalized = normalizeAiString(value);

  if (normalized !== null) {
    if (typeof value !== "string") {
      recordDiagnostic(diagnostics, {
        code: "PASS1A_MALFORMED_STRING_COERCED",
        action: "coerced",
        chunk_index: chunkIndex,
        character_name: opts.characterName,
        field_path: fieldPath,
        observed_type: observedType(value),
        normalized_preview: normalized.slice(0, 120),
      });
    }
    return normalized;
  }

  if (opts.required) {
    const fallback = opts.fallback ?? "";
    if (value !== null && value !== undefined) {
      recordDiagnostic(diagnostics, {
        code: "PASS1A_MALFORMED_STRING_COERCED",
        action: "defaulted",
        chunk_index: chunkIndex,
        character_name: opts.characterName,
        field_path: fieldPath,
        observed_type: observedType(value),
        normalized_preview: `[defaulted to: "${fallback}"]`,
      });
    }
    return fallback;
  }

  if (value !== null && value !== undefined && value !== "") {
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_STRING_DROPPED",
      action: "dropped",
      chunk_index: chunkIndex,
      character_name: opts.characterName,
      field_path: fieldPath,
      observed_type: observedType(value),
    });
  }

  return null;
}

function normStrArray(
  value: unknown,
  fieldPath: string,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
  characterName?: string,
): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAiString(item))
      .filter((s): s is string => Boolean(s));
  }

  if (value !== null && value !== undefined) {
    const coerced = normalizeAiString(value);
    if (coerced) {
      recordDiagnostic(diagnostics, {
        code: "PASS1A_MALFORMED_ARRAY_DEFAULTED",
        action: "coerced",
        chunk_index: chunkIndex,
        character_name: characterName,
        field_path: fieldPath,
        observed_type: observedType(value),
        normalized_preview: coerced.slice(0, 120),
      });
      return [coerced];
    }
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_ARRAY_DEFAULTED",
      action: "defaulted",
      chunk_index: chunkIndex,
      character_name: characterName,
      field_path: fieldPath,
      observed_type: observedType(value),
    });
  }

  return [];
}

function normBool(
  value: unknown,
  fieldPath: string,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
  opts: { fallback?: boolean; characterName?: string } = {},
): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const l = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(l)) return true;
    if (["false", "no", "0"].includes(l)) return false;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;

  if (value !== null && value !== undefined) {
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_BOOLEAN_DEFAULTED",
      action: "defaulted",
      chunk_index: chunkIndex,
      character_name: opts.characterName,
      field_path: fieldPath,
      observed_type: observedType(value),
    });
  }

  return opts.fallback ?? false;
}

function normEnum<T extends string | null>(
  value: unknown,
  validSet: Set<string>,
  fallback: T,
  fieldPath: string,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
  characterName?: string,
): T {
  const token = normalizeEnumToken(value);
  if (token && validSet.has(token)) return token as T;

  if (value !== null && value !== undefined && value !== fallback) {
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_ENUM_DEFAULTED",
      action: "defaulted",
      chunk_index: chunkIndex,
      character_name: characterName,
      field_path: fieldPath,
      observed_type: observedType(value),
      normalized_preview: fallback === null ? "null" : String(fallback),
    });
  }

  return fallback;
}

function normNumber(
  value: unknown,
  fieldPath: string,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
  characterName?: string,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      recordDiagnostic(diagnostics, {
        code: "PASS1A_MALFORMED_STRING_COERCED",
        action: "coerced",
        chunk_index: chunkIndex,
        character_name: characterName,
        field_path: fieldPath,
        observed_type: "string",
        normalized_preview: String(parsed),
      });
      return parsed;
    }
  }

  if (value !== null && value !== undefined) {
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_NUMBER_DROPPED",
      action: "dropped",
      chunk_index: chunkIndex,
      character_name: characterName,
      field_path: fieldPath,
      observed_type: observedType(value),
    });
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ── Character entry normalizer ────────────────────────────────────────────

function normalizeCharacterEntry(
  raw: unknown,
  chunkIndex: number,
  diagnostics: Pass1aQuarantineDiagnostic[],
): Pass1aCharacterChunkEntry | null {
  if (!isRecord(raw)) {
    recordDiagnostic(diagnostics, {
      code: "PASS1A_MALFORMED_CHARACTER_DROPPED",
      action: "entry_dropped",
      chunk_index: chunkIndex,
      field_path: "characters[]",
      observed_type: observedType(raw),
    });
    return null;
  }

  const r = { ...raw };

  const rawName = normStr(r.canonical_name, "canonical_name", chunkIndex, diagnostics, {
    required: true,
    fallback: "__UNKNOWN__",
  });
  if (!rawName || rawName === "__UNKNOWN__") {
    const anyName = normalizeAiString(r.name ?? r.character_name ?? r.character ?? r.id);
    if (!anyName) {
      recordDiagnostic(diagnostics, {
        code: "PASS1A_MALFORMED_CHARACTER_DROPPED",
        action: "entry_dropped",
        chunk_index: chunkIndex,
        field_path: "characters[].canonical_name",
        observed_type: observedType(r.canonical_name),
      });
      return null;
    }
    r.canonical_name = anyName;
  }

  const name = normStr(r.canonical_name, "canonical_name", chunkIndex, diagnostics, {
    required: true,
    fallback: "Unknown Character",
  })!;

  const ctx = { characterName: name };

  const evidence_anchors = (Array.isArray(r.evidence_anchors) ? r.evidence_anchors : [])
    .map((anchor, index) => {
      if (!isRecord(anchor)) {
        recordDiagnostic(diagnostics, {
          code: "PASS1A_MALFORMED_NESTED_ITEM_DROPPED",
          action: "dropped",
          chunk_index: chunkIndex,
          character_name: name,
          field_path: `evidence_anchors[${index}]`,
          observed_type: observedType(anchor),
        });
        return null;
      }

      const excerpt = normalizeAiString(anchor.excerpt) ?? "";
      if (excerpt.length === 0) return null;

      return {
        excerpt: excerpt.slice(0, 200),
        evidence_type: normEnum<Pass1aEvidenceType>(
          anchor.evidence_type,
          VALID_EVIDENCE_TYPES,
          "identity",
          `evidence_anchors[${index}].evidence_type`,
          chunkIndex,
          diagnostics,
          name,
        ),
        ...(VALID_EVIDENCE_CONFIDENCE.has(normalizeEnumToken(anchor.confidence) ?? "")
          ? { confidence: normalizeEnumToken(anchor.confidence) as EvidenceConfidence }
          : {}),
      };
    })
    .filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null);

  const relationship_signals = (Array.isArray(r.relationship_signals) ? r.relationship_signals : [])
    .map((rel, index) => {
      if (!isRecord(rel)) {
        recordDiagnostic(diagnostics, {
          code: "PASS1A_MALFORMED_NESTED_ITEM_DROPPED",
          action: "dropped",
          chunk_index: chunkIndex,
          character_name: name,
          field_path: `relationship_signals[${index}]`,
          observed_type: observedType(rel),
        });
        return null;
      }

      const other = normalizeAiString(rel.other_character);
      if (!other) return null;

      return {
        other_character: other,
        relationship_type: normalizeAiString(rel.relationship_type) ?? "unknown",
        dynamic: normalizeAiString(rel.dynamic) ?? "",
      };
    })
    .filter((rel): rel is NonNullable<typeof rel> => rel !== null);

  const symbolic_objects = (Array.isArray(r.symbolic_objects) ? r.symbolic_objects : [])
    .map((sym, index) => {
      if (!isRecord(sym)) {
        recordDiagnostic(diagnostics, {
          code: "PASS1A_MALFORMED_NESTED_ITEM_DROPPED",
          action: "dropped",
          chunk_index: chunkIndex,
          character_name: name,
          field_path: `symbolic_objects[${index}]`,
          observed_type: observedType(sym),
        });
        return null;
      }

      const object = normalizeAiString(sym.object);
      const fn = normalizeAiString(sym.function);
      if (!object && !fn) return null;

      return {
        object: object ?? "unknown object",
        function: fn ?? "",
      };
    })
    .filter((sym): sym is NonNullable<typeof sym> => sym !== null);

  const negative_knowledge = (Array.isArray(r.negative_knowledge) ? r.negative_knowledge : [])
    .map((item, index) => {
      if (!isRecord(item)) {
        recordDiagnostic(diagnostics, {
          code: "PASS1A_MALFORMED_NESTED_ITEM_DROPPED",
          action: "dropped",
          chunk_index: chunkIndex,
          character_name: name,
          field_path: `negative_knowledge[${index}]`,
          observed_type: observedType(item),
        });
        return null;
      }

      const does_not_yet_know = normStrArray(
        item.does_not_yet_know,
        "negative_knowledge.does_not_yet_know",
        chunkIndex,
        diagnostics,
        name,
      );
      if (does_not_yet_know.length === 0) return null;

      return {
        character: normalizeAiString(item.character) ?? name,
        does_not_yet_know,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    canonical_name: name,
    aliases: normStrArray(r.aliases, "aliases", chunkIndex, diagnostics, name),
    pronouns: normStrArray(r.pronouns, "pronouns", chunkIndex, diagnostics, name),
    age_signal: normEnum<Pass1aAgeSignal>(r.age_signal, VALID_AGE_SIGNALS, null, "age_signal", chunkIndex, diagnostics, name),
    age_exact: normNumber(r.age_exact, "age_exact", chunkIndex, diagnostics, name),
    life_stage_evidence: normStr(r.life_stage_evidence, "life_stage_evidence", chunkIndex, diagnostics, ctx),
    gender_identity: normEnum<Pass1aGenderIdentity>(r.gender_identity, VALID_GENDER_IDENTITIES, "unknown", "gender_identity", chunkIndex, diagnostics, name),
    lgbtq_signals: normStrArray(r.lgbtq_signals, "lgbtq_signals", chunkIndex, diagnostics, name),
    racial_ethnic_signals: normStrArray(r.racial_ethnic_signals, "racial_ethnic_signals", chunkIndex, diagnostics, name),
    skin_tone_signals: normStrArray(r.skin_tone_signals, "skin_tone_signals", chunkIndex, diagnostics, name),
    language_signals: normStrArray(r.language_signals, "language_signals", chunkIndex, diagnostics, name),
    religion_signals: normStrArray(r.religion_signals, "religion_signals", chunkIndex, diagnostics, name),
    socioeconomic_signals: normStrArray(r.socioeconomic_signals, "socioeconomic_signals", chunkIndex, diagnostics, name),
    nationality_signals: normStrArray(r.nationality_signals, "nationality_signals", chunkIndex, diagnostics, name),
    disability_neuro_signals: normStrArray(r.disability_neuro_signals, "disability_neuro_signals", chunkIndex, diagnostics, name),
    role_signal: normEnum<Pass1aRoleSignal>(r.role_signal, VALID_ROLE_SIGNALS, "unknown", "role_signal", chunkIndex, diagnostics, name),
    narrative_weight_signal: normEnum<Pass1aNarrativeWeightSignal>(r.narrative_weight_signal, VALID_NARRATIVE_WEIGHTS, "unknown", "narrative_weight_signal", chunkIndex, diagnostics, name),
    is_named: normBool(r.is_named, "is_named", chunkIndex, diagnostics, ctx),
    who_is_this: normStr(r.who_is_this, "who_is_this", chunkIndex, diagnostics, { ...ctx, required: true, fallback: "" })!,
    what_do_they_want: normStr(r.what_do_they_want, "what_do_they_want", chunkIndex, diagnostics, ctx),
    where_are_they: normStr(r.where_are_they, "where_are_they", chunkIndex, diagnostics, ctx),
    when_signal: normStr(r.when_signal, "when_signal", chunkIndex, diagnostics, ctx),
    why_signal: normStr(r.why_signal, "why_signal", chunkIndex, diagnostics, ctx),
    how_signal: normStr(r.how_signal, "how_signal", chunkIndex, diagnostics, ctx),
    arc_state_in_chunk: normStr(r.arc_state_in_chunk, "arc_state_in_chunk", chunkIndex, diagnostics, { ...ctx, required: true, fallback: "" })!,
    arc_pressure: normStr(r.arc_pressure, "arc_pressure", chunkIndex, diagnostics, ctx),
    arc_shift: normStr(r.arc_shift, "arc_shift", chunkIndex, diagnostics, ctx),
    is_ending_chunk: normBool(r.is_ending_chunk, "is_ending_chunk", chunkIndex, diagnostics, ctx),
    symbolic_objects,
    relationship_signals,
    evidence_anchors,
    co_presence_confirmed: normStrArray(r.co_presence_confirmed, "co_presence_confirmed", chunkIndex, diagnostics, name),
    negative_knowledge,
  };
}

// ── Main quarantine function ──────────────────────────────────────────────

/**
 * Run all Pass 1A chunk outputs through the quarantine normalizer.
 * Returns sanitized outputs + full diagnostics + summary counts.
 * Never throws.
 */
export function quarantinePass1aChunkOutputs(
  rawChunkOutputs: Pass1aChunkOutput[],
): Pass1aQuarantineResult {
  const diagnostics: Pass1aQuarantineDiagnostic[] = [];
  const safeRawChunks = Array.isArray(rawChunkOutputs) ? rawChunkOutputs : [];
  let charactersReceived = 0;
  let charactersReturned = 0;

  const chunkOutputs = safeRawChunks
    .map((chunk, fallbackIndex) => {
      if (!isRecord(chunk)) {
        recordDiagnostic(diagnostics, {
          code: "PASS1A_MALFORMED_CHUNK_DROPPED",
          action: "dropped",
          chunk_index: fallbackIndex,
          field_path: "chunk",
          observed_type: observedType(chunk),
        });
        return null;
      }

      const chunkIndex = typeof chunk.chunk_index === "number" && Number.isFinite(chunk.chunk_index)
        ? chunk.chunk_index
        : fallbackIndex;
      const rawChars = Array.isArray(chunk.characters) ? chunk.characters : [];
      charactersReceived += rawChars.length;

      const normalizedCharacters = rawChars
        .map((entry) => normalizeCharacterEntry(entry, chunkIndex, diagnostics))
        .filter((entry): entry is Pass1aCharacterChunkEntry => entry !== null);

      charactersReturned += normalizedCharacters.length;

      return {
        ...chunk,
        pass: "1a" as const,
        axis: "character_evidence_sweep" as const,
        chunk_index: chunkIndex,
        characters: normalizedCharacters,
        prompt_version: normalizeAiString(chunk.prompt_version) ?? "pass1a_quarantined_unknown",
        generated_at: normalizeAiString(chunk.generated_at) ?? new Date().toISOString(),
      } satisfies Pass1aChunkOutput;
    })
    .filter((chunk): chunk is Pass1aChunkOutput => chunk !== null);

  const summary: Pass1aQuarantineSummary = {
    chunks_received: safeRawChunks.length,
    chunks_returned: chunkOutputs.length,
    characters_received: charactersReceived,
    characters_returned: charactersReturned,
    diagnostics_count: diagnostics.length,
    coerced_count: diagnostics.filter((d) => d.action === "coerced").length,
    dropped_count: diagnostics.filter(
      (d) => d.action === "dropped" || d.action === "entry_dropped"
    ).length,
  };

  return { chunkOutputs, diagnostics, summary };
}
