/**
 * Revision Queue Canon Metadata — Phase 5
 *
 * Enriches revision queue items with canon governance attribution:
 *   - Source wave/gate that detected the issue
 *   - Severity justification from canon framework
 *   - Canon risk classification (structural, dialogue, thematic, pacing, authority)
 *   - Cross-reference to Gate 15 findings
 *
 * Deterministic heuristic implementation (no LLM calls).
 * Long-form only (≥25,000 words). Non-blocking post-evaluation layer.
 *
 * This does NOT modify existing revision opportunities — it creates a separate
 * metadata overlay that the workbench can read to display attribution.
 */

import { GATE15_MIN_WORD_COUNT } from './gate15/gate15_1_validator';
import type { Gate15AuditArtifact } from './gate15/gate15_orchestrator';
import type { GoldenSpineArtifact } from './goldenSpine/goldenSpineAudit';
import type { DialogueCanonAuditArtifact } from './dialogueCanon/dialogueCanonAudit';

// ── Types ────────────────────────────────────────────────────────────────

export type CanonRiskCategory =
  | 'structural_integrity'    // Tsunami 1: Waves 1-10
  | 'character_dialogue'      // Tsunami 2: Waves 11-20
  | 'thematic_worldbuilding'  // Tsunami 3: Waves 21-30
  | 'pacing_momentum'         // Tsunami 4: Waves 31-40
  | 'literary_authority'      // Tsunami 5: Waves 41-62
  | 'gate_15_mechanical'      // Gate 15.1 flagged
  | 'gate_15_voice'           // Gate 15.2 flagged
  | 'motif_continuity'        // Golden Spine flagged
  | 'dialogue_canon'          // Dialogue Canon flagged
  | 'uncategorized';

export interface RevisionCanonAttribution {
  criterion: string;
  canonRiskCategory: CanonRiskCategory;
  sourceLayer: string;
  severityJustification: string;
  gate15Related: boolean;
  gate15Check?: string;
  goldenSpineRelated: boolean;
  dialogueCanonRelated: boolean;
}

export interface RevisionCanonMetadata {
  version: 'revision_canon_metadata_v1';
  jobId: string;
  wordCount: number;
  timestamp: string;
  overallStatus: 'complete' | 'skipped';
  skippedBecause?: string;
  activatedBecause?: string;
  attributions: RevisionCanonAttribution[];
  summaryFindings: string[];
}

// ── Criterion → Canon Category Mapping ───────────────────────────────────

const CRITERION_CATEGORY_MAP: Record<string, CanonRiskCategory> = {
  // Structural criteria → Tsunami 1
  'plot_structure': 'structural_integrity',
  'narrative_arc': 'structural_integrity',
  'pacing': 'pacing_momentum',
  'chapter_structure': 'structural_integrity',
  'opening_hook': 'structural_integrity',
  'story_logic': 'structural_integrity',
  'internal_consistency': 'structural_integrity',

  // Character/Dialogue criteria → Tsunami 2
  'character_development': 'character_dialogue',
  'character_consistency': 'character_dialogue',
  'dialogue_quality': 'character_dialogue',
  'character_voice': 'character_dialogue',
  'protagonist_arc': 'character_dialogue',
  'antagonist_depth': 'character_dialogue',
  'relationship_dynamics': 'character_dialogue',

  // Thematic criteria → Tsunami 3
  'theme_execution': 'thematic_worldbuilding',
  'world_building': 'thematic_worldbuilding',
  'setting_atmosphere': 'thematic_worldbuilding',
  'symbolism': 'thematic_worldbuilding',
  'motif_coherence': 'thematic_worldbuilding',

  // Literary Authority criteria → Tsunami 5
  'prose_quality': 'literary_authority',
  'voice_authority': 'literary_authority',
  'show_dont_tell': 'literary_authority',
  'sensory_detail': 'literary_authority',
  'emotional_resonance': 'literary_authority',
  'genre_conventions': 'literary_authority',
  'marketability': 'literary_authority',
};

function getCriterionCategory(criterion: string): CanonRiskCategory {
  const normalized = criterion.toLowerCase().replace(/[^a-z_]/g, '_');
  return CRITERION_CATEGORY_MAP[normalized] || 'uncategorized';
}

function getSourceLayer(category: CanonRiskCategory): string {
  switch (category) {
    case 'structural_integrity': return 'Tsunami 1 (Waves 1-10)';
    case 'character_dialogue': return 'Tsunami 2 (Waves 11-20)';
    case 'thematic_worldbuilding': return 'Tsunami 3 (Waves 21-30)';
    case 'pacing_momentum': return 'Tsunami 4 (Waves 31-40)';
    case 'literary_authority': return 'Tsunami 5 (Waves 41-62)';
    case 'gate_15_mechanical': return 'Gate 15.1 (Mechanical Purity)';
    case 'gate_15_voice': return 'Gate 15.2 (Voice Protection)';
    case 'motif_continuity': return 'Golden Spine (Motif Ledger)';
    case 'dialogue_canon': return 'Dialogue Canon (Wave 13+)';
    default: return 'Evaluation Pipeline';
  }
}

