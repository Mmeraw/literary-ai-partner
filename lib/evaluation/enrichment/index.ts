/**
 * Enrichment surfaces — low-cost features that add value to evaluation reports.
 *
 * Two categories:
 * 1. Algorithmic (no LLM): readingGradeLevel, dialogueRatio
 * 2. LLM-extracted (lightweight): premise, triggerWarnings
 */

export { computeReadingGradeLevel, type ReadingGradeLevelResult } from "./readingGradeLevel";
export { computeDialogueRatio, type DialogueRatioResult } from "./dialogueRatio";
export { computeEnrichment, type EnrichmentResult } from "./computeEnrichment";
