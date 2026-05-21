import fs from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label}: anchor not found`);
  }
  return source.replace(needle, replacement);
}

function patchRunPipeline() {
  const path = 'lib/evaluation/pipeline/runPipeline.ts';
  let src = fs.readFileSync(path, 'utf8');

  if (!src.includes('_stopAfterPass12?: boolean')) {
    src = replaceOnce(
      src,
      `  _prebuiltPreflightDraft?: Pass3PreflightDraft;\n}`,
      `  _prebuiltPreflightDraft?: Pass3PreflightDraft;\n  /**\n   * Internal relay mode for phase_2: run/capture Pass 1 + Pass 2 only,\n   * then return before Perplexity, Pass 1A fallback, Pass 3 synthesis,\n   * Quality Gate, or WAVE can execute. Normal report generation must not set this.\n   */\n  _stopAfterPass12?: boolean;\n  _onPass12Ready?: (pass1: SinglePassOutput, pass2: SinglePassOutput) => Promise<void> | void;\n}`,
      'RunPipelineOptions stop-after insertion',
    );
  }

  if (!src.includes('const pplxChunkSweepPromise = opts._stopAfterPass12')) {
    src = replaceOnce(
      src,
      `  const pplxChunkSweepPromise = runPerplexityChunkScorer({\n    manuscriptText: opts.manuscriptText,\n    manuscriptChunks: opts.manuscriptChunks,\n    workType: opts.workType,\n    title: opts.title,\n    perplexityApiKey: opts.perplexityApiKey,\n    jobId: latencyJobId,\n  });`,
      `  const pplxChunkSweepPromise = opts._stopAfterPass12\n    ? Promise.resolve(null)\n    : runPerplexityChunkScorer({\n        manuscriptText: opts.manuscriptText,\n        manuscriptChunks: opts.manuscriptChunks,\n        workType: opts.workType,\n        title: opts.title,\n        perplexityApiKey: opts.perplexityApiKey,\n        jobId: latencyJobId,\n      });`,
      'Perplexity stop-after guard',
    );
  }

  if (!src.includes('reason: "pass12_only"')) {
    src = replaceOnce(
      src,
      `  const pass2aStructuredContext = buildPass2aStructuredContext({\n    manuscriptText: opts.manuscriptText,\n    manuscriptChunks: opts.manuscriptChunks,\n  });`,
      `  if (opts._stopAfterPass12) {\n    await opts._onPass12Ready?.(pass1Output, pass2Output);\n    timings.total_ms = nowMs() - pipelineStartMs;\n    logPipelineTimings("success", {\n      manuscriptId: opts.manuscriptId,\n      title: opts.title,\n      workType: opts.workType,\n      timings,\n    });\n\n    return {\n      ok: true,\n      synthesis: {} as SynthesisOutput,\n      quality_gate: { pass: true, checks: [], warnings: [] },\n      external_adjudication: {\n        status: "skipped",\n        mode: getExternalAdjudicationMode(),\n        cross_check_returned: false,\n        reason: "pass12_only",\n      },\n      routing: pipelineRouting,\n      provider_telemetry: providerTelemetry,\n    } as PipelineResult;\n  }\n\n  const pass2aStructuredContext = buildPass2aStructuredContext({\n    manuscriptText: opts.manuscriptText,\n    manuscriptChunks: opts.manuscriptChunks,\n  });`,
      'Pass12 early return insertion',
    );
  }

  fs.writeFileSync(path, src);
}

function injectStopAfterIntoCall(src, callName, pass1Var, pass2Var) {
  const start = src.indexOf(`const ${callName} = await runPipeline({`);
  if (start === -1) throw new Error(`${callName}: runPipeline call not found`);
  const slice = src.slice(start, start + 2000);
  if (slice.includes('_stopAfterPass12: true')) return src;
  const localNeedle = `executionMode: 'TRUSTED_PATH',\n`;
  const localOffset = slice.indexOf(localNeedle);
  if (localOffset === -1) throw new Error(`${callName}: executionMode anchor not found`);
  const absolute = start + localOffset;
  const injection =
    `executionMode: 'TRUSTED_PATH',\n` +
    `              _stopAfterPass12: true,\n` +
    `              _onPass12Ready: (pass1, pass2) => {\n` +
    `                ${pass1Var} = pass1;\n` +
    `                ${pass2Var} = pass2;\n` +
    `              },\n`;
  return src.slice(0, absolute) + injection + src.slice(absolute + localNeedle.length);
}

function patchProcessor() {
  const path = 'lib/evaluation/processor.ts';
  let src = fs.readFileSync(path, 'utf8');

  src = injectStopAfterIntoCall(src, 'p2CaptureResult', 'capturedPass1', 'capturedPass2');
  src = injectStopAfterIntoCall(src, 'p2ShortResult', 'capturedPass1Short', 'capturedPass2Short');

  src = src.replace(
    `          // Run Pass 1+2 via runPipeline with captured runners — single call, no retry loop.\n          // _runners intercepts the real runPass1/runPass2 outputs so we can write\n          // pass12_handoff_v1. Pass 3B (synthesis) still runs inside this call but its\n          // output is discarded — phase_3 owns synthesis and will re-run it via handoff.`,
    `          // Run Pass 1+2 via runPipeline stop-after mode — single call, no retry loop.\n          // _stopAfterPass12 guarantees phase_2 writes pass12_handoff_v1, then queues\n          // phase_3 without executing Perplexity, Pass 3B, Quality Gate, or WAVE.`,
  );

  fs.writeFileSync(path, src);
}

patchRunPipeline();
patchProcessor();
console.log('phase_2 stop-after-pass12 patch applied');
