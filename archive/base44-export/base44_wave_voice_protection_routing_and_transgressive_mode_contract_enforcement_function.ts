import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// PROTECTED CATEGORIES (Hard Bans from Transgressive Mode Contract)
const PROTECTED_LABELS = new Set([
  "COINAGE_SIMPLIFY",
  "METAPHOR_TO_PLAIN",
  "RHYTHM_TRUNCATION",
  "DIALECT_NEUTRALIZE",
  "CULTURAL_SPECIFICITY_REMOVAL"
]);

// Voice Protection Routing Logic (Contract Implementation)
// Input: WAVE findings, mode, register_lock per finding
// Output: Routed findings with UI labels, severity, actions, scoring flags

function scoreFinding(finding, textContext) {
  // 5-dimension rubric from contract
  // Returns: comprehension_risk, voice_value, register_integrity, rhythm_value, market_volatility
  
  const text = finding.excerpt || finding.original_text || '';
  const context = textContext || {};
  
  // Comprehension Risk (0-3): Can reader parse meaning?
  let comprehension_risk = 0;
  if (text.length > 200 || /\b(unclear|ambiguous|confusing)\b/i.test(finding.why_flagged || '')) {
    comprehension_risk = 1;
  }
  if (/\b(breaks|blocks|collapses)\b/i.test(finding.why_flagged || '')) {
    comprehension_risk = 3;
  }
  
  // Voice Value (0-3): How distinctive is this to author's voice?
  let voice_value = 0;
  if (/\b(slang|dialect|idiom|colloquial|coinage)\b/i.test(finding.why_flagged || '')) {
    voice_value = 2;
  }
  if (/\b(signature|brand|core voice)\b/i.test(finding.why_flagged || '')) {
    voice_value = 3;
  }
  
  // Register Integrity (0-3): Does it match established diction?
  let register_integrity = context.register_lock === 'hard' ? 3 : 2;
  if (finding.register === 'dialogue' || finding.register === 'lyrics_or_stylized') {
    register_integrity = 3;
  }
  
  // Rhythm / Cadence Value (0-3): Musical/timing importance
  let rhythm_value = 0;
  if (/\b(rhythm|cadence|music|timing|pacing)\b/i.test(finding.why_flagged || '')) {
    rhythm_value = 2;
  }
  if (/\b(essential|core|signature cadence)\b/i.test(finding.why_flagged || '')) {
    rhythm_value = 3;
  }
  
  // Market Volatility (0-3): How polarizing is this?
  let market_volatility = 0;
  if (/\b(profanity|offensive|disturbing|extreme)\b/i.test(finding.why_flagged || '')) {
    market_volatility = 2;
  }
  
  return {
    comprehension_risk,
    voice_value,
    register_integrity,
    rhythm_value,
    market_volatility
  };
}

