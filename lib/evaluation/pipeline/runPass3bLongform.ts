// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (commercial literary fiction
// is a publishing genre/shelf category), not a criterion alias for the canonical
// 'marketability' criterion. The two are distinct concepts in different namespaces.
// See docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md §dream_scores for DREAM subscore authority.
/**
 * Pass 3b — Long-Form DREAM Document Synthesis Runner
 *
 * Fires ONLY when route === "LONG_FORM" (≥ 25,000 words / inputScale === "full_manuscript").
 * Reads Pass 3 synthesized criteria and produces the full 16-section DREAM document.
 *
 * Authority chain:
 *   docs/governance/evaluation-output-mode-contract.md
 *   docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
 *   docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
 *   docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md
 *   docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md
 *
 * Temperature: 0.3   Default max tokens: 12000 (override via EVAL_PASS3B_MAX_TOKENS)
 *
 * This pass is ADDITIVE. It does not re-score criteria and does not affect the
 * quality gate. Its output is stored as artifact type "longform_document_v1".
 */

import OpenAI from "openai";
import {
  PASS3B_SYSTEM_PROMPT,
  PASS3B_PROMPT_VERSION,
  buildPass3bUserPrompt,
} from "./prompts/pass3b-longform";
import { sanitizeCMOSDeep } from "../cmosSanitizer";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass3Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { trackCompletionCost } from "@/lib/jobs/cost";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import type {
  SynthesizedCriterion,
  ManuscriptChunkEvidence,
  Pass2aStructuredContext,
} from "./types";
import type { SubmissionScopeProfile } from "./submissionScope";
import { CRITERIA_METADATA } from "@/schemas/criteria-keys";
import type { GenreExpectationMetadata } from "@/lib/evaluation/genreExpectationProfiles";
import { buildEnglishVariantPromptBlock, type EnglishVariant } from "@/lib/evaluation/englishVariant";

// ── Constants ─────────────────────────────────────────────────────────────────

const PASS3B_TEMPERATURE = 0.3;

type DreamConfidence = "High" | "Moderate-High" | "Moderate" | "Low";

// Default raised from 6000 → 16000 for the 16-section Narrative Synthesis document.
// The output spans 16 mandatory sections (executive verdict, dream_scores, market_shelf,
// structural_stack, arc_map, criterion_analyses for 13 criteria, layer_analyses,
// cross_layer_integration, symbolic_audit, reader_experience, revision_plan, releasability,
// acceptance_checks, calibration_notes, repo_summary, manuscript_integrity_issues).
// At 6000 tokens GPT-5 was truncating mid-document → response_format=json_object returned
// malformed JSON → validateDreamDocument threw with "missing required sections".
// 16000 is generous by design — dial back via EVAL_PASS3B_MAX_TOKENS once reports confirm
// full document completion. Floor set to 12000 to prevent silently-too-low overrides.
function getPass3bMaxTokens(): number {
  const raw = process.env.EVAL_PASS3B_MAX_TOKENS;
  if (raw) {
    const parsed = parseInt(raw, 10);
    // Allow 12000–32000; gpt-5.1 supports up to 128k output tokens
    if (!isNaN(parsed) && parsed >= 12000 && parsed <= 32000) return parsed;
  }
  // Raised from 16000 → 24000: the 16-section DREAM document reliably exceeds 16k tokens
  // on full novels with gpt-5.1. 24000 gives headroom without excessive cost.
  return 24000;
}

const PASS3B_MAX_TOKENS_CEILING = 32000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LongformDreamDocument {
  /** §1 — Executive verdict prose */
  executive_verdict: string;
  /** §1 — DREAM subscores 0–100 */
  dream_scores: {
    quality: number;
    readiness: number;
    /** Publishing genre dimension: commercial literary fiction readiness (distinct from the 'marketability' criterion) */
    commercial: number;
    literary: number;
  };
  /** §2 — Market shelf analysis */
  market_shelf: {
    best_shelf: string;
    shelf_neighbors: string[];
    comparison_space: string[];
    marketable_hook: string;
    market_danger: string;
  };
  /** §3 — Named anti-patterns specific to this manuscript */
  what_not_to_become: string[];
  /** §4 — Structural layer stack */
  structural_stack: Array<{
    layer_name: string;
    function: string;
    status: "strong" | "moderate" | "weak" | "fragile";
    revision_note: string;
  }>;
  /** §5 — Act-level arc map */
  arc_map: Array<{
    act_name: string;
    chapter_range: string;
    primary_function: string;
    revision_priority: string;
  }>;
  /** §7 — Per-criterion expanded analysis (expands the score grid) */
  criterion_analyses: Array<{
    key: string;
    score: number;
