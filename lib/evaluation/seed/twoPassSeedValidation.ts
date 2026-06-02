/**
 * Two-Pass Seed Validation for Phase 1A
 *
 * Architecture:
 *   Pass A (Seed Confirmation): Given the seed entity registry + manuscript chunk,
 *     confirms or denies each seed entity with evidence coordinates. Output: validated
 *     seed entities with status (confirmed / absent_this_chunk / corrected).
 *
 *   Pass B (Novel Extraction): Receives the validated seed entities as a locked baseline
 *     + the same manuscript chunk. Extracts any NEW entities not in the seed, requiring
 *     explicit evidence for each addition.
 *
 * The two-pass approach ensures:
 *   - Seed entities (95%+ quality from DREAM/gold standards) are respected as baseline authority
 *   - The LLM cannot silently drop seed entities in favor of hallucinated pseudo-entities
 *   - Novel entities are additive only and must be evidence-justified
 *   - Entity-typing contamination is structurally prevented
 *
 * Doctrine: "Seeds are baseline authority. Phase 1A confirms, refines, or evidence-justifies deviations."
 */

export type SeedEntityValidationStatus =
  | 'confirmed'         // Seed entity found in this chunk with evidence
  | 'absent_this_chunk' // Seed entity not present in this chunk (acceptable per-chunk)
  | 'corrected'         // Seed entity present but name/role needs evidence-backed correction
  | 'merged';           // Seed entity merged with another (e.g., alias discovered)

export type ValidatedSeedEntity = {
  seed_entity_name: string;
  status: SeedEntityValidationStatus;
  evidence_coordinate: string | null;
  corrected_name: string | null;
  correction_evidence: string | null;
  merged_with: string | null;
};

export type SeedValidationPassAResult = {
  validated_entities: ValidatedSeedEntity[];
  chunk_index: number;
  seed_entities_checked: number;
  confirmed_count: number;
  absent_count: number;
  corrected_count: number;
};

export type NovelEntity = {
  canonical_name: string;
  evidence_coordinate: string;
  justification: string;
};

export type NovelExtractionPassBResult = {
  novel_entities: NovelEntity[];
  chunk_index: number;
};

/**
 * Builds the Pass A (Seed Confirmation) prompt block.
 * This is prepended to the Phase 1A user prompt when seeds are available.
 *
 * Instead of sending seeds as mere context, Pass A instructs the LLM to
 * FIRST validate each seed entity against the chunk before extracting anything new.
 */
export function buildTwoPassSeedBlock(params: {
  seedEntityNames: string[];
  seedClaims: Array<{ claim_id: string; hypothesis: string }>;
  evalClaims: Array<{ claim_id: string; hypothesis: string }>;
}): string {
  if (params.seedEntityNames.length === 0) return '';

  const lines: string[] = [];

  // ── Pass A: Seed Confirmation Instructions ──────────────────────────
  lines.push('═══ TWO-PASS SEED-ANCHORED EXTRACTION PROTOCOL ═══');
  lines.push('');
  lines.push('You MUST follow this two-pass protocol. Do NOT skip to extraction.');
  lines.push('');

  lines.push('── PASS A: SEED CONFIRMATION (do this FIRST) ──');
  lines.push('');
  lines.push('SEED ENTITY REGISTRY (BASELINE AUTHORITY — 95%+ quality from DREAM benchmarks/gold standards):');
  for (const name of params.seedEntityNames) {
    lines.push(`  ★ ${name}`);
  }
  lines.push('');
  lines.push('For EACH seed entity above, determine its status in THIS chunk:');
  lines.push('  • CONFIRMED — entity appears in this chunk. Capture evidence.');
  lines.push('  • ABSENT_THIS_CHUNK — entity does not appear in this chunk. This is acceptable.');
  lines.push('  • CORRECTED — entity appears but under a different name/form. Provide manuscript evidence for the correction.');
  lines.push('');
  lines.push('Include a "seed_validation" array in your response with one entry per seed entity.');
  lines.push('');

  // ── Pass B: Novel Extraction Instructions ───────────────────────────
  lines.push('── PASS B: NOVEL EXTRACTION (do this SECOND) ──');
  lines.push('');
  lines.push('After confirming seed entities, extract any ADDITIONAL characters/forces found in the chunk.');
  lines.push('Requirements for novel entities (NOT in seed):');
  lines.push('  1. Must be named in the text OR clearly load-bearing');
  lines.push('  2. Must include evidence_coordinates proving their existence');
  lines.push('  3. Must NOT be pseudo-entities from pronouns/descriptors');
  lines.push('');

  // ── Seed Claims ─────────────────────────────────────────────────────
  if (params.seedClaims.length > 0 || params.evalClaims.length > 0) {
    lines.push('SEED CLAIMS (expert-governed baseline — confirm or refine against chunk evidence):');
    for (const claim of params.seedClaims) {
      lines.push(`  - [story] ${claim.claim_id}: ${claim.hypothesis}`);
    }
    for (const claim of params.evalClaims) {
      lines.push(`  - [eval] ${claim.claim_id}: ${claim.hypothesis}`);
    }
    lines.push('');
  }

  // ── Enforcement Contract ────────────────────────────────────────────
  lines.push('SEED ENFORCEMENT CONTRACT:');
  lines.push('1. Seed entities are BASELINE AUTHORITY (95%+ quality). Confirm each against this chunk.');
  lines.push('2. If a seed entity is absent from this chunk, mark as ABSENT_THIS_CHUNK. Do NOT replace with a proxy.');
  lines.push('3. Adding a new entity requires EXPLICIT manuscript evidence (evidence_coordinates mandatory).');
  lines.push('4. Correcting a seed entity name/role requires EXPLICIT manuscript evidence justifying the change.');
  lines.push('5. FORBIDDEN pseudo-entities: "Primary He", "She_main_unnamed", "Unknown Character", "central_woman", "He_narrator" — these are entity-typing contamination.');
  lines.push('6. Seed claims may be refined but never silently discarded.');

  return lines.join('\n');
}

