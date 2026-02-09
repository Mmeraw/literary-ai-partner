export type ObservabilitySampleEvent = {
  event_type: string;
  payload: unknown;
};

export const sampleEvents: ObservabilitySampleEvent[] = [
  {
    event_type: "job.failed",
    payload: {
      failed_at: "2026-02-08T04:26:18Z",
      failure_reason: "NETWORK_UNREACHABLE",
      attempt_count: 2,
      error: { message: "connection failed: Network is unreachable" },
    },
  },
  {
    event_type: "admin.retry_requested",
    payload: {
      reason: "Operator initiated retry",
      job_id: "job_123",
      attempt_count_before: 2,
    },
  },
];
