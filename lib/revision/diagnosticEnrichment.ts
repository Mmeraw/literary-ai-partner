/**
 * Diagnostic Enrichment — SIPOC kick-backward for incomplete recommendations
 *
 * When Pass 3 produces a recommendation with missing diagnostic fields,
 * this module requests enrichment from the LLM by telling it:
 *   1. WHAT is missing (specific field names)
 *   2. WHY it's needed (per canon, author trust requires it)
 *   3. GOLD STANDARD example (from Sister dream ledger)
 *
 * Per SIPOC_INPUT_OUTPUT_QUALITY_GATES.md:
 * "If a phase cannot produce the required output, it must fail closed,
 *  create a fit-gap/quality report, or degrade with proof."
 */

import OpenAI from 'openai';

// ── Constants ─────────────────────────────────────────────────────────────────

export const DIAGNOSTIC_ENRICHMENT_MODEL = process.env.EVAL_HYDRATION_MODEL ?? 'gpt-5.1';
export const DIAGNOSTIC_ENRICHMENT_VERSION = 'diagnostic_enrichment_v1' as const;
const ENRICHMENT_MAX_TOKENS = 2000;
const ENRICHMENT_TIMEOUT_MS = 30_000;
/** Minimum characters for a diagnostic field to count as populated. */
const MIN_DIAGNOSTIC_LENGTH = 10;

// ── Types ────────────────────────────────────────────────────────────────────

export type DiagnosticField = 'symptom' | 'cause' | 'fix_direction' | 'reader_effect';

export type EnrichmentOpportunity = {
  opportunity_id: string;
  evidence_anchor: string;
  rationale: string;
  criterion: string;
  revision_operation?: string;
  /** Existing diagnostic fields — enrichment only fills what's missing. */
  symptom?: string;
  cause?: string;
  fix_direction?: string;
  reader_effect?: string;
};

export type EnrichmentResult = {
  symptom: string;
  cause: string;
  fix_direction: string;
  reader_effect: string;
};

export type DiagnosticEnrichmentOutcome = {
  enrichedCount: number;
  failedCount: number;
  results: Map<string, EnrichmentResult>;
};

// ── Gold Standard Example ─────────────────────────────────────────────────────

const GOLD_STANDARD_EXAMPLE = `
## Gold Standard — from "Sister" by Mike Meraw (Revise Queue Dream Ledger)

Evidence anchor:
"I raced to the hospital and found Israel in a pale blue hospital gown strapped to a gurney by his ankles and wrists. He was on a suicide watch in the emergency room area. We talked and I consoled him."

Symptom:
The prose moves through "strapped to a gurney by his ankles and wrists," "We talked and I consoled him," and "I took photos of him in this condition" at the same pace and voice as the employment agency scene, so the reader cannot feel the shift in gravity.

Cause:
The author reports the event sequentially without slowing the prose rhythm, adjusting sentence length, or allowing a single sensory detail to carry emotional weight.

Fix direction:
Slow one beat in the hospital scene by replacing a summary sentence with a single concrete sensory detail that carries the emotional register shift.

Reader effect:
The reader's body registers the gravity of the moment — the essay earns its emotional claim rather than merely stating it.
`.trim();

// ── Prompt Construction ──────────────────────────────────────────────────────

