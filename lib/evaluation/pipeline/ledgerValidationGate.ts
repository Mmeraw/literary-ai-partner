/**
 * Ledger Validation Gate (Phase 3 Post-Synthesis)
 *
 * After Pass 3 generates its synthesis output, this gate checks the output
 * against the full-context story ledger's failure conditions. If any
 * recommendation contradicts a hard fact (e.g., recommending scenes for dead
 * characters, claiming stationary objects move), the gate flags those items.
 *
 * This is a SOFT gate — it doesn't block the pipeline. It annotates the output
 * with validation warnings that can be surfaced in the report or used to
 * trigger regeneration of specific recommendations.
 */

import type { FullContextStoryLedger, FailureCondition, CanonicalHardFact } from '../seed/fullContextStoryLedger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LedgerViolation {
  violation_type: 'contradicts_hard_fact' | 'contradicts_failure_condition' | 'recommends_for_dead_character' | 'misattributes_object_mobility';
  severity: 'hard' | 'soft';
  source_fact: string;
  offending_text: string;
  location: string;
}

export interface LedgerValidationResult {
  passed: boolean;
  violations: LedgerViolation[];
  checked_at: string;
  facts_checked: number;
  failure_conditions_checked: number;
}

// ─── Gate Implementation ─────────────────────────────────────────────────────

/**
 * Validate Pass 3 synthesis output against story ledger ground truth.
 *
 * @param synthesisText - The full text of recommendations/revision notes from Pass 3
 * @param ledger - The full-context story ledger from Phase 0.5a
 * @returns Validation result with any violations found
 */
export function validateAgainstLedger(
  synthesisText: string,
  ledger: FullContextStoryLedger,
): LedgerValidationResult {
  const violations: LedgerViolation[] = [];
  const textLower = synthesisText.toLowerCase();

  // Check against failure conditions
  for (const condition of ledger.failure_conditions) {
    const violation = checkFailureCondition(textLower, synthesisText, condition);
    if (violation) {
      violations.push(violation);
    }
  }

  // Check against canonical hard facts - character death states
  for (const fact of ledger.canonical_hard_facts) {
    const factViolations = checkHardFact(textLower, synthesisText, fact);
    violations.push(...factViolations);
  }

  // Check object mobility from Layer 7
  if (ledger.layers.object_symbol?.objects) {
    for (const obj of ledger.layers.object_symbol.objects) {
      if (obj.mobility === 'stationary') {
        const objNameLower = obj.name.toLowerCase();
        // Look for language suggesting the object moves/travels/circulates
        const mobilityPatterns = [
          `${objNameLower} move`,
          `${objNameLower} travel`,
          `${objNameLower} circulate`,
          `${objNameLower} transfer`,
          `move the ${objNameLower}`,
          `moving ${objNameLower}`,
          `${objNameLower} physically`,
        ];
        for (const pattern of mobilityPatterns) {
          if (textLower.includes(pattern)) {
            violations.push({
              violation_type: 'misattributes_object_mobility',
              severity: 'hard',
              source_fact: `${obj.name} is STATIONARY (mobility: stationary). ${obj.lifecycle_note}`,
              offending_text: extractContext(synthesisText, pattern),
              location: 'object_mobility_check',
            });
            break;
          }
        }
      }
    }
  }

  // Check character end states from Layer 9 (threat_pressure_ending)
  if (ledger.layers.threat_pressure_ending?.character_end_states) {
    for (const charState of ledger.layers.threat_pressure_ending.character_end_states) {
      if (charState.is_terminal) {
        const charNameLower = charState.entity.toLowerCase();
        // Look for recommendations that assume the character has a future
        const alivePatterns = [
          `${charNameLower}'s trajectory`,
          `${charNameLower}'s arc after`,
          `${charNameLower}'s future`,
          `${charNameLower} in book two`,
          `${charNameLower} going forward`,
          `${charNameLower} post-`,
          `aftermath.*${charNameLower}`,
          `${charNameLower}.*aftermath`,
        ];
        for (const pattern of alivePatterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(synthesisText)) {
            violations.push({
              violation_type: 'recommends_for_dead_character',
              severity: 'hard',
              source_fact: `${charState.entity} is TERMINAL: ${charState.end_state}`,
              offending_text: extractContext(synthesisText, pattern),
              location: 'character_end_state_check',
            });
            break;
          }
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    checked_at: new Date().toISOString(),
    facts_checked: ledger.canonical_hard_facts.length,
    failure_conditions_checked: ledger.failure_conditions.length,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function checkFailureCondition(
  textLower: string,
  originalText: string,
  condition: FailureCondition,
): LedgerViolation | null {
  // Each failure condition has a `condition` string that describes what would
  // constitute a comprehension failure. We extract key phrases from it and check.
  const conditionLower = condition.condition.toLowerCase();

  // Extract quoted phrases from the condition (e.g., 'says "Billy needs post-tent"')
  const quotedPhrases = conditionLower.match(/["']([^"']+)["']/g);
  if (quotedPhrases) {
    for (const phrase of quotedPhrases) {
      const cleaned = phrase.replace(/["']/g, '').trim();
      if (cleaned.length > 5 && textLower.includes(cleaned)) {
        return {
          violation_type: 'contradicts_failure_condition',
          severity: 'hard',
          source_fact: `FAILURE CONDITION [${condition.layer}]: ${condition.condition}`,
          offending_text: extractContext(originalText, cleaned),
          location: `failure_condition_${condition.layer}`,
        };
      }
    }
  }

  // Check for key indicator phrases ("fails if", "must not", etc.)
  const keywords = extractKeyPhrases(conditionLower);
  const matchCount = keywords.filter((kw) => textLower.includes(kw)).length;
  if (matchCount >= 2 && keywords.length <= 5) {
    return {
      violation_type: 'contradicts_failure_condition',
      severity: 'soft',
      source_fact: `FAILURE CONDITION [${condition.layer}]: ${condition.condition}`,
      offending_text: `Multiple indicator phrases matched: ${keywords.filter((kw) => textLower.includes(kw)).join(', ')}`,
      location: `failure_condition_${condition.layer}_keywords`,
    };
  }

  return null;
}

function checkHardFact(
  _textLower: string,
  _originalText: string,
  _fact: CanonicalHardFact,
): LedgerViolation[] {
  // Hard facts are checked implicitly through character end states and
  // object mobility checks above. This function is a placeholder for
  // future pattern-based hard fact validation (e.g., custom negation
  // patterns added to the ledger schema in v2).
  return [];
}

function extractKeyPhrases(conditionText: string): string[] {
  // Extract meaningful multi-word phrases from a failure condition string
  const phrases: string[] = [];
  const words = conditionText.split(/\s+/);
  // Build 2-3 word phrases from the condition
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    if (twoWord.length > 6 && !['fails if', 'must not', 'should not'].includes(twoWord)) {
      phrases.push(twoWord);
    }
  }
  return phrases.slice(0, 5);
}

function extractContext(text: string, pattern: string): string {
  const idx = text.toLowerCase().indexOf(pattern.toLowerCase());
  if (idx === -1) return '';
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + pattern.length + 50);
  return text.slice(start, end).replace(/\n/g, ' ').trim();
}
