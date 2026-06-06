/**
 * Enrichment orchestrator — computes all enrichment surfaces for an evaluation.
 *
 * Algorithmic surfaces (reading grade level, dialogue ratio) are always computed.
 * LLM-extracted surfaces (premise, trigger warnings, diagnosed genre, target
 * audience) are extracted when a synthesis output is available from the pipeline.
 */

import { computeReadingGradeLevel } from "./readingGradeLevel";
import { computeDialogueRatio } from "./dialogueRatio";

export interface EnrichmentResult {
  premise?: string;
  trigger_warnings?: string[];
  diagnosed_genre?: string;
  target_audience?: string;
  reading_grade_level?: number;
  dialogue_percentage?: number;
  narrative_percentage?: number;
}

/**
 * Compute algorithmic enrichment surfaces from raw manuscript text.
 *
 * Semantic enrichment must be provided externally from the synthesis pass.
 */
export function computeEnrichment(
  manuscriptText: string,
  llmExtracted?: {
    premise?: string;
    trigger_warnings?: string[];
    diagnosed_genre?: string;
    target_audience?: string;
  },
): EnrichmentResult {
  const gradeResult = computeReadingGradeLevel(manuscriptText);
  const dialogueResult = computeDialogueRatio(manuscriptText);

  return {
    reading_grade_level: gradeResult.gradeLevel,
    dialogue_percentage: dialogueResult.dialoguePercentage,
    narrative_percentage: dialogueResult.narrativePercentage,
    ...(llmExtracted?.premise ? { premise: llmExtracted.premise } : {}),
    ...(llmExtracted?.trigger_warnings?.length
      ? { trigger_warnings: llmExtracted.trigger_warnings }
      : {}),
    ...(llmExtracted?.diagnosed_genre ? { diagnosed_genre: llmExtracted.diagnosed_genre } : {}),
    ...(llmExtracted?.target_audience ? { target_audience: llmExtracted.target_audience } : {}),
  };
}
