/**
 * Structured Logging for Production Observability
 * 
 * Provides trace IDs and structured logs for correlating requests → jobs → results
 */

import { randomUUID } from "crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  trace_id?: string;
  request_id?: string;
  job_id?: string;
  job_type?: string;
  user_id?: string | null;
  [key: string]: unknown;
}

/**
 * Generate a unique trace ID for request correlation
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Structured log function - logs to console with context
 * In production, these go to Vercel logs and can be searched
 */
export function log(
  level: LogLevel,
  message: string,
  context: LogContext = {}
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  };

  // Log as JSON for easy parsing/searching in Vercel logs
  const logMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logMethod(JSON.stringify(logEntry));
}

/**
 * Convenience functions for each log level
 */
export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  debug: (message: string, context?: LogContext) => log("debug", message, context),
};

/**
 * Job lifecycle logging helpers
 */
export const jobLogger = {
  created: (job_id: string, job_type: string, context: LogContext = {}) => {
    logger.info("Job created", {
      event: "job.created",
      job_id,
      job_type,
      ...context,
    });
  },

  started: (job_id: string, job_type: string, context: LogContext = {}) => {
    logger.info("Job started", {
      event: "job.started",
      job_id,
      job_type,
      ...context,
    });
  },

  completed: (job_id: string, job_type: string, duration_ms: number, context: LogContext = {}) => {
    logger.info("Job completed", {
      event: "job.completed",
      job_id,
      job_type,
      duration_ms,
      ...context,
    });
  },

  failed: (job_id: string, job_type: string, error: string, context: LogContext = {}) => {
    logger.error("Job failed", {
      event: "job.failed",
      job_id,
      job_type,
      error,
      ...context,
    });
  },
};

/**
 * Metrics counters (logged for now, can be scraped later)
 */
export const metrics = {
  increment: (metric: string, value: number = 1, context: LogContext = {}) => {
    logger.info("Metric increment", {
      event: "metric",
      metric,
      value,
      ...context,
    });
  },
};
