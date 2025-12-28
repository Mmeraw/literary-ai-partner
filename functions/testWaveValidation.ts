import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Golden test set - deliberately chosen to catch 90% of mislabeling
const GOLDEN_TEST_SET = [
  {
    id: 'test_1',
    text: 'The morning felt peaceful as we worked until I noticed a shadow along the tree line.',
    expected_primary: 'Filter Verbs (Wave 4)',
    expected_secondary: ['Telling vs Showing'],
    should_not_trigger: ['Body-Part Clichés (Wave 1)']
  },
  {
    id: 'test_2',
    text: 'I realized the truth and felt the weight of it pressing down.',
    expected_primary: 'Filter Verbs (Wave 4)',
    expected_secondary: ['Telling vs Showing'],
    should_not_trigger: ['Body-Part Clichés (Wave 1)']
  },
  {
    id: 'test_3',
    text: 'His jaw tightened and his chest heaved with the effort.',
    expected_primary: 'Body-Part Clichés (Wave 1)',
    expected_secondary: [],
    should_not_trigger: ['Filter Verbs (Wave 4)']
  },
  {
    id: 'test_4',
    text: 'Her eyes widened but she said nothing.',
    expected_primary: 'Body-Part Clichés (Wave 1)',
    expected_secondary: [],
    should_not_trigger: ['Filter Verbs (Wave 4)', 'Telling vs Showing']
  },
  {
    id: 'test_5',
    text: 'He grabbed the knife with his hands and cut the rope.',
    expected_primary: 'Body-Part Clichés (Wave 1)',
    expected_secondary: ['Reflexive Redundancy (Wave 61)'],
    should_not_trigger: ['Filter Verbs (Wave 4)']
  },
  {
    id: 'test_6',
    text: 'She held the blade steady, her fingers white-knuckled on the grip.',
    expected_primary: null, // Should NOT trigger Wave 1 - body parts used functionally
    expected_secondary: [],
    should_not_trigger: ['Body-Part Clichés (Wave 1)']
  },
  {
    id: 'test_7',
    text: 'The shadow flickered along the tree line near the runway.',
    expected_primary: null, // Clean line
    expected_secondary: [],
    should_not_trigger: ['Body-Part Clichés (Wave 1)', 'Filter Verbs (Wave 4)', 'Telling vs Showing']
  },
  {
    id: 'test_8',
    text: 'I noticed the thing in the room and realized it was very strange.',
    expected_primary: 'Filter Verbs (Wave 4)',
    expected_secondary: ['Generic Nouns (Wave 3)', 'Adverbs (Wave 5)'],
    should_not_trigger: ['Body-Part Clichés (Wave 1)']
  },
  {
    id: 'test_9',
    text: 'The door was opened by someone and the lights were turned on.',
    expected_primary: 'Passive Voice (Wave 6)',
    expected_secondary: [],
    should_not_trigger: ['Body-Part Clichés (Wave 1)', 'Filter Verbs (Wave 4)']
  },
  {
    id: 'test_10',
    text: 'He didn\'t move, didn\'t speak, didn\'t even breathe—not that she noticed.',
    expected_primary: 'Negation (Wave 7)',
    expected_secondary: ['Filter Verbs (Wave 4)'],
    should_not_trigger: ['Body-Part Clichés (Wave 1)']
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = [];
    
    for (const test of GOLDEN_TEST_SET) {
      // Call validation function
      const response = await base44.asServiceRole.functions.invoke('validateWaveLabels', {
        waveHits: [{
          category: test.expected_primary || 'No wave',
          example_quote: test.text,
          severity: 'Medium',
          fix_suggestion: 'Test suggestion'
        }]
      });
      
      const validated = response.data.validated_hits[0];
      const invalid = response.data.invalid_hits[0];
      
      // Check expectations
      const passed = [];
      const failed = [];
      
      // Test 1: Expected primary wave
      if (test.expected_primary) {
        if (validated?.primary_wave?.id === test.expected_primary) {
          passed.push(`Primary wave correct: ${test.expected_primary}`);
        } else {
          failed.push(`Expected primary: ${test.expected_primary}, got: ${validated?.primary_wave?.id || 'none'}`);
        }
      } else {
        if (invalid) {
          passed.push('Correctly rejected (no valid wave)');
        } else {
          failed.push('Should have been rejected but was accepted');
        }
      }
      
      // Test 2: Expected secondary waves
      if (test.expected_secondary.length > 0) {
        const hasExpected = test.expected_secondary.every(w => 
          validated?.secondary_waves?.includes(w)
        );
        if (hasExpected) {
          passed.push(`Secondary waves correct: ${test.expected_secondary.join(', ')}`);
        } else {
          failed.push(`Expected secondary: ${test.expected_secondary.join(', ')}, got: ${validated?.secondary_waves?.join(', ') || 'none'}`);
        }
      }
      
      // Test 3: Should NOT trigger certain waves
      if (test.should_not_trigger.length > 0) {
        const wrongTriggers = test.should_not_trigger.filter(w => 
          validated?.primary_wave?.id === w || validated?.secondary_waves?.includes(w)
        );
        if (wrongTriggers.length === 0) {
          passed.push(`Correctly avoided: ${test.should_not_trigger.join(', ')}`);
        } else {
          failed.push(`Incorrectly triggered: ${wrongTriggers.join(', ')}`);
        }
      }
      
      results.push({
        test_id: test.id,
        text: test.text,
        passed: failed.length === 0,
        passed_checks: passed,
        failed_checks: failed,
        actual_result: validated || invalid
      });
    }
    
    const summary = {
      total_tests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      pass_rate: `${Math.round((results.filter(r => r.passed).length / results.length) * 100)}%`
    };
    
    return Response.json({
      summary,
      results,
      test_set: GOLDEN_TEST_SET
    });

  } catch (error) {
    console.error('Wave test error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});