/**
 * Metrics / Observability Hooks
 * 
 * Safe no-op by default - only emits metrics when configured.
 * Never throws - all hooks are wrapped in try/catch.
 * Vendor-agnostic - supports pluggable backends.
 */

const METRICS_ENABLED = process.env.METRICS_ENABLED === "true";
const METRICS_BACKEND = process.env.METRICS_BACKEND || "console"; // "console", "datadog", "cloudwatch", custom

type MetricsBackend = {
  increment: (metric: string, tags?: Record<string, string>) => void;
  timing: (metric: string, value: number, tags?: Record<string, string>) => void;
  gauge: (metric: string, value: number, tags?: Record<string, string>) => void;
};

// Default console backend for development
const consoleBackend: MetricsBackend = {
  increment: (metric, tags) => {
    if (METRICS_ENABLED) {
      console.log("MetricIncrement", { metric, tags });
    }
  },
  timing: (metric, value, tags) => {
    if (METRICS_ENABLED) {
      console.log("MetricTiming", { metric, value_ms: value, tags });
    }
  },
  gauge: (metric, value, tags) => {
    if (METRICS_ENABLED) {
      console.log("MetricGauge", { metric, value, tags });
    }
  },
};

// Backend registry - can be extended with custom backends
const backends: Record<string, MetricsBackend> = {
  console: consoleBackend,
  // Add datadog, cloudwatch, etc. here
};

function getBackend(): MetricsBackend {
  return backends[METRICS_BACKEND] || consoleBackend;
}

/**
 * Safe wrapper - never throws
 */
function safeMetric(fn: () => void): void {
  if (!METRICS_ENABLED) return;
  
  try {
    fn();
  } catch (error) {
    // Never throw from metrics - log and continue
    console.error("MetricsError", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Job created
 */
export function onJobCreated(job_id: string, job_type: string): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.increment("job.created", { job_type });
  });
}

/**
 * Phase completed
 */
export function onPhaseCompleted(
  job_id: string,
  phase: string,
  duration_ms: number
): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.timing("job.phase.duration", duration_ms, { phase });
    backend.increment("job.phase.completed", { phase });
  });
}

/**
 * Job failed
 */
export function onJobFailed(
  job_id: string,
  phase: string,
  error: string
): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.increment("job.failed", { phase });
  });
}

/**
 * Job completed successfully
 */
export function onJobCompleted(
  job_id: string,
  job_type: string,
  total_duration_ms: number
): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.timing("job.total.duration", total_duration_ms, { job_type });
    backend.increment("job.completed", { job_type });
  });
}

/**
 * Job canceled
 */
export function onJobCanceled(
  job_id: string,
  phase: string
): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.increment("job.canceled", { phase });
  });
}

/**
 * Retry scheduled
 */
export function onRetryScheduled(
  job_id: string,
  retry_count: number,
  phase: string
): void {
  safeMetric(() => {
    const backend = getBackend();
    backend.increment("job.retry.scheduled", { phase });
    backend.gauge("job.retry.count", retry_count, { phase });
  });
}

/**
 * Register a custom metrics backend
 */
export function registerBackend(name: string, backend: MetricsBackend): void {
  backends[name] = backend;
}
