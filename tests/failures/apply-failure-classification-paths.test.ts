import {
  RevisionFailureCode,
  getRevisionFailureDetails,
} from "@/lib/errors/revisionCodes";

type FailureCase = {
  code: RevisionFailureCode;
  messageFragment: string;
};

const APPLY_FAILURE_CASES: FailureCase[] = [
  {
    code: RevisionFailureCode.ANCHOR_MISS,
    messageFragment: "Anchor offsets missing for accepted proposal",
  },
  {
    code: RevisionFailureCode.ANCHOR_AMBIGUOUS,
    messageFragment: "Multiple possible anchor matches after text drift",
  },
  {
    code: RevisionFailureCode.CONTEXT_MISMATCH,
    messageFragment: "Before/after context verification failed",
  },
  {
    code: RevisionFailureCode.OFFSET_CONFLICT,
    messageFragment: "Proposal range overlaps with already-applied change",
  },
  {
    code: RevisionFailureCode.PARSE_ERROR,
    messageFragment: "Malformed apply payload from evaluator",
  },
  {
    code: RevisionFailureCode.INVARIANT_VIOLATION,
    messageFragment: "Illegal revision session transition",
  },
  {
    code: RevisionFailureCode.APPLY_COLLISION,
    messageFragment: "Duplicate apply operation for same span",
  },
];

type MockHarness = {
  jobRow: Record<string, unknown>;
  updatePayloads: Record<string, unknown>[];
  client: {
    from: (table: string) => {
      select: (fields: string) => {
        eq: (
          field: string,
          value: unknown,
        ) => {
          maybeSingle: () => Promise<{ data: any; error: null }>;
          single: () => Promise<{ data: any; error: null }>;
        };
      };
      update: (payload: Record<string, unknown>) => {
        eq: (
          field: string,
          value: unknown,
        ) => Promise<{ error: null }>;
      };
    };
  };
};

function createSupabaseHarness(): MockHarness {
  const jobRow: Record<string, unknown> = {
    id: "job-1",
    manuscript_id: 101,
    job_type: "quick_evaluation",
    status: "running",
    progress: {
      phase: "phase_2",
      phase_status: "running",
      total_units: 10,
      completed_units: 4,
      message: "Evaluating",
    },
    created_at: "2026-03-19T00:00:00.000Z",
    updated_at: "2026-03-19T00:00:01.000Z",
    last_heartbeat: "2026-03-19T00:00:01.000Z",
    last_error: null,
    failure_envelope: null,
    attempt_count: 0,
    max_attempts: 3,
    manuscripts: { user_id: "user-123" },
  };

  const updatePayloads: Record<string, unknown>[] = [];

  const client = {
    from: (_table: string) => ({
      select: (fields: string) => ({
        eq: (_field: string, _value: unknown) => ({
          maybeSingle: async () => {
            // getJob path in jobStore.supabase.ts
            if (fields.includes("id, manuscript_id, job_type, status")) {
              return { data: { ...jobRow }, error: null };
            }

            // default fallback
            return { data: { ...jobRow }, error: null };
          },
          single: async () => {
            // attempt_count/max_attempts fetch in setJobFailed
            if (fields.includes("attempt_count") && fields.includes("max_attempts")) {
              return {
                data: {
                  attempt_count: jobRow.attempt_count,
                  max_attempts: jobRow.max_attempts,
                },
                error: null,
              };
            }

            // default single read
            return { data: { ...jobRow }, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updatePayloads.push(payload);

        // Simulate persistence by mutating current row
        Object.assign(jobRow, payload);

        // if progress was merged in payload, keep it as object
        if (payload.progress && typeof payload.progress === "object") {
          jobRow.progress = payload.progress;
        }

        return {
          eq: async (_field: string, _value: unknown) => ({ error: null }),
        };
      },
    }),
  };

  return { jobRow, updatePayloads, client };
}

describe("Phase 2.4.c — apply-path failure classification proof", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock("@/lib/supabase/admin");
    jest.dontMock("@/lib/jobs/retryBackoff");
  });

  test.each(APPLY_FAILURE_CASES)(
    "persists and surfaces classified failure for %s",
    async ({ code, messageFragment }) => {
      const harness = createSupabaseHarness();

      jest.doMock("@/lib/supabase/admin", () => ({
        createAdminClient: () => harness.client,
      }));

      jest.doMock("@/lib/jobs/retryBackoff", () => ({
        calculateNextAttemptAt: () => "2026-03-19T00:10:00.000Z",
      }));

      const jobStoreSupabase = await import("@/lib/jobs/jobStore.supabase");

      const details = getRevisionFailureDetails(code);
      const retryable = details.severity === "retryable";

      const envelope = {
        code,
        message: `${details.message} :: ${messageFragment}`,
        retryable,
        phase: "phase_2",
        provider: "openai",
        context: {
          case_code: code,
          detail_fragment: messageFragment,
          source: "apply-path-test",
        },
        occurred_at: "2026-03-19T00:05:00.000Z",
      } as const;

      // 1) Write failure via real setJobFailed path
      await jobStoreSupabase.setJobFailed("job-1", envelope);

      // 2) Assert persistence payload is populated and specific
      expect(harness.updatePayloads.length).toBeGreaterThan(0);
      const updatePayload = harness.updatePayloads[harness.updatePayloads.length - 1];

      expect(updatePayload.last_error).toBe(envelope.message);
      expect(updatePayload.failure_envelope).toBeTruthy();

      const persistedEnvelope = updatePayload.failure_envelope as Record<string, unknown>;
      expect(persistedEnvelope.error_code).toBe(code);
      expect(persistedEnvelope.code).toBe(code);
      expect(persistedEnvelope.message).toBe(envelope.message);
      expect(persistedEnvelope.retryable).toBe(retryable);
      expect(persistedEnvelope.phase).toBe("phase_2");
      expect(persistedEnvelope.occurred_at).toBe(envelope.occurred_at);

      const persistedContext = persistedEnvelope.context as Record<string, unknown>;
      expect(persistedContext).toBeTruthy();
      expect(Object.keys(persistedContext).length).toBeGreaterThan(0);
      expect(persistedContext.case_code).toBe(code);
      expect(String(persistedContext.detail_fragment)).toContain(
        messageFragment.split(" ")[0],
      );

      // 3) Assert no generic/unclassified fallback values
      expect(String(persistedEnvelope.error_code)).not.toMatch(/UNKNOWN|GENERIC/i);
      expect(String(persistedEnvelope.code)).not.toMatch(/UNKNOWN|GENERIC/i);
      expect(String(persistedEnvelope.error_code)).not.toBe("");
      expect(String(updatePayload.last_error ?? "").trim().length).toBeGreaterThan(0);

      // 4) Read via jobs store path and verify surfaced failure_code
      const job = await jobStoreSupabase.getJob("job-1");
      expect(job).toBeTruthy();
      expect(job?.status).toBe("failed");
      expect(job?.failure_code).toBe(code);
      expect(job?.last_error).toContain(messageFragment);

      // 5) Specific status behavior check for retryable vs non-retryable
      if (code === RevisionFailureCode.PARSE_ERROR) {
        expect(updatePayload.status).toBe("failed");
        expect(updatePayload.next_attempt_at).toBe("2026-03-19T00:10:00.000Z");
      } else {
        expect(updatePayload.status).toBe("failed");
        expect(updatePayload.next_attempt_at).toBeUndefined();
      }
    },
  );
});
