const createCompletionMock = jest.fn();
const OpenAIMock = jest.fn(() => ({
  chat: {
    completions: {
      create: createCompletionMock,
    },
  },
}));

const createClientMock = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: OpenAIMock,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

type UpdatePayload = Record<string, unknown>;

function makeSupabaseStub(shortText: string) {
  const evaluationJobUpdates: UpdatePayload[] = [];

  const queuedJob = {
    id: "job-short-text",
    manuscript_id: 123,
    job_type: "evaluation",
    status: "queued",
    created_at: new Date().toISOString(),
    progress: {},
  };

  const manuscript = {
    id: 123,
    title: "Tiny Submission",
    content: null,
    work_type: "novel",
    user_id: "00000000-0000-0000-0000-000000000001",
  };

  return {
    evaluationJobUpdates,
    from(table: string) {
      if (table === "evaluation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: queuedJob, error: null }),
            }),
          }),
          update: (payload: UpdatePayload) => {
            evaluationJobUpdates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "manuscripts") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: manuscript, error: null }),
            }),
          }),
        };
      }

      if (table === "manuscript_chunks") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    chunk_index: 0,
                    content: shortText,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table in test stub: ${table}`);
    },
  };
}

describe("processEvaluationJob short-text fail-closed", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_MIN_MANUSCRIPT_CHARS = "200";
  });

  test("fails job and never calls OpenAI when resolved manuscript text is below threshold", async () => {
    const supabaseStub = makeSupabaseStub("too short");
    createClientMock.mockReturnValue(supabaseStub);

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");

    const result = await processEvaluationJob("job-short-text");

    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/too short for reliable evaluation/i);

    expect(OpenAIMock).not.toHaveBeenCalled();
    expect(createCompletionMock).not.toHaveBeenCalled();

    const finalUpdate = supabaseStub.evaluationJobUpdates.at(-1) as UpdatePayload;
    expect(finalUpdate).toMatchObject({ status: "failed" });
    expect(String(finalUpdate.last_error || "")).toMatch(/minimum 200/i);
  });
});
