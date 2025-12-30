import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validation Harness for Gold Standard Training Set
 * 
 * Tests Base44's voice/register behavior against gold-labeled examples.
 * Run this endpoint to validate current system before adding more training data.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Load gold standard from file
    const goldBundlePath = new URL('./toadstone_gold.v1.json', import.meta.url);
    const goldBundleText = await Deno.readTextFile(goldBundlePath);
    const goldBundle = JSON.parse(goldBundleText);

    const results = {
      timestamp: new Date().toISOString(),
      gold_bundle_id: goldBundle.batch_id,
      total_examples: goldBundle.examples.length,
      total_gold_issues: 0,
      comparisons: [],
      metrics: {
        overall: {},
        by_wave_item: {},
        by_register: {},
        by_register_lock: {},
        top_mismatches: []
      }
    };

    // Process each gold example
    for (const goldExample of goldBundle.examples) {
      results.total_gold_issues += goldExample.wave_issues.length;

      // Simulate Base44 evaluation (in production, call actual evaluation)
      // For now, we'll demonstrate the structure
      const base44Result = await evaluateWithBase44(goldExample.excerpt, base44);

      // Compare gold vs Base44
      const comparison = compareExample(goldExample, base44Result);
      results.comparisons.push(...comparison);
    }

    // Aggregate metrics
    results.metrics = aggregateMetrics(results.comparisons);

    return Response.json(results, { status: 200 });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ 
      error: 'Validation failed', 
      details: error.message 
    }, { status: 500 });
  }
});

/**
 * Simulate Base44 evaluation
 * In production, this would call the actual WAVE evaluation system
 */
async function evaluateWithBase44(excerpt, base44) {
  // TODO: Replace with actual Base44 WAVE evaluation call
  // For now, return mock structure
  return {
    excerpt,
    issues: [
      // Example: {
      //   wave_number: 2,
      //   wave_item: "W2.REGISTER.PROFANITY",
      //   label: "NO_ACTION",
      //   severity: "low",
      //   correct_action: "keep"
      // }
    ]
  };
}

/**
 * Index gold issues by wave_item key
 */
function indexGoldIssues(example) {
  const map = new Map();
  for (const issue of example.wave_issues) {
    const key = `${issue.wave_number}|${issue.wave_item}`;
    map.set(key, issue);
  }
  return map;
}

/**
 * Index Base44 issues by wave_item key
 */
function indexBase44Issues(result) {
  const map = new Map();
  for (const issue of result.issues) {
    const key = `${issue.wave_number}|${issue.wave_item}`;
    map.set(key, issue);
  }
  return map;
}

/**
 * Derive true positive classification for Base44
 * Fix-like labels = TP, review/no_action labels = FP
 */
function deriveBase44TruePositive(issue) {
  const fixLabels = [
    "CLARITY_REVIEW",
    "HOUSE_STYLE_REVIEW", 
    "TYPOGRAPHY_REVIEW",
    "CREDIBILITY_REVIEW",
    "FORMAT_BREAK"
  ];
  return fixLabels.includes(issue.label);
}

/**
 * Compare gold example vs Base44 result
 */
function compareExample(goldExample, base44Result) {
  const goldIdx = indexGoldIssues(goldExample);
  const baseIdx = indexBase44Issues(base44Result);

  const rows = [];

  // Compare each gold issue
  for (const [key, goldIssue] of goldIdx.entries()) {
    const base44Issue = baseIdx.get(key);

    // If Base44 missed it, treat as default "NO_ACTION/low/keep"
    const base44Norm = base44Issue ?? {
      wave_number: goldIssue.wave_number,
      wave_item: goldIssue.wave_item,
      label: "NO_ACTION",
      severity: "low",
      correct_action: "keep"
    };

    const base44TP = base44Issue ? deriveBase44TruePositive(base44Norm) : false;

    rows.push({
      example_id: goldExample.id,
      wave_item: goldIssue.wave_item,
      register: goldExample.register,
      register_lock: goldExample.register_lock,
      gold: {
        is_true_positive: goldIssue.is_true_positive,
        label: goldIssue.label,
        severity: goldIssue.severity,
        correct_action: goldIssue.correct_action
      },
      base44: {
        is_true_positive: base44TP,
        label: base44Norm.label,
        severity: base44Norm.severity,
        correct_action: base44Norm.correct_action
      },
      match: {
        is_true_positive: goldIssue.is_true_positive === base44TP,
        label: goldIssue.label === base44Norm.label,
        severity: goldIssue.severity === base44Norm.severity,
        correct_action: goldIssue.correct_action === base44Norm.correct_action
      }
    });
  }

  return rows;
}

/**
 * Aggregate accuracy metrics from comparisons
 */
