/**
 * seedConsistencyReport.ts
 *
 * Post-extraction seed consistency gate.
 *
 * After Phase 1A extracts character evidence, this module compares the
 * extraction results against the seed's entity registry. The seed is treated
 * as baseline authority (95%+ quality from expert-governed pre-analysis).
 *
 * Deviations from the seed are classified as:
 *   - confirmed:        seed entity found in extraction
 *   - missed:           seed entity not found in extraction (potential gap)
 *   - contaminated:     extraction contains pseudo-entities (pronoun/descriptor fragments)
 *   - novel_justified:  new entity not in seed, with evidence anchor
 *   - novel_unjustified: new entity not in seed, without evidence anchor
 *
 * NOTE on 'contradicted' status (removed in U3-002, 2026-07-07):
 * The original design intended to detect same-entity-different-properties
 * contradictions (e.g. seed says protagonist, extraction returns antagonist).
 * However, the call site passes only entity names — no role or property data.
 * Without property data at the call boundary, contradicted can never be
 * emitted. The status was removed rather than left as dead unreachable code.
 * If property-level contradiction detection is needed in the future, it
 * requires extending the call contract to pass seed entity properties
 * alongside names, and should be designed as a new feature at that point.
 *
 * The report is persisted as seed_contradiction_report_v1 for audit trail.
 */

import { isEntityTypingContaminated } from '@/lib/evaluation/phase1a/buildLedgerQualityReport';

export type SeedEntityStatus =
  | 'confirmed'
  | 'missed';

export type ExtractionEntityStatus =
  | 'from_seed'
  | 'novel_justified'
  | 'novel_unjustified'
  | 'contaminated';

export type SeedEntityEntry = {
  seed_entity_name: string;
  status: SeedEntityStatus;
  extraction_match?: string;
  note?: string;
};

export type ExtractionEntityEntry = {
  extracted_name: string;
  status: ExtractionEntityStatus;
  seed_match?: string;
  note?: string;
};

export type SeedConsistencyVerdict =
  | 'consistent'
  | 'minor_drift'
  | 'significant_drift'
  | 'contamination_detected';

export type SeedContradictionReportV1 = {
  artifact_type: 'seed_contradiction_report_v1';
  generated_at: string;
  verdict: SeedConsistencyVerdict;
  seed_entity_count: number;
  extraction_entity_count: number;
  confirmed_count: number;
  missed_count: number;
  contaminated_count: number;
  novel_justified_count: number;
  novel_unjustified_count: number;
  seed_entities: SeedEntityEntry[];
  extraction_entities: ExtractionEntityEntry[];
  drift_ratio: number;
  contamination_ratio: number;
  recommendations: string[];
};

/**
 * Detect abstract or compound seed entities that should be excluded from
 * character-level consistency checks. These are not real characters and
 * produce false-positive "missed" results.
 */
function isAbstractSeedEntity(name: string): boolean {
  const n = name.toLowerCase().trim();
  // Compound entities (e.g. "Protagonist/Christine")
  if (n.includes('/')) return true;
  // Abstract concepts that are not characters
  const abstractPatterns = /^(themes?|narrative\s*structure|setting|plot|conflict|symbolism|tone|mood|style|motif)$/i;
  if (abstractPatterns.test(n)) return true;
  return false;
}

/**
 * Normalize a name for fuzzy matching: lowercase, collapse whitespace,
 * strip common prefixes/suffixes.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two names are a fuzzy match (one contains the other, or they
 * share a significant common substring).
 */
function isFuzzyMatch(seedName: string, extractedName: string): boolean {
  const a = normalizeName(seedName);
  const b = normalizeName(extractedName);

  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Check if any word in the seed name appears in the extracted name
  const seedWords = a.split(' ').filter((w) => w.length > 2);
  const extractedWords = b.split(' ').filter((w) => w.length > 2);
  const matchingWords = seedWords.filter((w) => extractedWords.includes(w));

  return matchingWords.length > 0 && matchingWords.length >= seedWords.length * 0.5;
}

