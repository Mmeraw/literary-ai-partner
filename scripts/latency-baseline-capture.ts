/**
 * Latency Baseline Capture — Measurement Only (Non-Invasive)
 * 
 * Captures real Pass 1-4 latency data from 3-5 pipeline runs.
 * Uses existing infrastructure only. No pipeline file modifications.
 * 
 * Usage: npx tsx -r tsconfig-paths/register scripts/latency-baseline-capture.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
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

interface AttemptOutcome {
  title: string;
  workType: string;
  status: 'success' | 'failure';
  error_code?: string;
  error_message?: string;
  timed_out?: boolean;
  duration_ms: number;
}

const capturedTimings: CapturedTiming[] = [];
const attemptOutcomes: AttemptOutcome[] = [];

const SAMPLE_TIMEOUT_MS = Number.parseInt(process.env.BASELINE_SAMPLE_TIMEOUT_MS || '210000', 10);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function filterValidValues(records: CapturedTiming[], field: keyof CapturedTiming): number[] {
  return records
    .map(r => r[field] as number)
    .filter((v): v is number => typeof v === 'number' && v > 0);
}

function writeArtifact() {
  const successRecords = capturedTimings.filter(t => t.status === 'success');
  const failureRecords = capturedTimings.filter(t => t.status === 'failure');

  const totalMsValues = filterValidValues(successRecords, 'total_ms');
  const pass1MsValues = filterValidValues(successRecords, 'pass1_ms');
  const pass2MsValues = filterValidValues(successRecords, 'pass2_ms');
  const pass3MsValues = filterValidValues(successRecords, 'pass3_ms');

  const medianTotal = median(totalMsValues);
  const medianPass1 = median(pass1MsValues);
  const pass1Percent = medianTotal > 0 ? Math.round((medianPass1 / medianTotal) * 100) : 0;

  const blockerReason =
    successRecords.length >= 3
      ? null
      : `Insufficient successful captures: ${successRecords.length}/3 minimum required`;

  const artifact = {
    capture_timestamp: new Date().toISOString(),
    sample_timeout_ms: SAMPLE_TIMEOUT_MS,
    attempted_samples: attemptOutcomes.length,
    samples_measured: successRecords.length,
    minimum_required_successes: 3,
    evidence_grade_ready: successRecords.length >= 3,
    blocker_reason: blockerReason,
    attempt_outcomes: attemptOutcomes,
    captured_timings: {
      total: capturedTimings.length,
      successful: successRecords.length,
      failed: failureRecords.length,
    },
    sample_jobs: successRecords.map(r => ({
      title: r.title,
      work_type: r.workType,
      pass1_ms: r.pass1_ms,
      pass2_ms: r.pass2_ms,
      pass3_ms: r.pass3_ms,
      pass4_ms: r.pass4_ms,
      total_ms: r.total_ms,
    })),
    statistics: {
      median_total_ms: Math.round(medianTotal),
      median_pass1_ms: Math.round(medianPass1),
      median_pass2_ms: Math.round(median(pass2MsValues)),
      median_pass3_ms: Math.round(median(pass3MsValues)),
      pass1_percent_of_total: pass1Percent,
    },
    analysis: {
      dominant_cost_driver: pass1Percent > 50 ? 'Pass 1 (LLM inference)' : 'Pass 2/3 synthesis',
      pass1_dominant: pass1Percent > 40,
      candidate_for_optimization: successRecords.length >= 3
        ? (pass1Percent > 45 ? 'Yes - Pass 1 compression justified' : 'No - investigate other passes')
        : 'Undetermined - insufficient successful captures',
    },
  };

  mkdirSync('docs/operations/evidence/runs', { recursive: true });
  const artifactPath = 'docs/operations/evidence/runs/latency-baseline-capture.json';
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

  return { artifactPath, successRecords, medianTotal, medianPass1, pass1Percent };
}

function coerceCapturedTiming(raw: unknown): CapturedTiming | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  return {
    title: typeof row.title === 'string' ? row.title : 'unknown',
    workType: typeof row.work_type === 'string' ? row.work_type : 'unknown',
    pass1_ms: typeof row.pass1_ms === 'number' ? row.pass1_ms : undefined,
    pass2_ms: typeof row.pass2_ms === 'number' ? row.pass2_ms : undefined,
    pass3_ms: typeof row.pass3_ms === 'number' ? row.pass3_ms : undefined,
    pass4_ms: typeof row.pass4_ms === 'number' ? row.pass4_ms : undefined,
    total_ms: typeof row.total_ms === 'number' ? row.total_ms : undefined,
    status: row.stage === 'success' ? 'success' : 'failure',
  };
}

function extractTimingFromArgs(args: unknown[]): CapturedTiming | null {
  const first = args[0];
  const hasPipelineTag = typeof first === 'string' && first.includes('[Pipeline][Timings]');
  if (!hasPipelineTag) {
    return null;
  }

  // Common case: console.log('[Pipeline][Timings]', { ...timing })
  const second = args[1];
  const fromObject = coerceCapturedTiming(second);
  if (fromObject) {
    return fromObject;
  }

  // Fallback case: single string line with embedded JSON payload
  if (typeof first === 'string') {
    const jsonStart = first.indexOf('{');
    if (jsonStart > -1) {
      try {
        const parsed = JSON.parse(first.substring(jsonStart));
        return coerceCapturedTiming(parsed);
      } catch {
        return null;
      }
    }
  }

  return null;
}

// Monkey-patch console.log to intercept timing logs
const originalLog = console.log;
console.log = (...args: any[]) => {
  const captured = extractTimingFromArgs(args);
  if (captured) {
    capturedTimings.push(captured);
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
  console.log(`Per-sample timeout: ${SAMPLE_TIMEOUT_MS} ms\n`);

  for (let i = 0; i < samplesToRun.length; i++) {
    const sample = samplesToRun[i];
    console.log(`[${i + 1}/${samplesToRun.length}] Executing: "${sample.title}"`);
    const startedAt = Date.now();
    
    try {
      const result = await withTimeout(
        runPipeline({
          manuscriptText: sample.text,
          workType: sample.workType,
          title: sample.title,
          openaiApiKey: apiKey,
        }),
        SAMPLE_TIMEOUT_MS,
        `Sample timed out after ${SAMPLE_TIMEOUT_MS}ms`
      );

      if (result.ok) {
        attemptOutcomes.push({
          title: sample.title,
          workType: sample.workType,
          status: 'success',
          duration_ms: Date.now() - startedAt,
        });
        console.log(`✓ Success\n`);
      } else {
        attemptOutcomes.push({
          title: sample.title,
          workType: sample.workType,
          status: 'failure',
          error_code: result.error_code || 'UNKNOWN_PIPELINE_FAILURE',
          duration_ms: Date.now() - startedAt,
        });
        console.log(`✗ Failed: ${result.error_code}\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const timedOut = message.includes('Sample timed out');
      attemptOutcomes.push({
        title: sample.title,
        workType: sample.workType,
        status: 'failure',
        error_code: timedOut ? 'SAMPLE_TIMEOUT' : 'SAMPLE_RUNTIME_ERROR',
        error_message: message,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
      });
      console.error(`✗ Error: ${message}\n`);
    }

    // Small delay
    await new Promise(r => setTimeout(r, 100));
  }

  // Process results
  console.log('='.repeat(80));
  console.log('CAPTURED TIMING RECORDS');
  console.log('='.repeat(80));

  const { artifactPath, successRecords, medianTotal, medianPass1, pass1Percent } = writeArtifact();
  console.log(`Total captured: ${capturedTimings.length}`);
  console.log(`Successful: ${successRecords.length}`);
  console.log(`Failed: ${capturedTimings.length - successRecords.length}\n`);
  console.log(`Attempted samples: ${attemptOutcomes.length}\n`);

  if (successRecords.length === 0) {
    console.log('No successful runs captured. Artifact written with blocker details.');
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

  console.log(`Median total latency:     ${medianTotal.toFixed(0)} ms`);
  console.log(`Median Pass 1 latency:    ${medianPass1.toFixed(0)} ms (${pass1Percent}% of total)`);
  console.log(`Median Pass 2 latency:    ${median(filterValidValues(successRecords, 'pass2_ms')).toFixed(0)} ms`);
  console.log(`Median Pass 3 latency:    ${median(filterValidValues(successRecords, 'pass3_ms')).toFixed(0)} ms`);

  // Write artifact
  console.log('\n' + '='.repeat(80));
  console.log('ARTIFACT OUTPUT');
  console.log('='.repeat(80));

  console.log(`✓ Artifact: ${artifactPath}`);
  console.log(`✓ Records: ${successRecords.length} jobs`);
  if (successRecords.length >= 3) {
    console.log(`✓ Status: Complete\n`);
  } else {
    console.log(`⚠ Status: Incomplete evidence (${successRecords.length}/3 successes); blocker recorded in artifact\n`);
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log(`End: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

runBaselineCapture().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