function buildEnrichmentPrompt(
  opportunity: EnrichmentOpportunity,
  missingFields: DiagnosticField[],
): string {
  const fieldDescriptions: Record<DiagnosticField, string> = {
    symptom: 'SYMPTOM — the observable craft problem on the page that the reader experiences. Without this, the author cannot trust the recommendation because they do not know what problem it solves.',
    cause: 'CAUSE — the craft mechanism creating the problem. This explains WHY the issue exists at this location, not just WHAT the issue is.',
    fix_direction: 'FIX DIRECTION — concrete, actionable repair strategy. What the revision should accomplish, stated as an instruction.',
    reader_effect: 'READER EFFECT — what the reader gains when the fix is applied. The measurable improvement in reading experience.',
  };

  const missingDescriptions = missingFields
    .map((field) => `- ${fieldDescriptions[field]}`)
    .join('\n');

  return `You are a senior literary editor producing diagnostic analysis for a Revise Queue card.

A recommendation was produced but is INCOMPLETE. The following required diagnostic fields are MISSING:

${missingDescriptions}

Every recommendation in the Revise Queue MUST have all four diagnostic fields populated.
The author pays for premium editorial diagnosis — not vague advice.

## Evidence anchor (the passage being diagnosed):

"${opportunity.evidence_anchor}"

## Criterion: ${opportunity.criterion}

## Existing rationale: ${opportunity.rationale}

${opportunity.symptom ? `## Existing symptom: ${opportunity.symptom}` : ''}
${opportunity.cause ? `## Existing cause: ${opportunity.cause}` : ''}
${opportunity.fix_direction ? `## Existing fix_direction: ${opportunity.fix_direction}` : ''}
${opportunity.reader_effect ? `## Existing reader_effect: ${opportunity.reader_effect}` : ''}

## GOLD STANDARD EXAMPLE (this is what "done right" looks like):

${GOLD_STANDARD_EXAMPLE}

## YOUR TASK:

Produce ONLY the missing fields for the evidence anchor above. Each field must be:
- Specific to THIS passage (not generic advice)
- At least 15 words
- Written in third-person editorial voice
- Never echo the evidence anchor verbatim
- Never use meta-phrases like "This passage would benefit from..." or "There is an opportunity to..."

Respond in JSON format:
{
${missingFields.map((f) => `  "${f}": "your analysis here"`).join(',\n')}
}`;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

function identifyMissingFields(opportunity: EnrichmentOpportunity): DiagnosticField[] {
  const missing: DiagnosticField[] = [];
  if (!opportunity.symptom || opportunity.symptom.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    missing.push('symptom');
  }
  if (!opportunity.cause || opportunity.cause.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    missing.push('cause');
  }
  if (!opportunity.fix_direction || opportunity.fix_direction.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    missing.push('fix_direction');
  }
  if (!opportunity.reader_effect || opportunity.reader_effect.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    missing.push('reader_effect');
  }
  return missing;
}

/**
 * Validate that a produced diagnostic field is not contaminated or generic.
 */
function isValidDiagnosticField(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < MIN_DIAGNOSTIC_LENGTH) return false;

  // Contamination patterns — template meta-phrases that indicate the LLM is "advising" not "diagnosing"
  const CONTAMINATION_PATTERNS = [
    /there is (a clear |an? )?editorial opportunity/i,
    /this passage would benefit from/i,
    /the author (should|could|might) consider/i,
    /consider (revising|restructuring|rewriting)/i,
    /^(revise|rewrite|restructure|improve)\s/i,
    // Stress-test-discovered patterns (adversarial meta-phrases)
    /it would be beneficial to/i,
    /^a revision here (could|would|should)/i,
    /one might (improve|revise|restructure|rewrite)/i,
    /an? opportunity exists to/i,
    /would be more effective (with|if)/i,
  ];

  return !CONTAMINATION_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Enrich a batch of opportunities with missing diagnostic fields.
 *
 * For each opportunity:
 * 1. Identify which diagnostic fields are missing
 * 2. Build targeted prompt with gold-standard example
 * 3. Call LLM to produce ONLY the missing fields
 * 4. Validate response quality
 * 5. Return enriched fields or mark as failed
 */
export async function enrichDiagnosticFields(
  opportunities: EnrichmentOpportunity[],
): Promise<DiagnosticEnrichmentOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { enrichedCount: 0, failedCount: opportunities.length, results: new Map() };
  }

  const client = new OpenAI({ apiKey, timeout: ENRICHMENT_TIMEOUT_MS });
  const results = new Map<string, EnrichmentResult>();
  let enrichedCount = 0;
  let failedCount = 0;

  for (const opportunity of opportunities) {
    const missingFields = identifyMissingFields(opportunity);
    if (missingFields.length === 0) {
      // Already complete — pass through existing values
      results.set(opportunity.opportunity_id, {
        symptom: opportunity.symptom ?? '',
        cause: opportunity.cause ?? '',
        fix_direction: opportunity.fix_direction ?? '',
        reader_effect: opportunity.reader_effect ?? '',
      });
      enrichedCount++;
      continue;
    }

    try {
      const prompt = buildEnrichmentPrompt(opportunity, missingFields);
      const response = await client.chat.completions.create({
        model: DIAGNOSTIC_ENRICHMENT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: ENRICHMENT_MAX_TOKENS,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        failedCount++;
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        failedCount++;
        continue;
      }

      // Validate each produced field
      let allValid = true;
      const enriched: EnrichmentResult = {
        symptom: opportunity.symptom ?? '',
        cause: opportunity.cause ?? '',
        fix_direction: opportunity.fix_direction ?? '',
        reader_effect: opportunity.reader_effect ?? '',
      };

      for (const field of missingFields) {
        const produced = parsed[field];
        if (isValidDiagnosticField(produced)) {
          enriched[field] = (produced as string).trim();
        } else {
          allValid = false;
        }
      }

      if (allValid) {
        results.set(opportunity.opportunity_id, enriched);
        enrichedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { enrichedCount, failedCount, results };
}

/**
 * Check if an opportunity needs diagnostic enrichment.
 * Returns true if any required diagnostic field is missing or too short.
 */
export function needsDiagnosticEnrichment(opportunity: EnrichmentOpportunity): boolean {
  return identifyMissingFields(opportunity).length > 0;
}

/**
 * List the specific fields that are missing from an opportunity.
 */
export function getMissingDiagnosticFields(opportunity: EnrichmentOpportunity): DiagnosticField[] {
  return identifyMissingFields(opportunity);
}
