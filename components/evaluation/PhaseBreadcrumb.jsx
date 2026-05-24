"use client";

import React from "react";
import { PIPELINE_STAGE_ORDER, PHASE_STAGE_LABELS } from "@/lib/evaluation/phaseLog";

/**
 * PhaseBreadcrumb
 *
 * Renders the phase entered/passed log as a horizontal timeline.
 * Drives from phaseLog entries + current job state so it works
 * even for jobs that pre-date the phase_log feature (falls back
 * to DB timestamp columns passed in via `job`).
 *
 * Props:
 *   phaseLog  — PhaseLogEntry[] from progress.phase_log (may be null/empty)
 *   job       — raw job row (for DB timestamp fallback + current phase)
 *   compact   — if true, renders smaller (for history table rows)
 */
export default function PhaseBreadcrumb({ phaseLog = [], job, compact = false }) {
  // Build a lookup: stage → { entered, passed, failed }
  const stageState = {};

  // Seed from phaseLog entries
  for (const entry of (phaseLog ?? [])) {
    if (!stageState[entry.stage]) stageState[entry.stage] = {};
    stageState[entry.stage][entry.event] = entry.at;
  }

  // Fallback: read DB timestamp columns directly from job row
  const DB_COLS = {
    phase_0:      { entered: "phase0_started_at",      passed: "phase0_completed_at" },
    phase_1a:     { entered: "phase1_started_at",       passed: "phase1_completed_at" },
    review_gate:  { entered: "review_gate_entered_at",  passed: "review_gate_passed_at" },
    phase_2:      { entered: "phase2_started_at",       passed: "phase2_completed_at" },
    phase_3:      { entered: "phase3_started_at",       passed: "phase3_completed_at" },
  };

  for (const [stage, cols] of Object.entries(DB_COLS)) {
    if (!stageState[stage]) stageState[stage] = {};
    if (!stageState[stage].entered && job?.[cols.entered]) {
      stageState[stage].entered = job[cols.entered];
    }
    if (!stageState[stage].passed && job?.[cols.passed]) {
      stageState[stage].passed = job[cols.passed];
    }
  }

  // Current active stage from live job state
  const currentPhase = job?.phase ?? job?.progress?.phase;
  const currentPhaseStatus = job?.phase_status ?? job?.progress?.phase_status;
  const jobStatus = job?.status;

  function formatTs(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return null;
    }
  }

  function getStageStatus(stage) {
    const s = stageState[stage] ?? {};
    if (s.failed) return "failed";
    if (s.passed) return "passed";
    if (s.entered) {
      // If this is the current phase and job is still running, it's active
      if (stage === currentPhase && currentPhaseStatus !== "complete") return "active";
      return "passed"; // entered + not current = passed
    }
    if (stage === currentPhase) return "active";
    return "pending";
  }

  const dotSize = compact ? "w-2.5 h-2.5" : "w-3.5 h-3.5";
  const textSize = compact ? "text-xs" : "text-xs";
  const labelSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div className="flex items-start gap-0 w-full overflow-x-auto">
      {PIPELINE_STAGE_ORDER.map((stage, idx) => {
        const status = getStageStatus(stage);
        const s = stageState[stage] ?? {};
        const label = PHASE_STAGE_LABELS[stage] ?? stage;
        const isLast = idx === PIPELINE_STAGE_ORDER.length - 1;

        const dotColor =
          status === "passed"  ? "bg-green-500" :
          status === "active"  ? "bg-blue-500 ring-2 ring-blue-200 animate-pulse" :
          status === "failed"  ? "bg-red-500" :
                                 "bg-gray-200";

        const lineColor =
          status === "passed" || getStageStatus(PIPELINE_STAGE_ORDER[idx + 1]) !== "pending"
            ? "bg-green-300"
            : "bg-gray-200";

        const labelColor =
          status === "passed"  ? "text-green-700" :
          status === "active"  ? "text-blue-700 font-semibold" :
          status === "failed"  ? "text-red-600" :
                                 "text-gray-400";

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            {/* Stage node */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`rounded-full ${dotSize} ${dotColor} transition-all`} />
              <div className={`mt-1 text-center ${labelSize} ${labelColor} whitespace-nowrap`}>
                {label}
              </div>
              {/* Timestamps */}
              {!compact && (
                <div className="text-[9px] text-gray-400 text-center mt-0.5 leading-tight">
                  {s.entered && <div>↓ {formatTs(s.entered)}</div>}
                  {s.passed  && <div>✓ {formatTs(s.passed)}</div>}
                  {s.failed  && <div className="text-red-400">✗ {formatTs(s.failed)}</div>}
                </div>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-18px] ${lineColor} transition-all`} />
            )}
          </div>
        );
      })}

      {/* Terminal state badge */}
      {jobStatus === "complete" && (
        <div className="flex flex-col items-center flex-shrink-0 ml-1">
          <div className="w-3.5 h-3.5 rounded-full bg-green-600" />
          <div className={`mt-1 text-center ${labelSize} text-green-700 font-semibold whitespace-nowrap`}>
            Complete
          </div>
        </div>
      )}
      {jobStatus === "failed" && (
        <div className="flex flex-col items-center flex-shrink-0 ml-1">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500" />
          <div className={`mt-1 text-center ${labelSize} text-red-600 font-semibold whitespace-nowrap`}>
            Failed
          </div>
        </div>
      )}
    </div>
  );
}