export function buildSeedConsistencyReport(args: {
  seedEntityNames: string[];
  extractedEntityNames: string[];
  generatedAt?: string;
}): SeedContradictionReportV1 {
  const now = args.generatedAt ?? new Date().toISOString();

  // Filter out abstract/compound seed entities that aren't real characters.
  // These produce false-positive "missed" results when compared against the
  // character extraction output.
  const filteredSeedEntityNames = args.seedEntityNames.filter(
    (name) => !isAbstractSeedEntity(name),
  );

  const seedEntities: SeedEntityEntry[] = [];
  const extractionEntities: ExtractionEntityEntry[] = [];
  const matchedExtractions = new Set<string>();

  // Phase 1: Match seed entities against extraction
  for (const seedName of filteredSeedEntityNames) {
    let matched = false;
    for (const extractedName of args.extractedEntityNames) {
      if (matchedExtractions.has(extractedName)) continue;
      if (isFuzzyMatch(seedName, extractedName)) {
        seedEntities.push({
          seed_entity_name: seedName,
          status: 'confirmed',
          extraction_match: extractedName,
        });
        matchedExtractions.add(extractedName);
        matched = true;
        break;
      }
    }

    if (!matched) {
      seedEntities.push({
        seed_entity_name: seedName,
        status: 'missed',
        note: 'Seed entity not found in extraction output.',
      });
    }
  }

  // Phase 2: Classify extraction entities
  for (const extractedName of args.extractedEntityNames) {
    if (isEntityTypingContaminated(extractedName)) {
      extractionEntities.push({
        extracted_name: extractedName,
        status: 'contaminated',
        note: 'Entity-typing contamination: pronoun, descriptor, or placeholder used as entity name.',
      });
    } else if (matchedExtractions.has(extractedName)) {
      extractionEntities.push({
        extracted_name: extractedName,
        status: 'from_seed',
        seed_match: seedEntities.find((s) => s.extraction_match === extractedName)?.seed_entity_name,
      });
    } else {
      // Novel entity — not in seed. Currently we can't check evidence anchors
      // without the full chunk output, so mark as novel_unjustified by default.
      // The quality gate downstream can upgrade to novel_justified if evidence
      // anchors are present in the chunk output.
      extractionEntities.push({
        extracted_name: extractedName,
        status: 'novel_unjustified',
        note: 'Entity not in seed. Requires evidence-justified reason for addition.',
      });
    }
  }

  // Phase 3: Compute metrics
  const confirmedCount = seedEntities.filter((e) => e.status === 'confirmed').length;
  const missedCount = seedEntities.filter((e) => e.status === 'missed').length;
  const contaminatedCount = extractionEntities.filter((e) => e.status === 'contaminated').length;
  const novelJustifiedCount = extractionEntities.filter((e) => e.status === 'novel_justified').length;
  const novelUnjustifiedCount = extractionEntities.filter((e) => e.status === 'novel_unjustified').length;

  const seedCount = filteredSeedEntityNames.length;
  const extractionCount = args.extractedEntityNames.length;

  const driftRatio = seedCount > 0
    ? missedCount / seedCount
    : 0;

  const contaminationRatio = extractionCount > 0
    ? contaminatedCount / extractionCount
    : 0;

  // Phase 4: Determine verdict
  let verdict: SeedConsistencyVerdict;
  if (contaminatedCount > 0) {
    verdict = 'contamination_detected';
  } else if (driftRatio > 0.5) {
    verdict = 'significant_drift';
  } else if (driftRatio > 0.2 || novelUnjustifiedCount > seedCount) {
    verdict = 'minor_drift';
  } else {
    verdict = 'consistent';
  }

  // Phase 5: Generate recommendations
  const recommendations: string[] = [];

  if (contaminatedCount > 0) {
    recommendations.push(
      `CONTAMINATION: ${contaminatedCount} pseudo-entities detected in extraction (pronoun/descriptor fragments). These must be suppressed before downstream processing.`,
    );
  }

  if (missedCount > 0 && seedCount > 0) {
    const missedNames = seedEntities.filter((e) => e.status === 'missed').map((e) => e.seed_entity_name);
    recommendations.push(
      `SEED DRIFT: ${missedCount}/${seedCount} seed entities not found in extraction: ${missedNames.join(', ')}. Phase 1A may have missed these characters.`,
    );
  }

  if (novelUnjustifiedCount > 0) {
    recommendations.push(
      `NOVEL ENTITIES: ${novelUnjustifiedCount} entities in extraction were not in the seed. These require evidence justification.`,
    );
  }

  if (verdict === 'consistent') {
    recommendations.push('Extraction is consistent with seed baseline. No action required.');
  }

  return {
    artifact_type: 'seed_contradiction_report_v1',
    generated_at: now,
    verdict,
    seed_entity_count: seedCount,
    extraction_entity_count: extractionCount,
    confirmed_count: confirmedCount,
    missed_count: missedCount,
    contaminated_count: contaminatedCount,
    novel_justified_count: novelJustifiedCount,
    novel_unjustified_count: novelUnjustifiedCount,
    seed_entities: seedEntities,
    extraction_entities: extractionEntities,
    drift_ratio: Math.round(driftRatio * 1000) / 1000,
    contamination_ratio: Math.round(contaminationRatio * 1000) / 1000,
    recommendations,
  };
}
