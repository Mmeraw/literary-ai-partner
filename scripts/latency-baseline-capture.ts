/**
 * Latency Baseline Capture — Measurement Only (Non-Invasive)
 * 
 * Captures real Pass 1-4 latency data from 3-5 pipeline runs.
 * Uses existing infrastructure only. No pipeline file modifications.
 * 
 * Usage: npx tsx -r tsconfig-paths/register scripts/latency-baseline-capture.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config();

import { runPipeline } from '@/lib/evaluation/pipeline/runPipeline';

// Real manuscript samples for latency baseline
const SAMPLE_MANUSCRIPTS = [
  {
    title: 'The Deep Forest',
    workType: 'novel',
    text: `The ancient forest stretched before her like a living cathedral, its canopy so thick that even at noon the light fell in slanted golden bars. Sarah had walked these paths since childhood, but today felt different. The birds had gone silent, and the usual rustle of small creatures in the underbrush had ceased. She paused at the edge of the clearing where the old stone ruins stood, half-buried in moss and time. The inscription on the largest stone had faded decades ago, but she knew it by heart: "Here rested the seekers of truth." Her grandmother had brought her here first, explaining that the ruins predated the town by centuries, that they were markers of a civilization that valued knowledge above all else. As she ran her fingers across the worn surface, Sarah felt the weight of that legacy. Her dissertation on medieval epistemology had brought her back here, searching for connections between the symbols carved into these stones and the theoretical frameworks that had emerged centuries later. The coincidences were too striking to ignore.`,
  },
  {
    title: 'Neon Requiem',
    workType: 'novel',
    text: `The city never slept, but it was sleeping now—the particular kind of sleep that comes at four in the morning when even the night-shift crews have wound down. Marcus liked this time. He sat in the all-night diner on Fifth and Morrison, black coffee growing cold in front of him, watching the rain streak the window. The fluorescent lights hummed their constant mechanical prayer. He had been coming to this same booth for three years, ever since he left the police force. Some habits die hard, he thought, staring at his reflection in the dark coffee. A file had landed on his desk—the kind of file that takes years to assemble, that changes everything when you finally lay eyes on it.`,
  },
  {
    title: 'The Inheritance',
    workType: 'novel',
    text: `Eleanor received the letter on a Tuesday afternoon, forwarded three times before it found her in the small apartment she rented above a bookstore in Portland. The return address was a lawyer's office in London, a name she did not recognize. For a moment she considered throwing it away unopened. She had learned long ago that the past, once buried, was best left undisturbed. But curiosity—that old vice—made her open it anyway. Her grandmother had died. The letter explained that Margaret Anne Whitmore had passed away at the age of ninety-eight in a care facility outside Cambridge. Eleanor was named as sole beneficiary to an estate.`,
  },
];

// For non-blocking environment, we need to collect data with side-effects
interface CapturedTiming {
  title: string;
  workType: string;
  pass1_ms?: number;
  pass2_ms?: number;
  pass3_ms?: number;
  pass4_ms?: number;
  total_ms?: number;
  status: 'success' | 'failure';
}

const capturedTimings: CapturedTiming[] = [];

// Monkey-patch console.log to intercept timing logs
const originalLog = console.log;
console.log = (...args: any[]) => {
  const msg = args.join(' ');
  
  // Only capture [Pipeline][Timings] logs
  if (msg.includes('[Pipeline][Timings]')) {
    try {
      // Parse the JSON from the log
      const jsonStart = msg.indexOf('{');
      if (jsonStart > -1) {
        const jsonPart = msg.substring(jsonStart);
        const parsed = JSON.parse(jsonPart);
        
        capturedTimings.push({
          title: parsed.title || 'unknown',
          workType: parsed.work_type || 'unknown',
          pass1_ms: parsed.pass1_ms,
          pass2_ms: parsed.pass2_ms,
          pass3_ms: parsed.pass3_ms,
          pass4_ms: parsed.pass4_ms,
          total_ms: parsed.total_ms,
          status: parsed.stage === 'success' ? 'success' : 'failure',
        });
      }
    } catch (e) {
      // Silent fail - log capture is non-critical
    }
  }
  
  originalLog.apply(console, args);
};

async function runBaselineCapture() {
  console.log('='.repeat(80));
  console.log('LATENCY BASELINE CAPTURE');
  console.log('Pass 1-4 Real Pipeline Measurement (Non-Invasive)');
  console.log('='.repeat(80));
  console.log(`Start: ${new Date().toISOString()}\n`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable not set');
    console.error('Baseline capture requires OpenAI API access');
    process.exit(1);
  }

  // Run a small number of samples
  const samplesToRun = SAMPLE_MANUSCRIPTS.slice(0, 3);
  console.log(`Running ${samplesToRun.length} real manuscript samples...\n`);

  for (let i = 0; i < samplesToRun.length; i++) {
    const sample = samplesToRun[i];
    console.log(`[${i + 1}/${samplesToRun.length}] Executing: "${sample.title}"`);
    
    try {
      const result = await runPipeline({
        manuscriptText: sample.text,
        workType: sample.workType,
        title: sample.title,
        openaiApiKey: apiKey,
      });

      if (result.ok) {
        console.log(`✓ Success\n`);
      } else {
        console.log(`✗ Failed: ${result.error_code}\n`);
      }
    } catch (err) {
      console.error(`✗ Error: ${err instanceof Error ? err.message : String(err)}\n`);
    }

    // Small delay
    await new Promise(r => setTimeout(r, 100));
  }

  // Process results
  console.log('='.repeat(80));
  console.log('CAPTURED TIMING RECORDS');
  console.log('='.repeat(80));

  const successRecords = capturedTimings.filter(t => t.status === 'success');
  console.log(`Total captured: ${capturedTimings.length}`);
  console.log(`Successful: ${successRecords.length}`);
  console.log(`Failed: ${capturedTimings.length - successRecords.length}\n`);

  if (successRecords.length === 0) {
    console.log('No successful runs captured. Check API credentials and network.');
    process.exit(1);
  }

  // Display sample table
  console.log('Sample Results:');
  console.log('  Job                    Pass1    Pass2    Pass3    Total');
  console.log('  ' + '-'.repeat(60));
  for (const record of successRecords) {
    const title = record.title.substring(0, 18).padEnd(18);
    const p1 = String(record.pass1_ms || 0).padStart(8);
    const p2 = String(record.pass2_ms || 0).padStart(8);
    const p3 = String(record.pass3_ms || 0).padStart(8);
    const total = String(record.total_ms || 0).padStart(8);
    console.log(`  ${title} ${p1} ${p2} ${p3} ${total}`);
  }

  // Calculate statistics
  console.log('\n' + '='.repeat(80));
  console.log('STATISTICS');
  console.log('='.repeat(80));

  const filterValidValues = (records: CapturedTiming[], field: keyof CapturedTiming) => 
    records.map(r => r[field] as number).filter((v): v is number => typeof v === 'number' && v > 0);

  const totalMsValues = filterValidValues(successRecords, 'total_ms').sort((a, b) => a - b);
  const pass1MsValues = filterValidValues(successRecords, 'pass1_ms').sort((a, b) => a - b);
  
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const medianTotal = median(totalMsValues);
  const medianPass1 = pass1MsValues.length > 0 ? median(pass1MsValues) : 0;
  const pass1Percent = medianTotal > 0 ? Math.round((medianPass1 / medianTotal) * 100) : 0;

  console.log(`Median total latency:     ${medianTotal.toFixed(0)} ms`);
  console.log(`Median Pass 1 latency:    ${medianPass1.toFixed(0)} ms (${pass1Percent}% of total)`);
  console.log(`Median Pass 2 latency:    ${median(filterValidValues(successRecords, 'pass2_ms')).toFixed(0)} ms`);
  console.log(`Median Pass 3 latency:    ${median(filterValidValues(successRecords, 'pass3_ms')).toFixed(0)} ms`);

  // Write artifact
  console.log('\n' + '='.repeat(80));
  console.log('ARTIFACT OUTPUT');
  console.log('='.repeat(80));

  const artifact = {
    capture_timestamp: new Date().toISOString(),
    samples_measured: successRecords.length,
    sample_jobs: successRecords.map(r => ({
      title: r.title,
      work_type: r.workType,
      pass1_ms: r.pass1_ms,
      pass2_ms: r.pass2_ms,
      pass3_ms: r.pass3_ms,
      total_ms: r.total_ms,
    })),
    statistics: {
      median_total_ms: Math.round(medianTotal),
      median_pass1_ms: Math.round(medianPass1),
      pass1_percent_of_total: pass1Percent,
    },
    analysis: {
      dominant_cost_driver: pass1Percent > 50 ? 'Pass 1 (LLM inference)' : 'Pass 2/3 synthesis',
      pass1_dominant: pass1Percent > 40,
      candidate_for_optimization: pass1Percent > 45 ? 'Yes - Pass 1 compression justified' : 'No - investigate other passes',
    },
  };

  mkdirSync('docs/operations/evidence/runs', { recursive: true });
  const artifactPath = 'docs/operations/evidence/runs/latency-baseline-capture.json';
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  
  console.log(`✓ Artifact: ${artifactPath}`);
  console.log(`✓ Records: ${successRecords.length} jobs`);
  console.log(`✓ Status: Complete\n`);

  console.log('='.repeat(80));
  console.log(`End: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

runBaselineCapture().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