/**
 * Parses the seed_validation array from a Phase 1A chunk response.
 * Returns validation results plus a list of confirmed seed entity names
 * that downstream processing should treat as locked baseline.
 */
export function parseSeedValidationFromChunkOutput(
  chunkOutput: Record<string, unknown>,
  seedEntityNames: string[],
): SeedValidationPassAResult & { confirmedSeedNames: string[] } {
  const validationArray = Array.isArray(chunkOutput.seed_validation)
    ? chunkOutput.seed_validation
    : [];

  const chunkIndex = typeof chunkOutput.chunk_index === 'number'
    ? chunkOutput.chunk_index
    : 0;

  const validated: ValidatedSeedEntity[] = [];
  const confirmedNames: string[] = [];
  let confirmedCount = 0;
  let absentCount = 0;
  let correctedCount = 0;

  // Build a lookup from the LLM's validation response
  const validationMap = new Map<string, Record<string, unknown>>();
  for (const entry of validationArray) {
    if (typeof entry === 'object' && entry !== null) {
      const rec = entry as Record<string, unknown>;
      const name = typeof rec.seed_entity_name === 'string'
        ? rec.seed_entity_name.trim().toLowerCase()
        : '';
      if (name) validationMap.set(name, rec);
    }
  }

  for (const seedName of seedEntityNames) {
    const key = seedName.trim().toLowerCase();
    const llmEntry = validationMap.get(key);

    if (!llmEntry) {
      // LLM didn't mention this seed entity — treat as absent_this_chunk
      validated.push({
        seed_entity_name: seedName,
        status: 'absent_this_chunk',
        evidence_coordinate: null,
        corrected_name: null,
        correction_evidence: null,
        merged_with: null,
      });
      absentCount++;
      continue;
    }

    const status = typeof llmEntry.status === 'string'
      ? llmEntry.status.toLowerCase().trim()
      : 'absent_this_chunk';

    if (status === 'confirmed') {
      confirmedCount++;
      confirmedNames.push(seedName);
      validated.push({
        seed_entity_name: seedName,
        status: 'confirmed',
        evidence_coordinate: typeof llmEntry.evidence_coordinate === 'string'
          ? llmEntry.evidence_coordinate : null,
        corrected_name: null,
        correction_evidence: null,
        merged_with: null,
      });
    } else if (status === 'corrected') {
      correctedCount++;
      const correctedName = typeof llmEntry.corrected_name === 'string'
        ? llmEntry.corrected_name : null;
      if (correctedName) confirmedNames.push(correctedName);
      validated.push({
        seed_entity_name: seedName,
        status: 'corrected',
        evidence_coordinate: typeof llmEntry.evidence_coordinate === 'string'
          ? llmEntry.evidence_coordinate : null,
        corrected_name: correctedName,
        correction_evidence: typeof llmEntry.correction_evidence === 'string'
          ? llmEntry.correction_evidence : null,
        merged_with: typeof llmEntry.merged_with === 'string'
          ? llmEntry.merged_with : null,
      });
    } else if (status === 'merged') {
      confirmedCount++;
      const mergedWith = typeof llmEntry.merged_with === 'string'
        ? llmEntry.merged_with : null;
      if (mergedWith) confirmedNames.push(mergedWith);
      validated.push({
        seed_entity_name: seedName,
        status: 'merged',
        evidence_coordinate: typeof llmEntry.evidence_coordinate === 'string'
          ? llmEntry.evidence_coordinate : null,
        corrected_name: null,
        correction_evidence: null,
        merged_with: mergedWith,
      });
    } else {
      absentCount++;
      validated.push({
        seed_entity_name: seedName,
        status: 'absent_this_chunk',
        evidence_coordinate: null,
        corrected_name: null,
        correction_evidence: null,
        merged_with: null,
      });
    }
  }

  return {
    validated_entities: validated,
    chunk_index: chunkIndex,
    seed_entities_checked: seedEntityNames.length,
    confirmed_count: confirmedCount,
    absent_count: absentCount,
    corrected_count: correctedCount,
    confirmedSeedNames: confirmedNames,
  };
}