function estimateIntentConfidence(finding, textContext) {
  // Intent signals: repeated patterns, consistent vernacular, deliberate parallelism
  let confidence = 0.5; // baseline
  
  const patterns = textContext?.patterns || {};
  
  if (patterns.repeated_idiolect) confidence += 0.2;
  if (patterns.consistent_vernacular) confidence += 0.2;
  if (patterns.metaphor_density_high) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function recommendActionTrusted(finding, scores) {
  // Trusted Path mode: recommend changes for clarity/craft with voice respect
  if (scores.comprehension_risk >= 2) return "SUGGEST_CHANGE";
  if (scores.voice_value >= 2) return "NO_ACTION"; // Protect high voice value
  return "SUGGEST_CHANGE";
}

function computeSeverityTrusted(scores) {
  // Trusted Path severity: prioritize comprehension + craft
  if (scores.comprehension_risk === 3) return "HIGH";
  if (scores.comprehension_risk >= 2) return "MED";
  return "LOW";
}

function optionalAltPreservingVoice(finding) {
  // Generate voice-preserving alternative (placeholder)
  return finding.suggested_text || null;
}

function generateVoicePreservingAlts(finding, count) {
  // Generate multiple voice-preserving alternatives (placeholder)
  return [];
}

function fixWhilePreservingRegister(finding) {
  // Fix comprehension break while keeping register (placeholder)
  return finding.suggested_text || finding.original_text;
}

function generatePreservingRegisterAlts(finding, count) {
  // Generate register-preserving alternatives (placeholder)
  return [];
}

function minimalCraftPolish(finding) {
  // Minimal craft improvement (placeholder)
  return finding.suggested_text || finding.original_text;
}

function generateMinimalAlts(finding, count) {
  // Generate minimal polish alternatives (placeholder)
  return [];
}

function addToRiskAndMarketNotes(finding, scores, intentConf) {
  // Route high-volatility findings to separate market notes report
  // (This would append to a separate data structure in production)
  console.log('[MARKET_RISK]', {
    text: finding.original_text,
    volatility: scores.market_volatility,
    intent_confidence: intentConf
  });
}

function isAutoApplyEligible(finding) {
  if (finding.default_action !== "SUGGEST_CHANGE") return false;
  if (finding.trusted_path_eligible === false) return false;
  if (["VOICE_REGISTER_REVIEW", "STYLE_SIGNAL"].includes(finding.ui_label)) return false;
  if (PROTECTED_LABELS.has(finding.label)) return false;
  if (finding.severity === "HIGH") return false; // high requires explicit review
  return true;
}

// MAIN ROUTING FUNCTION
export function applyVoiceProtectionRouting(findings, mode, textContext = {}) {
  const routedFindings = [];
  
  for (const f of findings) {
    const scores = scoreFinding(f, textContext);
    const intentConf = estimateIntentConfidence(f, textContext);
    
    let routed = { ...f };
    
    // --- Mode gates ---
    if (mode === "trusted_path") {
      // default: improve clarity + craft with minimal voice impact
      if (PROTECTED_LABELS.has(f.label) || f.label?.includes('DIALECT') || f.label?.includes('COINAGE')) {
        routed.visibility = "EXPERIMENTAL_TAB";
        routed.default_action = "NO_ACTION";
        routed.severity = "LOW";
        routed.affects_score = false;
      } else {
        routed.visibility = "PRIMARY";
        routed.default_action = recommendActionTrusted(f, scores);
        routed.severity = computeSeverityTrusted(scores);
        routed.affects_score = true;
      }
    } else if (mode === "transgressive") {
      // protect voice; only intervene when comprehension breaks or true craft errors
      if (PROTECTED_LABELS.has(f.label) || f.label?.includes('DIALECT') || f.label?.includes('COINAGE')) {
        routed.visibility = "PRIMARY";
        routed.ui_label = "VOICE_REGISTER_REVIEW";
        routed.default_action = "NO_ACTION";
        routed.severity = "LOW";
        routed.affects_score = false;
        routed.trusted_path_eligible = false; // never auto-apply
        routed.suggested_revision = optionalAltPreservingVoice(f);
        routed.alternatives = generateVoicePreservingAlts(f, 3);
      } else {
        if (scores.comprehension_risk === 3) {
          routed.visibility = "PRIMARY";
          routed.ui_label = "CLARITY_BREAK_FIX";
          routed.default_action = "SUGGEST_CHANGE";
          routed.severity = "HIGH";
          routed.affects_score = true;
          routed.suggested_revision = fixWhilePreservingRegister(f);
          routed.alternatives = generatePreservingRegisterAlts(f, 3);
        } else {
          // advisory: do not penalize voice-forward choices
          if (scores.voice_value >= 2 || scores.rhythm_value >= 2 || scores.register_integrity >= 2) {
            routed.visibility = "PRIMARY";
            routed.ui_label = "STYLE_SIGNAL";
            routed.default_action = "NO_ACTION";
            routed.severity = "LOW";
            routed.affects_score = false;
          } else {
            routed.visibility = "PRIMARY";
            routed.ui_label = "OPTIONAL_CRAFT_POLISH";
            routed.default_action = "SUGGEST_CHANGE";
            routed.severity = "MED";
            routed.affects_score = true; // only if it's not voice-driven
            routed.suggested_revision = minimalCraftPolish(f);
            routed.alternatives = generateMinimalAlts(f, 3);
          }
        }
      }
    }
    
    // --- Market notes routing (separate report) ---
    if (scores.market_volatility >= 2) {
      addToRiskAndMarketNotes(f, scores, intentConf);
    }
    
    // Add scoring dimensions to finding
    routed.scoring_dimensions = scores;
    routed.intent_confidence = intentConf;
    routed.auto_apply_eligible = isAutoApplyEligible(routed);
    
    routedFindings.push(routed);
  }
  
  return routedFindings;
}

// HTTP handler for testing/standalone use
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { findings, mode, textContext } = await req.json();
    
    if (!findings || !Array.isArray(findings)) {
      return Response.json({ error: 'findings array required' }, { status: 400 });
    }
    
    if (!['trusted_path', 'transgressive'].includes(mode)) {
      return Response.json({ error: 'mode must be "trusted_path" or "transgressive"' }, { status: 400 });
    }
    
    const routed = applyVoiceProtectionRouting(findings, mode, textContext);
    
    return Response.json({ 
      routed_findings: routed,
      mode: mode,
      total: routed.length,
      score_affecting: routed.filter(f => f.affects_score).length,
      voice_protected: routed.filter(f => f.ui_label === 'VOICE_REGISTER_REVIEW' || f.ui_label === 'STYLE_SIGNAL').length
    });
    
  } catch (error) {
    console.error('Routing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});