function aggregateMetrics(comparisons) {
  const metrics = {
    overall: {
      label_accuracy: 0,
      severity_accuracy: 0,
      action_accuracy: 0,
      tp_fp_accuracy: 0,
      total: comparisons.length
    },
    by_wave_item: {},
    by_register: {},
    by_register_lock: {},
    top_mismatches: []
  };

  if (comparisons.length === 0) return metrics;

  // Calculate overall accuracy
  let labelMatches = 0;
  let severityMatches = 0;
  let actionMatches = 0;
  let tpMatches = 0;

  for (const row of comparisons) {
    if (row.match.label) labelMatches++;
    if (row.match.severity) severityMatches++;
    if (row.match.correct_action) actionMatches++;
    if (row.match.is_true_positive) tpMatches++;

    // Track by wave_item
    if (!metrics.by_wave_item[row.wave_item]) {
      metrics.by_wave_item[row.wave_item] = {
        total: 0,
        label_matches: 0,
        severity_matches: 0,
        action_matches: 0
      };
    }
    metrics.by_wave_item[row.wave_item].total++;
    if (row.match.label) metrics.by_wave_item[row.wave_item].label_matches++;
    if (row.match.severity) metrics.by_wave_item[row.wave_item].severity_matches++;
    if (row.match.correct_action) metrics.by_wave_item[row.wave_item].action_matches++;

    // Track by register
    if (!metrics.by_register[row.register]) {
      metrics.by_register[row.register] = {
        total: 0,
        label_matches: 0,
        tp_matches: 0
      };
    }
    metrics.by_register[row.register].total++;
    if (row.match.label) metrics.by_register[row.register].label_matches++;
    if (row.match.is_true_positive) metrics.by_register[row.register].tp_matches++;

    // Track by register_lock
    if (!metrics.by_register_lock[row.register_lock]) {
      metrics.by_register_lock[row.register_lock] = {
        total: 0,
        label_matches: 0,
        severity_matches: 0
      };
    }
    metrics.by_register_lock[row.register_lock].total++;
    if (row.match.label) metrics.by_register_lock[row.register_lock].label_matches++;
    if (row.match.severity) metrics.by_register_lock[row.register_lock].severity_matches++;

    // Track mismatches
    if (!row.match.label || !row.match.severity || !row.match.correct_action) {
      metrics.top_mismatches.push({
        example_id: row.example_id,
        wave_item: row.wave_item,
        register: row.register,
        register_lock: row.register_lock,
        gold_label: row.gold.label,
        base44_label: row.base44.label,
        gold_severity: row.gold.severity,
        base44_severity: row.base44.severity,
        mismatch_type: !row.match.label ? 'label' : !row.match.severity ? 'severity' : 'action'
      });
    }
  }

  metrics.overall.label_accuracy = (labelMatches / comparisons.length * 100).toFixed(1) + '%';
  metrics.overall.severity_accuracy = (severityMatches / comparisons.length * 100).toFixed(1) + '%';
  metrics.overall.action_accuracy = (actionMatches / comparisons.length * 100).toFixed(1) + '%';
  metrics.overall.tp_fp_accuracy = (tpMatches / comparisons.length * 100).toFixed(1) + '%';

  // Calculate per-wave-item accuracy
  for (const [waveItem, stats] of Object.entries(metrics.by_wave_item)) {
    metrics.by_wave_item[waveItem].label_accuracy = 
      (stats.label_matches / stats.total * 100).toFixed(1) + '%';
    metrics.by_wave_item[waveItem].severity_accuracy = 
      (stats.severity_matches / stats.total * 100).toFixed(1) + '%';
    metrics.by_wave_item[waveItem].action_accuracy = 
      (stats.action_matches / stats.total * 100).toFixed(1) + '%';
  }

  // Calculate per-register accuracy
  for (const [register, stats] of Object.entries(metrics.by_register)) {
    metrics.by_register[register].label_accuracy = 
      (stats.label_matches / stats.total * 100).toFixed(1) + '%';
    metrics.by_register[register].tp_accuracy = 
      (stats.tp_matches / stats.total * 100).toFixed(1) + '%';
  }

  // Calculate per-register-lock accuracy
  for (const [lock, stats] of Object.entries(metrics.by_register_lock)) {
    metrics.by_register_lock[lock].label_accuracy = 
      (stats.label_matches / stats.total * 100).toFixed(1) + '%';
    metrics.by_register_lock[lock].severity_accuracy = 
      (stats.severity_matches / stats.total * 100).toFixed(1) + '%';
  }

  // Sort top mismatches (show first 20)
  metrics.top_mismatches = metrics.top_mismatches.slice(0, 20);

  return metrics;
}