// ── Entity contamination constants ────────────────────────────────────
const CONTAMINATION_PATTERNS = [
  /^(primary|secondary|tertiary|central|main)\s+(he|she|they|it|one|figure|person|character|woman|man|narrator)/i,
  /^(he|she|they|it)[\s_]+(main|primary|narrator|central|unnamed)/i,
  /^unknown\s+(character|person|figure|entity|narrator)/i,
  // Match pseudo-entity labels like "character_1", "entity 3", "person_2" but NOT bare
  // "narrator" — first-person narrator is a legitimate canonical name.
  /^(character|person|figure|entity)\s*[_\s]?\d*$/i,
  /^narrator\s*[_\s]+\d+$/i,
  /^(the|a|an)\s+(woman|man|girl|boy|child|figure|speaker)/i,
  /^[A-Z][a-z]*_main_unnamed/,
];

/**
 * Deterministic entity contamination filter.
 * Runs on extraction output BEFORE it enters downstream processing.
 * Rejects pseudo-entities generated from pronouns/descriptors.
 */
export function isEntityContaminated(name: string): boolean {
  if (!name || name.trim().length === 0) return true;
  const normalized = name.trim();
  return CONTAMINATION_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Filters contaminated entities from a character array.
 * Returns the clean array plus a list of rejected names for audit trail.
 *
 * Entries with role_signal protagonist/co_protagonist or pov_signal pov_owner
 * are exempt from contamination filtering — the LLM explicitly identified
 * them as narratively significant (e.g., unnamed first-person narrators).
 */
export function filterContaminatedEntities<T extends { canonical_name: string }>(
  characters: T[],
): { clean: T[]; rejected: Array<{ name: string; reason: string }> } {
  const clean: T[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];

  for (const char of characters) {
    const rec = char as Record<string, unknown>;
    const roleSignal = typeof rec.role_signal === 'string' ? rec.role_signal : '';
    const povSignal = typeof rec.pov_signal === 'string' ? rec.pov_signal : '';
    const isProtagonistOrPov =
      roleSignal === 'protagonist' ||
      roleSignal === 'co_protagonist' ||
      povSignal === 'pov_owner';

    if (!isProtagonistOrPov && isEntityContaminated(char.canonical_name)) {
      rejected.push({
        name: char.canonical_name,
        reason: 'entity_typing_contamination',
      });
    } else {
      clean.push(char);
    }
  }

  return { clean, rejected };
}

/**
 * Aggregate seed validation results across all chunks to detect drift.
 * If >50% of seed entities are never confirmed across ANY chunk AND contaminated
 * entities appear, this signals the extraction degraded from the seed baseline.
 */
export function computeSeedDriftScore(params: {
  seedEntityNames: string[];
  allChunkValidations: SeedValidationPassAResult[];
  contaminatedCount: number;
}): {
  drift_score: number;
  never_confirmed: string[];
  should_requeue: boolean;
  summary: string;
} {
  const { seedEntityNames, allChunkValidations, contaminatedCount } = params;
  if (seedEntityNames.length === 0) {
    return { drift_score: 0, never_confirmed: [], should_requeue: false, summary: 'No seed entities to validate.' };
  }

  // Track which seed entities were confirmed in at least one chunk
  const confirmedAtLeastOnce = new Set<string>();
  for (const validation of allChunkValidations) {
    for (const entity of validation.validated_entities) {
      if (entity.status === 'confirmed' || entity.status === 'corrected' || entity.status === 'merged') {
        confirmedAtLeastOnce.add(entity.seed_entity_name.toLowerCase());
      }
    }
  }

  const neverConfirmed = seedEntityNames.filter(
    name => !confirmedAtLeastOnce.has(name.toLowerCase()),
  );

  const driftScore = neverConfirmed.length / seedEntityNames.length;

  // Requeue threshold: >50% of seed entities never confirmed AND contamination present
  const shouldRequeue = driftScore > 0.5 && contaminatedCount > 0;

  const summary = `Seed drift: ${neverConfirmed.length}/${seedEntityNames.length} seed entities never confirmed across ${allChunkValidations.length} chunks. Contaminated entities: ${contaminatedCount}. Drift score: ${(driftScore * 100).toFixed(1)}%.${shouldRequeue ? ' REQUEUE RECOMMENDED.' : ''}`;

  return {
    drift_score: driftScore,
    never_confirmed: neverConfirmed,
    should_requeue: shouldRequeue,
    summary,
  };
}
