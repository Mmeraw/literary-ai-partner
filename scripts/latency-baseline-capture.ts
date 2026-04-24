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
// Samples include deliberate craft tensions (POV shifts, voice inconsistency, pacing gaps)
// to ensure Pass1/Pass2 produce divergent feedback and avoid LLR_PRE_ARTIFACT_GENERATION_BLOCK.
const SAMPLE_MANUSCRIPTS = [
  {
    title: 'Neon Requiem',
    workType: 'novel',
    text: `The city never slept, but it was sleeping now—the particular kind of sleep that comes at four in the morning when even the night-shift crews have wound down. Marcus liked this time. He sat in the all-night diner on Fifth and Morrison, black coffee growing cold in front of him, watching the rain streak the window. The fluorescent lights hummed their constant mechanical prayer. He had been coming to this same booth for three years, ever since he left the police force. Some habits die hard, he thought, staring at his reflection in the dark coffee. A file had landed on his desk—the kind of file that takes years to assemble, that changes everything when you finally lay eyes on it.`,
  },
  {
    // POV slips from third-limited to omniscient mid-scene — craft divergence trigger
    title: 'The Glass Shore',
    workType: 'novel',
    text: `Rosalie stood at the water's edge and watched the ferry disappear into the morning fog. She told herself she wasn't waiting for anything. It was just that the shore was peaceful before the tourists arrived, before the vendors set up their carts and the children ran screaming into the waves. She didn't know that across the harbor, in a harbor-master's office smelling of diesel and old charts, a man named Voss was reading her name off a manifest—reading it twice, then folding the paper into his coat pocket. Rosalie skipped a stone and counted four hops before it sank. She felt, without knowing why, that something had shifted. Inside her, a small gear had quietly turned. It was the last morning she would ever spend alone on this shore, though she had no way of understanding that yet, and the narrator will not pretend otherwise.`,
  },
  {
    // Voice breaks from literary to colloquial abruptly — craft divergence trigger
    title: 'Borrowed Summer',
    workType: 'novel',
    text: `The afternoon unfolded with a kind of melancholy grace, each hour succeeding the last like the quiet pages of an elegy. Thomas sat beneath the oak and watched his daughter chase the dog across the brittle grass. The drought had been merciless; the lawn was basically toast at this point. He thought about the offer from his old firm, the one he'd turned down twice already. Third time's a charm, they said, which, when you think about it, is a pretty weird thing to hang your whole philosophy of persistence on. He pulled at a thread on his sleeve. Claire laughed at something the dog did, a pure sound, and for a moment Thomas forgot that the summer was borrowed, that he had borrowed it on terms he hadn't yet fully read.`,
  },
  {
    // Dialogue attribution confusion and unclear speaker — craft divergence trigger
    title: 'Two Kinds of Rain',
    workType: 'novel',
    text: `"You can't keep doing this," Elena said. She set her bag down by the door, which David noticed but didn't comment on—she always set it there when she planned to leave fast. "Every time we get close to something real, you pull back." "That's not what's happening." "Isn't it? Because from where I'm standing—" He turned toward the window. He didn't want to watch her face while she described the shape of his own failures. "You're not even listening." She was right, and he knew she was right, and knowing didn't help. "I'm listening." "No. You're just waiting for me to finish." Outside, the rain had started again—the thin, persistent kind that soaks you without ever feeling like a real storm.`,
  },
  {
    // Pacing inconsistency: rushed back-story dump mid-action — craft divergence trigger
    title: 'The Last Conductor',
    workType: 'novel',
    text: `The baton slipped from Maestro Halloran's fingers during the third movement—a catastrophe so unexpected that the first-chair violinist missed three bars just watching it fall. Halloran bent to retrieve it, decades of performance instinct taking over, and straightened as if nothing had happened. He had survived worse. At twenty-two he had conducted the Sarajevo Philharmonic during a power cut, working from memory in near darkness; at thirty-four he had finished a Mahler symphony despite a broken wrist, the pain arriving in red waves that he folded neatly into the music. His father had been a machinist in Bratislava who believed that stopping was a form of dying, a belief he communicated through silence and example rather than words, and Halloran had inherited this entirely, had never spoken of it to his wife or his students, and it sat in his chest now like ballast as the orchestra surged into the fourth movement and the audience, unaware that anything had gone wrong, leaned forward in their seats.`,
  },
  {
    // Resolution arrives too abruptly, emotional logic compressed — craft divergence trigger
    title: 'Salt Flats',
    workType: 'novel',
    text: `For eleven years, Mara had not spoken to her brother. The feud had begun over their mother's house and hardened into something structural, a load-bearing wall in both their lives. Then Ray called on a Tuesday in February to say he had cancer—treatable, probably, but real—and without quite deciding to, Mara said she would come. She drove the six hours in a kind of suspension, the radio off. Ray opened the door and he looked older, which was obvious and also somehow a shock. She hugged him. He hugged her back. They stood in his kitchen and she made coffee and he sat at the table, and they talked about the treatment plan and the oncologist and the insurance, and by the time she left that evening they had not mentioned the house at all, and she understood that they were not going to, that they had both agreed without agreeing to let it go, and she cried in the car at a rest stop outside Barstow, not from grief exactly, but because forgiveness, when it finally comes, is sometimes just quiet and ordinary, and that was enough.`,
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

  // Run all samples; stop early once we have enough successes
  const MINIMUM_SUCCESSES = 3;
  const samplesToRun = SAMPLE_MANUSCRIPTS.slice(0, 6);
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
          _passTimeoutMs: 120_000,
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
      } else if (result.ok === false) {
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

    // Early exit if we have enough successes
    const successCount = capturedTimings.filter(t => t.status === 'success').length;
    if (successCount >= MINIMUM_SUCCESSES) {
      console.log(`Reached ${MINIMUM_SUCCESSES} successes — stopping early.\n`);
      break;
    }
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