function getSeverityJustification(criterion: string, category: CanonRiskCategory): string {
  if (category === 'structural_integrity') {
    return 'Structural issue identified by foundational analysis layer. May cascade to downstream quality.';
  }
  if (category === 'character_dialogue') {
    return 'Character/dialogue issue detected. Voice differentiation or attribution may need attention.';
  }
  if (category === 'thematic_worldbuilding') {
    return 'Thematic or world-building issue. May affect motif coherence or setting authenticity.';
  }
  if (category === 'pacing_momentum') {
    return 'Pacing or momentum issue. May affect reader engagement or narrative drive.';
  }
  if (category === 'literary_authority') {
    return 'Literary craft issue. Prose quality, voice authority, or genre execution needs attention.';
  }
  return 'Identified during evaluation analysis.';
}

// ── Main Function ────────────────────────────────────────────────────────

export function buildRevisionCanonMetadata(
  criteriaKeys: string[],
  wordCount: number,
  jobId: string,
  gate15?: Gate15AuditArtifact | null,
  goldenSpine?: GoldenSpineArtifact | null,
  dialogueCanon?: DialogueCanonAuditArtifact | null,
): RevisionCanonMetadata {
  const timestamp = new Date().toISOString();

  if (wordCount < GATE15_MIN_WORD_COUNT) {
    return {
      version: 'revision_canon_metadata_v1',
      jobId,
      wordCount,
      timestamp,
      overallStatus: 'skipped',
      skippedBecause: `short_form_under_${GATE15_MIN_WORD_COUNT}_words`,
      attributions: [],
      summaryFindings: [`Revision canon metadata skipped: ${wordCount.toLocaleString()} words (minimum ${GATE15_MIN_WORD_COUNT.toLocaleString()})`],
    };
  }

  // Build Gate 15 cross-reference sets
  const gate15FailedChecks = new Set<string>();
  if (gate15?.gate15_1?.layer1) {
    const l1 = gate15.gate15_1.layer1;
    if (l1.attributionDensity.status === 'FAIL') gate15FailedChecks.add('attribution_density');
    if (l1.softTags.status === 'FAIL') gate15FailedChecks.add('soft_tag_cap');
    if (l1.thoughtVerbs.status === 'FAIL') gate15FailedChecks.add('thought_verb_tolerance');
    if (l1.physiologicalFillers.status === 'FAIL') gate15FailedChecks.add('physiological_filler_cap');
    if (l1.boundaryTest.status === 'FAIL') gate15FailedChecks.add('boundary_test');
  }

  const hasVoiceProtectionIssue = gate15?.gate15_2?.overcorrectionRiskLevel === 'high';
  const hasMotifIssues = (goldenSpine?.motifLedger?.filter(m => m.payoffStatus === 'missing').length ?? 0) > 0;
  const hasDialogueIssues = dialogueCanon?.dialogueStatus !== 'pass';

  const attributions: RevisionCanonAttribution[] = criteriaKeys.map((criterion) => {
    let category = getCriterionCategory(criterion);

    // Cross-reference with Gate 15
    const isDialogueCriterion = ['dialogue_quality', 'character_voice'].includes(criterion.toLowerCase().replace(/[^a-z_]/g, '_'));
    const gate15Related = isDialogueCriterion && gate15FailedChecks.size > 0;
    const gate15Check = gate15Related ? [...gate15FailedChecks].join(', ') : undefined;

    if (isDialogueCriterion && gate15FailedChecks.size > 0) {
      category = 'gate_15_mechanical';
    }
    if (isDialogueCriterion && hasVoiceProtectionIssue) {
      category = 'gate_15_voice';
    }

    const goldenSpineRelated = ['motif_coherence', 'symbolism', 'theme_execution'].includes(criterion.toLowerCase().replace(/[^a-z_]/g, '_')) && hasMotifIssues;
    const dialogueCanonRelated = isDialogueCriterion && (hasDialogueIssues ?? false);

    return {
      criterion,
      canonRiskCategory: category,
      sourceLayer: getSourceLayer(category),
      severityJustification: getSeverityJustification(criterion, category),
      gate15Related,
      gate15Check,
      goldenSpineRelated,
      dialogueCanonRelated,
    };
  });

  const summaryFindings: string[] = [];
  summaryFindings.push(`${attributions.length} criteria enriched with canon metadata`);
  const gate15Count = attributions.filter(a => a.gate15Related).length;
  if (gate15Count > 0) summaryFindings.push(`${gate15Count} criteria cross-referenced with Gate 15 findings`);
  const spineCount = attributions.filter(a => a.goldenSpineRelated).length;
  if (spineCount > 0) summaryFindings.push(`${spineCount} criteria cross-referenced with Golden Spine`);
  const dialogueCount = attributions.filter(a => a.dialogueCanonRelated).length;
  if (dialogueCount > 0) summaryFindings.push(`${dialogueCount} criteria cross-referenced with Dialogue Canon`);

  return {
    version: 'revision_canon_metadata_v1',
    jobId,
    wordCount,
    timestamp,
    overallStatus: 'complete',
    activatedBecause: 'long_form_25000_plus',
    attributions,
    summaryFindings,
  };
}
