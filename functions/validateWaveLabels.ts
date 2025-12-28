import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// WAVE validation lexicons - hard-gated triggers
const WAVE_LEXICONS = {
  body_parts: ['jaw', 'chest', 'eyes', 'eye', 'breath', 'heart', 'hands', 'hand', 'stomach', 'throat', 'fingers', 'shoulders', 'spine', 'lungs', 'pulse'],
  filter_verbs: ['saw', 'felt', 'heard', 'noticed', 'realized', 'knew', 'thought', 'sensed', 'perceived', 'observed', 'wondered'],
  telling_indicators: ['felt peaceful', 'felt calm', 'felt angry', 'seemed', 'appeared to be', 'looked like'],
  reflexives: ['himself', 'herself', 'themselves', 'ourselves', 'itself'],
  generic_nouns: ['thing', 'stuff', 'situation', 'area', 'place', 'room'],
  adverbs: ['very', 'really', 'suddenly', 'quickly', 'extremely', 'just', 'definitely']
};

// Wave-specific rationale templates
const WAVE_RATIONALES = {
  'Body-Part Clichés (Wave 1)': (evidence) => `Removing body-part reference "${evidence}" that doesn't advance action, replacing with observable behavior or cutting entirely.`,
  'Filter Verbs (Wave 4)': (evidence) => `Removing filter verb "${evidence}" to create immediacy, putting the reader directly into the experience instead of through the narrator's perception.`,
  'Telling vs Showing': (evidence) => `Converting summary emotion "${evidence}" into concrete sensory evidence or observable behavior.`,
  'Generic Nouns (Wave 3)': (evidence) => `Replacing generic noun "${evidence}" with specific, tangible detail.`,
  'Adverbs (Wave 5)': (evidence) => `Removing adverb "${evidence}" and strengthening the base verb.`,
  'Passive Voice (Wave 6)': (evidence) => `Converting passive construction to active voice, restoring clear agency.`,
  'Reflexive Redundancy (Wave 61)': (evidence) => `Removing redundant reflexive "${evidence}" that adds no narrative function.`
};

// Hard-gate validation
function validateWaveLabel(waveLabel, evidenceText) {
  const lowerText = evidenceText.toLowerCase();
  
  switch (waveLabel) {
    case 'Body-Part Clichés (Wave 1)':
      const hasBodyPart = WAVE_LEXICONS.body_parts.some(part => lowerText.includes(part));
      return {
        valid: hasBodyPart,
        reason: hasBodyPart ? null : 'No body-part lexeme found in evidence'
      };
      
    case 'Filter Verbs (Wave 4)':
      const hasFilter = WAVE_LEXICONS.filter_verbs.some(verb => lowerText.includes(verb));
      return {
        valid: hasFilter,
        reason: hasFilter ? null : 'No filter verb found in evidence'
      };
      
    case 'Generic Nouns (Wave 3)':
      const hasGeneric = WAVE_LEXICONS.generic_nouns.some(noun => lowerText.includes(noun));
      return {
        valid: hasGeneric,
        reason: hasGeneric ? null : 'No generic noun found in evidence'
      };
      
    case 'Adverbs (Wave 5)':
      const hasAdverb = WAVE_LEXICONS.adverbs.some(adv => lowerText.includes(adv));
      return {
        valid: hasAdverb,
        reason: hasAdverb ? null : 'No adverb found in evidence'
      };
      
    case 'Reflexive Redundancy (Wave 61)':
      const hasReflexive = WAVE_LEXICONS.reflexives.some(ref => lowerText.includes(ref));
      return {
        valid: hasReflexive,
        reason: hasReflexive ? null : 'No reflexive pronoun found in evidence'
      };
      
    default:
      // Soft-gated waves (passive voice, negation, etc.) - allow probabilistic
      return { valid: true, reason: null };
  }
}

// Detect all applicable waves for multi-tagging
function detectApplicableWaves(evidenceText) {
  const lowerText = evidenceText.toLowerCase();
  const waves = [];
  
  // Check each hard-gated wave
  if (WAVE_LEXICONS.body_parts.some(p => lowerText.includes(p))) {
    waves.push('Body-Part Clichés (Wave 1)');
  }
  if (WAVE_LEXICONS.filter_verbs.some(v => lowerText.includes(v))) {
    waves.push('Filter Verbs (Wave 4)');
  }
  if (WAVE_LEXICONS.telling_indicators.some(t => lowerText.includes(t))) {
    waves.push('Telling vs Showing');
  }
  if (WAVE_LEXICONS.generic_nouns.some(n => lowerText.includes(n))) {
    waves.push('Generic Nouns (Wave 3)');
  }
  if (WAVE_LEXICONS.adverbs.some(a => lowerText.includes(a))) {
    waves.push('Adverbs (Wave 5)');
  }
  if (WAVE_LEXICONS.reflexives.some(r => lowerText.includes(r))) {
    waves.push('Reflexive Redundancy (Wave 61)');
  }
  
  // Check passive voice patterns
  if (/\b(was|were|been)\s+\w+ed\b/.test(lowerText)) {
    waves.push('Passive Voice (Wave 6)');
  }
  
  // Check negation
  const negations = (lowerText.match(/\b(didn't|not|never|no)\b/g) || []).length;
  if (negations >= 3) {
    waves.push('Negation (Wave 7)');
  }
  
  return waves;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { waveHits } = await req.json();
    
    // Validate and structure each wave hit
    const validatedHits = [];
    const invalidHits = [];
    
    for (const hit of waveHits) {
      // Validate primary wave label
      const validation = validateWaveLabel(hit.category, hit.example_quote);
      
      if (!validation.valid) {
        invalidHits.push({
          original: hit,
          reason: validation.reason
        });
        continue;
      }
      
      // Detect all applicable waves
      const applicableWaves = detectApplicableWaves(hit.example_quote);
      
      // Structure as primary + secondary
      const primaryWave = hit.category;
      const secondaryWaves = applicableWaves.filter(w => w !== primaryWave);
      
      // Generate wave-specific rationale
      const rationale = WAVE_RATIONALES[primaryWave] 
        ? WAVE_RATIONALES[primaryWave](hit.example_quote)
        : hit.fix_suggestion;
      
      validatedHits.push({
        primary_wave: {
          id: primaryWave,
          name: primaryWave,
          severity: hit.severity,
          evidence: hit.example_quote,
          fix: hit.fix_suggestion,
          rationale: rationale
        },
        secondary_waves: secondaryWaves,
        trigger_evidence: {
          matched_lexemes: applicableWaves,
          validation: validation
        }
      });
    }
    
    return Response.json({
      validated_hits: validatedHits,
      invalid_hits: invalidHits,
      validation_summary: {
        total: waveHits.length,
        valid: validatedHits.length,
        invalid: invalidHits.length
      }
    });

  } catch (error) {
    console.error('Wave validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});